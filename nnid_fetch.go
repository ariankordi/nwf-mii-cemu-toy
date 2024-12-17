package main

import (
	"crypto/tls"
	"errors"
	"math/rand"
	"net/http"
	"os"

	"encoding/json"
	"encoding/xml"

	// encode binary (mii map) to base64
	"encoding/base64"

	"regexp"
	"strconv"
	"strings"

	"io"
	"time"

	"fmt"
	"log"

	// PURELY just for nnid cache
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"bytes"
	"ffl-testing-frontend-http/mii2studio"
	"unicode/utf16"
)

var apiBases = map[int]string{
	// NOTE: AS OF 2024-05-09 NINTENDO BLOCKED /v1/api/miis
	0: "https://accountws.nintendo.net/v1/api",
	// TODO: pretendo is BLOCKING non-console clients from their site!!!!
	// as of 2024-04-21 the only check they do is blocking http 2.0
	// ...they COULD also check the headers and TLS fingerprint...
	// ... but i'll go ahead and play cat and mouse instead of mimicking a console
	// (i think they do this from a cloudflare worker so they
	// can check headers but not fingerprint)
	// this is the pretendo account subdomain for cemu
	1: "https://account.pretendo.cc/v1/api",
	// Add additional APIs as needed
}

var defaultAPIID = 0 // Default API ID to use if not specified.

const apiID0IsDisabled = true // Disable fetching NNIDs from NNAS since it is shut down

// strategy to normalize nnids
type normalizationFunc func(string) string

var normalizationFuncs = map[int]normalizationFunc{
	// nintendo normalization
	0: normalizeDashUnderscoreDot,
	// pnid normalization
	1: strings.ToLower,
}

type NNIDToPID struct {
	// nnid is normalized in the database
	NNID  string `gorm:"primaryKey;column:nnid"`
	PID   uint64 `gorm:"not null;column:pid"`
	APIID int    `gorm:"primaryKey;not null"`
}
type CachedResult struct {
	ID             uint      `gorm:"primaryKey"`
	PID            uint64    `gorm:"index;not null;column:pid"`
	Result         string    `gorm:"not null"`
	DateFetched    time.Time `gorm:"not_null"`
	DateLastLatest time.Time `gorm:"not_null"`
	APIID          int       `gorm:"not null"`
}

// to be defined in main
var nnidToMiiDataTable string

// alternative to fetching mii data, intended for nintendo
type NNIDToMiiDataMap struct {
	// NOTE: this value is int(11), signed in masscsv2db-june.py
	PID uint64 `gorm:"primaryKey;column:pid"`
	// nnid to search with
	NormalizedNNID string `gorm:"size:16;column:normalized_nnid;index:ix_normalized_nnid"`
	NNID           string `gorm:"size:16;column:nnid"`
	// FFSD / sizeof FFLStoreData
	Data         []byte    `gorm:"size:96;not null"`
	LastModified time.Time `gorm:"not null;default:current_timestamp"`
}

func (NNIDToMiiDataMap) TableName() string {
	// otherwise gorm will pluralize it and
	// and it will be very wrong and cringe
	return nnidToMiiDataTable
}

func normalizeDashUnderscoreDot(nnid string) string {
	// Normalize NNID by removing '-', '_', '.', and converting to lowercase
	// the NNAS server will match NNIDs regardless of any of these
	// the original name is in the mii result
	nnid = strings.ToLower(nnid)
	nnid = strings.ReplaceAll(nnid, "-", "")
	nnid = strings.ReplaceAll(nnid, "_", "")
	nnid = strings.ReplaceAll(nnid, ".", "")
	return nnid
}

// nnids can have dashes, underscores, and dots
// the lower char limit is technically 6
// but if you add those chars you can get to 4 (or lower but)
var validNNIDRegex = regexp.MustCompile(`^[0-9a-zA-Z\-_.]{4,16}$`)

type MappedIDsResponse struct {
	MappedIDs []struct {
		OutID string `json:"out_id" xml:"out_id"`
	} `json:"mapped_ids" xml:"mapped_id"`
}

type MiisResponse struct {
	XMLName xml.Name `xml:"miis" json:"-"`
	// multiple mii objects
	Miis []struct {
		// NOTE: NO "images"
		// also excluding ID, Primary
		Data   string `xml:"data" json:"data"`
		Name   string `xml:"name" json:"name"`
		PID    uint64 `xml:"pid" json:"pid"`
		UserID string `xml:"user_id" json:"user_id"`
	} `xml:"mii" json:"miis"`
}

// cache db
var cdb *gorm.DB

// nnid to mii data map db
var mdb *gorm.DB

var nnasRequestTransport = &http.Transport{
	TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	// forces http 1.1
	TLSNextProto: map[string]func(string, *tls.Conn) http.RoundTripper{},
}

var useNNIDToMiiMapForAPI0 bool

var gormLogger = logger.New(
	log.New(os.Stdout, "\r\n", log.LstdFlags), // io writer
	logger.Config{
		SlowThreshold:             time.Second,   // Slow SQL threshold
		LogLevel:                  logger.Silent, // Log level
		IgnoreRecordNotFoundError: true,          // Ignore ErrRecordNotFound error for logger
	},
)
var gormConfig = gorm.Config{
	Logger: gormLogger,
}

func initNNIDFetchDatabases(cache gorm.Dialector, n2mm gorm.Dialector) {
	var err error
	cdb, err = gorm.Open(cache, &gormConfig)
	if err != nil {
		log.Fatalln("Failed to connect cache database:", err)
	}
	cdb.AutoMigrate(&NNIDToPID{}, &CachedResult{})

	// optionally initialize nnid to mii cache db
	// think this will check whether gorm.Dialector is populated
	if n2mm != nil {
		// database is defined?
		// then it is used in place of fetching api 0
		useNNIDToMiiMapForAPI0 = true

		mdb, err = gorm.Open(n2mm, &gormConfig)
		if err != nil {
			log.Fatalln("Failed to connect NNID to Mii mapping database:", err)
			// fatal = database will not be used
			// because the program will have crashed
		}
	}
}

var (
	errNNIDAPIIDNotRecognized   = errors.New("API ID not in apiBases")
	errNNIDAPIID0IsDisabled     = errors.New("nintendo shut down their nnid api in may 2024 so this will not work unless you set up the nnid archive, view the nwf-mii-cemu-toy ffl-renderer-proto-integrate README for more information")
	errNNIDNoNormalizationFunc  = errors.New("no normalization function defined in normalizationFuncs for this API ID")
	errNNIDDoesNotExist         = errors.New("NNID does not exist")
	errNNIDNoMiiDataFound       = errors.New("no Mii data found")
	errMultipleOctetStream      = errors.New("application/octet-stream is only supported for single lookup requests")
	errInvalidPID               = errors.New("pid must be a number")
	errInvalidAPIID             = errors.New("api_id must be a number")
	errFailedLookupTemplate     = "failed looking up %s: %s"

)

func nnasHTTPRequest(endpoint string, apiID int) ([]byte, error) {
	base, exists := apiBases[apiID]
	if !exists {
		return nil, errNNIDAPIIDNotRecognized
	}

	client := &http.Client{Transport: nnasRequestTransport}
	req, err := http.NewRequest("GET", base+endpoint, nil)
	if err != nil {
		return nil, err
	}

	// request application/json but most non-nintendo servers only do xml
	req.Header.Set("Accept", "application/json")
	req.Header.Set("X-Nintendo-Client-ID", "a2efa818a34fa16b8afbc8a74eba3eda")
	req.Header.Set("X-Nintendo-Client-Secret", "c91cdb5658bd4954ade78533a339cf9a")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	return io.ReadAll(resp.Body)
}

func fetchNNIDToPID(nnid string, apiID int) (uint64, error) {
	var mapping NNIDToPID

	// Select the appropriate normalization function based on API ID
	normalizeNNIDFunc, exists := normalizationFuncs[apiID]
	if !exists {
		log.Println("no normalization func for api id ", apiID)
		return 0, errNNIDNoNormalizationFunc
	}

	normalizedNNID := normalizeNNIDFunc(nnid)
	if result := cdb.Where("nnid = ? AND api_id = ?", normalizedNNID, apiID).First(&mapping); result.Error == nil {
		return mapping.PID, result.Error
	}

	if apiID == 0 && apiID0IsDisabled { // nintendo nnid fetch disabled
		return 0, errNNIDAPIID0IsDisabled
	}

	body, err := nnasHTTPRequest("/admin/mapped_ids?input_type=user_id&output_type=pid&input="+nnid, apiID)
	if err != nil {
		return 0, err
	}

	var response MappedIDsResponse
	if body[0] == '{' { // Guessing it's JSON
		err = json.Unmarshal(body, &response)
	} else {
		err = xml.Unmarshal(body, &response)
	}
	if err != nil {
		if err.Error() == encodingXMLErrorThrownWhenAccountWSReturnsHTML {
			return 0, fmt.Errorf("i think the account server is returning html instead of data: %v", err)
		}
		return 0, err
	}

	if len(response.MappedIDs) == 0 || response.MappedIDs[0].OutID == "" {
		return 0, errNNIDDoesNotExist
	}

	pid, _ := strconv.ParseUint(response.MappedIDs[0].OutID, 10, 64)
	// place normalized NNID in the database
	cdb.Create(&NNIDToPID{NNID: normalizedNNID, PID: pid, APIID: apiID})

	return pid, nil
}

func fetchMiiFromPID(pid uint64, apiID int, forceRefresh bool) (MiisResponse, error) {
	now := time.Now()
	var cache CachedResult

	// Attempt to fetch from cache unless forceRefresh is true
	// AddDate call: one day
	// NOTE: this IGNORES ERRORS
	var whereClause *gorm.DB
	// TODO: MAKE LESS HACKY!!! BUT ALWAYS USE NNAS CACHE FOR NINTENDO
	if apiID == 0 && apiID0IsDisabled { // fetch nnid miis from all time
		whereClause = cdb.Where("pid = ? AND api_id = ?" /* AND date_last_latest > ?"*/, pid, apiID /*now.AddDate(0, -1, 0)*/)
	} else {
		whereClause = cdb.Where("pid = ? AND api_id = ? AND date_last_latest > ?", pid, apiID, now.AddDate(0, -1, 0))
	}

	shouldFetch := forceRefresh || whereClause.First(&cache).Error != nil

	var miiResponse MiisResponse

	var result string
	if shouldFetch {
		if apiID == 0 && apiID0IsDisabled { // nintendo nnid fetch disabled
			return MiisResponse{}, errNNIDAPIID0IsDisabled
		}

		// Fetch from HTTP and update cache
		body, err := nnasHTTPRequest(fmt.Sprintf("/miis?pids=%d", pid), apiID)
		if err != nil {
			return miiResponse, err
		}
		result = string(body)

		// Update cache
		if cdb.Where("pid = ? AND api_id = ?", pid, apiID).First(&cache).Error != nil {
			cache = CachedResult{PID: pid, DateFetched: now, DateLastLatest: now, APIID: apiID}
		}
		cache.Result = result
		cache.DateFetched = now
		cache.DateLastLatest = now
		cdb.Save(&cache)
	} else {
		// Use cached result
		result = cache.Result
	}

	// Decode result to extract the data field, default to XML, check if it's JSON

	// TODO: usually the response returns nothing when it also
	// returns an error like 404 or 410 that indicates acc deleted among others
	if len(result) > 0 {
		// TODO: should this be nested? i am doing it to preserve
		// the exact same error at the bottom
		if result[0] == '{' { // Guessing it's JSON
			if err := json.Unmarshal([]byte(result), &miiResponse); err != nil {
				return miiResponse, err
			}
		} else {
			if err := xml.Unmarshal([]byte(result), &miiResponse); err != nil {
				if err.Error() == encodingXMLErrorThrownWhenAccountWSReturnsHTML {
					return MiisResponse{},
						fmt.Errorf("i think the account server is returning html instead of data: %v", err)
				}
				return miiResponse, err
			}
		}
	}

	// Check if we have at least one Mii and return the data
	if len(miiResponse.Miis) > 0 {
		//return miiResponse.Miis[0].Data, nil
		// now return entire response rather than just data base64
		return miiResponse, nil
	}

	return miiResponse, errNNIDNoMiiDataFound
}

// inspired by NNIDLT, kind of
type ResponseData struct {
	Data   string `json:"data"`
	Images struct {
		// this is only a pointer so that omitempty will work
		LastModified *time.Time `json:"last_modified,omitempty"`
	} `json:"images"`
	Name          string `json:"name"`
	PID           uint64 `json:"pid"`
	StudioURLData string `json:"studio_url_data"`
	UserID        string `json:"user_id"`
	Error         string `json:"error,omitempty"`
}

func setCORSHeaders(w http.ResponseWriter, r *http.Request) {
	header := w.Header()
	header.Set("Access-Control-Allow-Private-Network", "true")
	header.Set("Access-Control-Allow-Origin", "*")
	header.Set("Access-Control-Allow-Headers", "Accept")
	header.Set("Access-Control-Expose-Headers", "Last-Modified")
	if r.Method == "OPTIONS" {
		// do not return any text on OPTIONS and preflight headers were already sent
		return
	}
}

const encodingXMLErrorThrownWhenAccountWSReturnsHTML = "expected element type <miis> but have <html>"

func handleMiiDataResponse(w http.ResponseWriter, data interface{}, miiDataBytes []byte, acceptsOctetStream bool, lastModified time.Time) {
	header := w.Header()

	// set last modified only if it is defined
	if !lastModified.IsZero() {
		header.Set("Last-Modified", lastModified.Format(http.TimeFormat))
	}

	if acceptsOctetStream {
		// octet stream = need raw bytes
		// Ensure that only single lookup is processed for octet-stream
		switch data.(type) {
		case ResponseData: // assuming miiDataBytes is not nil
			w.Write(miiDataBytes)
		case []ResponseData:
			// For multiple lookups, octet-stream is not supported
			http.Error(w, errMultipleOctetStream.Error(), http.StatusBadRequest)
			return
		default:
			http.Error(w, "Invalid data type for octet-stream", http.StatusInternalServerError)
			return
		}
	} else {
		response, err := json.Marshal(data)
		if err != nil {
			http.Error(w, "Failed to marshal JSON: "+err.Error(), http.StatusInternalServerError)
			return
		}
		header.Set("Content-Type", "application/json; charset=UTF-8")
		w.Write(response)
		return
	}
}

func retrieveMiiDataFromNNIDOrPID(nnid string, pid int64, apiID int, acceptsOctetStream bool, forceRefresh bool) (ResponseData, *[]byte, time.Time, error) {
	var data ResponseData
	var lastModified time.Time
	var miiDataBytes *[]byte

	if useNNIDToMiiMapForAPI0 && apiID == 0 {
		// Lookup by PID if it's provided (not -1), otherwise lookup by NNID
		var miiData NNIDToMiiDataMap
		if pid != -1 { // look up PID in archive
			result := mdb.Model(&miiData).Where("pid = ?", pid).First(&miiData)
			if result.Error != nil {
				if result.Error == gorm.ErrRecordNotFound {
					return data, nil, lastModified, errors.New("PID not found in archive")
				} else {
					return data, nil, lastModified, result.Error
				}
			}
		} else { // look up NNID in archive
			nnid = normalizeDashUnderscoreDot(nnid)
			result := mdb.Model(&miiData).Where("normalized_nnid = ?", nnid).First(&miiData)
			if result.Error != nil {
				if result.Error == gorm.ErrRecordNotFound {
					return data, nil, lastModified, errors.New("NNID not found in archive")
				} else {
					return data, nil, lastModified, result.Error
				}
			}
		}

		// nnidtomiidatamap contains binary data
		miiDataBytes = &miiData.Data
		lastModified = miiData.LastModified

		// only set other props if this is NOT simple octet stream
		if !acceptsOctetStream {
			data.StudioURLData = mii2studio.Map3DSStoreDataToStudioURLData(miiData.Data)
			data.PID = miiData.PID
			data.UserID = miiData.NNID
			data.Name = utf16LESliceToString(miiData.Data[0x1a : 0x1a+0x14])
		}
	} else { // look up NNID without database
		// Pass pid if it's not -1, otherwise lookup with nnid
		var fetchedPID uint64
		var err error
		if pid == -1 {
			fetchedPID, err = fetchNNIDToPID(nnid, apiID)
		} else {
			fetchedPID = uint64(pid)
		}
		if err != nil {
			//http.Error(w, "error resolving nnid to pid: "+err.Error(), http.StatusInternalServerError)
			return data, nil, lastModified, err
		}

		miiResponse, err := fetchMiiFromPID(fetchedPID, apiID, forceRefresh)
		if err != nil {
			//http.Error(w, "error fetching mii after resolving pid: "+err.Error(), http.StatusInternalServerError)
			return data, nil, lastModified, err
		}

		// base64 mii data
		data.Data = miiResponse.Miis[0].Data

		if !acceptsOctetStream {
			// decode base64 mii
			var storeData []byte
			storeData, err = base64.StdEncoding.DecodeString(miiResponse.Miis[0].Data)
			if err == nil {
				data.StudioURLData = mii2studio.Map3DSStoreDataToStudioURLData(storeData)
			}

			data.Name = miiResponse.Miis[0].Name
			data.PID = miiResponse.Miis[0].PID
			data.UserID = miiResponse.Miis[0].UserID
		}
	}

	return data, miiDataBytes, lastModified, nil
}

func nnidLookupHandler(w http.ResponseWriter, r *http.Request) {
	setCORSHeaders(w, r)

	parts := strings.Split(r.URL.Path, "/")
	query := r.URL.Query()

	// Extract NNID from path if present
	var pathNNIDs []string
	if len(parts) >= 3 && parts[2] != "" {
		pathNNIDs = append(pathNNIDs, parts[2])
	}

	// Extract NNIDs from query parameter 'nnid'
	queryNNIDs := strings.Split(query.Get("nnid"), ",")
	// Remove empty strings
	var filteredQueryNNIDs []string
	for _, nnid := range queryNNIDs {
		nnid = strings.TrimSpace(nnid)
		if nnid != "" {
			filteredQueryNNIDs = append(filteredQueryNNIDs, nnid)
		}
	}

	// Combine NNIDs from path and query
	allNNIDs := append(pathNNIDs, filteredQueryNNIDs...)

	// Extract PIDs from query parameter 'pid'
	queryPIDs := strings.Split(query.Get("pid"), ",")
	var pids []int64
	for _, pidStr := range queryPIDs {
		pidStr = strings.TrimSpace(pidStr)
		if pidStr != "" {
			pid, err := strconv.ParseInt(pidStr, 10, 64)
			if err != nil {
				http.Error(w, errInvalidPID.Error(), http.StatusBadRequest)
				return
			}
			pids = append(pids, pid)
		}
	}

	// Extract API IDs
	// Support both global and prefixed API IDs
	globalAPIID := defaultAPIID
	if apiIDStr := query.Get("api_id"); apiIDStr != "" {
	parsedAPIID, err := strconv.Atoi(apiIDStr)
		if err != nil {
			http.Error(w, errInvalidAPIID.Error(), http.StatusBadRequest)
			return
		}
		globalAPIID = parsedAPIID
	}


	// Similarly, extract prefixed API IDs (api_id_0, api_id_1, etc.)
	apiIDs := make(map[int]int) // key: index, value: api_id
	for key, values := range query {
		if strings.HasPrefix(key, "api_id_") {
			indexStr := strings.TrimPrefix(key, "api_id_")
			index, err := strconv.Atoi(indexStr)
			if err == nil {
				apiID, err := strconv.Atoi(values[0])
				if err == nil {
					apiIDs[index] = apiID
				}
			}
		}
	}

	// If globalAPIID is set, apply to all unless overridden by prefixed
	// Similarly for force_refresh
	var forceRefreshGlobal bool
	forceRefreshStr := query.Get("force_refresh")
	if forceRefreshStr != "" && forceRefreshStr != "0" {
		forceRefreshGlobal = true
	}

	forceRefreshMap := make(map[int]bool)
	for key, values := range query {
		if !strings.HasPrefix(key, "force_refresh_") {
			continue
		}
		indexStr := strings.TrimPrefix(key, "force_refresh_")
		index, err := strconv.Atoi(indexStr)
		if err == nil {
			forceRefresh := values[0] != "" && forceRefreshStr != "0"
				forceRefreshMap[index] = forceRefresh
		}
	}

	// Extract Accept header
	acceptsOctetStream := r.Header.Get("Accept") == "application/octet-stream"

	// Combine all lookups: first NNIDs, then PIDs
	type Lookup struct {
		IsNNID       bool
		NNID         string
		PID          int64
		APIID        int
		ForceRefresh bool
	}

	var lookups []Lookup

	// Add NNID lookups
	for i, nnid := range allNNIDs {
		apiID := globalAPIID
		if val, exists := apiIDs[i]; exists {
			apiID = val
		}
		forceRefresh := forceRefreshGlobal
		if val, exists := forceRefreshMap[i]; exists {
			forceRefresh = val
		}
		lookups = append(lookups, Lookup{
			IsNNID:       true,
			NNID:         nnid,
			PID:          -1,
			APIID:        apiID,
			ForceRefresh: forceRefresh,
		})
	}

	// Add PID lookups
	for i, pid := range pids {
		apiID := globalAPIID
		if val, exists := apiIDs[i+len(allNNIDs)]; exists { // Continue indexing after NNIDs
			apiID = val
		}
		forceRefresh := forceRefreshGlobal
		if val, exists := forceRefreshMap[i+len(allNNIDs)]; exists {
			forceRefresh = val
		}
		lookups = append(lookups, Lookup{
			IsNNID:       false,
			NNID:         "",
			PID:          pid,
			APIID:        apiID,
			ForceRefresh: forceRefresh,
		})
	}

	// If Accept is octet-stream and more than one lookup is requested, return error
	if acceptsOctetStream && len(lookups) > 1 {
		http.Error(w, errMultipleOctetStream.Error(), http.StatusBadRequest)
		return
	}

	if len(lookups) < 1 {
		http.Error(w, `usage: /mii_data/(nnid)

you can also use ?nnid= as a substitute for the path param or ?pid= to specify a pid
you can specify multiple of each by comma separating the values
use ?api_id=1 for pretendo`, http.StatusBadRequest)
		return
	}

	// NOTE: queries could also be limited based on time or source
	if len(lookups) > 200 { // should probably be less than this
		http.Error(w, "too many queries", http.StatusBadRequest)
		return
	}

	// Prepare response
	var responseData []interface{} // usually ResponseData
	var responseBytes [][]byte
	var lastModifiedTimes []time.Time
	var finalError error

	for _, lookup := range lookups {
		var data ResponseData
		var miiDataBytes *[]byte
		var lastModified time.Time

		if lookup.IsNNID {
			data, miiDataBytes, lastModified, finalError = retrieveMiiDataFromNNIDOrPID(lookup.NNID, lookup.PID, lookup.APIID, acceptsOctetStream, lookup.ForceRefresh)
		} else {
			data, miiDataBytes, lastModified, finalError = retrieveMiiDataFromNNIDOrPID("", lookup.PID, lookup.APIID, acceptsOctetStream, lookup.ForceRefresh)
		}

		if finalError != nil {
			errorMessage := fmt.Sprintf(errFailedLookupTemplate,
				func() string {
					if lookup.IsNNID {
						return fmt.Sprintf("nnid=%s", lookup.NNID)
					}
					return fmt.Sprintf("pid=%d", lookup.PID)
				}(),
				finalError.Error())


			if acceptsOctetStream {
				http.Error(w, errorMessage, http.StatusInternalServerError)
				return
			}


			// Append error response with details
			responseData = append(responseData, map[string]string{
				"error": errorMessage,
			})

		} else if !acceptsOctetStream && data.Data == "" && miiDataBytes != nil {
			// if there is no base64 data but there IS binary data...
			data.Data = base64.StdEncoding.EncodeToString(*miiDataBytes)
		}

		if miiDataBytes != nil {
			responseBytes = append(responseBytes, *miiDataBytes)
		} else {
			responseBytes = append(responseBytes, []byte{})
		}

		if finalError == nil {
			lastModifiedTimes = append(lastModifiedTimes, lastModified)
			if !lastModified.IsZero() {
				data.Images.LastModified = &lastModified
			} // otherwise it will be undefined/nil/excluded
			responseData = append(responseData, data)
		} else {
			lastModifiedTimes = append(lastModifiedTimes, time.Time{})
		}
	}
	// end of loop, send back data

	if /*acceptsOctetStream &&*/ len(responseData) == 1 {
		// return single
		handleMiiDataResponse(w, responseData[0], responseBytes[0], acceptsOctetStream, lastModifiedTimes[0])
	} else if acceptsOctetStream {
		http.Error(w, "multiple responses were received but cannot return multiple for octet-stream", http.StatusInternalServerError)
		return
	} else {
		handleMiiDataResponse(w, responseData, nil, acceptsOctetStream, time.Time{})
	}
}

func randomNNIDHandler(w http.ResponseWriter, r *http.Request) {
	setCORSHeaders(w, r)

	// Set the headers to prevent caching
	w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expires", "0")

	query := r.URL.Query()
	seedStr := query.Get("seed")

	// should be zero if it is invalid, otherwise int64
	seed, err := strconv.ParseInt(seedStr, 10, 64)
	if seedStr != "" && err != nil {
		http.Error(w, "seed has to be a number", http.StatusBadRequest)
		return
	}

	if !useNNIDToMiiMapForAPI0 {
		http.Error(w, "this endpoint is not available because the nnid to mii map database isn't being used sorry", http.StatusServiceUnavailable)
		return
	}

	// Fetch min and max pid
	var minPID, maxPID uint64
	// TODO TODO: GET TABLE NAME IN A BETTER WAY
	// TODO: SHOULD ALSO BE INITIALIZED AT BEGINNING MAYBE IDK
	mdb.Raw("SELECT MIN(pid) FROM " + nnidToMiiDataTable).Scan(&minPID)
	mdb.Raw("SELECT MAX(pid) FROM " + nnidToMiiDataTable).Scan(&maxPID)

	randomPIDInput := int64(maxPID - minPID)
	var randomPIDPre int64
	if seed != 0 {
		// use seed if it is valid
		rng := rand.New(rand.NewSource(seed))
		randomPIDPre = rng.Int63n(randomPIDInput)
	} else {
		randomPIDPre = rand.Int63n(randomPIDInput)
	}
	randomPID := minPID + uint64(randomPIDPre)

	var miiData NNIDToMiiDataMap
	result := mdb.Where("pid >= ?", randomPID).Order("pid ASC").First(&miiData)
	if result.Error != nil {
		http.Error(w, "Failed to retrieve random NNID", http.StatusInternalServerError)
		return
	}

	acceptsOctetStream := r.Header.Get("Accept") == "application/octet-stream"
	var data ResponseData
	var lastModified time.Time
	lastModified = miiData.LastModified

	// only set other props if this is NOT simple octet stream
	if !acceptsOctetStream {
		data.StudioURLData = mii2studio.Map3DSStoreDataToStudioURLData(miiData.Data)
		data.PID = miiData.PID
		data.UserID = miiData.NNID
		data.Name = utf16LESliceToString(miiData.Data[0x1a : 0x1a+0x14])
	}

	handleMiiDataResponse(w, data, miiData.Data, acceptsOctetStream, lastModified)
}

func utf16LESliceToString(utf16Data []byte) string {
	// Convert UTF-16 LE to a slice of uint16
	u16s := make([]uint16, len(utf16Data)/2)
	for i := 0; i < len(u16s); i++ {
		u16s[i] = uint16(utf16Data[2*i]) | uint16(utf16Data[2*i+1])<<8
	}
	// Find the null terminator
	nullIndex := -1
	for i, v := range u16s {
		if v == 0 {
			nullIndex = i
			break
		}
	}
	// If null terminator is found, slice up to that point
	if nullIndex != -1 {
		u16s = u16s[:nullIndex]
	}
	// Convert UTF-16 to UTF-8
	runes := utf16.Decode(u16s)
	var utf8Buf bytes.Buffer
	for _, r := range runes {
		utf8Buf.WriteRune(r)
	}
	return utf8Buf.String()
}
