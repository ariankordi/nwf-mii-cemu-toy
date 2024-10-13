package main

import (
	"crypto/tls"
	"errors"
	"math/rand"
	"net/http"

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

	"bytes"
	"processor-go/mii2studio"
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
// strategy to normalize nnids
type normalizationFunc func(string) string
var normalizationFuncs = map[int]normalizationFunc {
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
	PID            uint64    `gorm:"primaryKey;column:pid"`
	// nnid to search with
	NormalizedNNID string    `gorm:"size:16;column:normalized_nnid;index:ix_normalized_nnid"`
	NNID           string    `gorm:"size:16;column:nnid"`
	// FFSD / sizeof FFLStoreData
	Data           []byte    `gorm:"size:96;not null"`
	LastModified   time.Time `gorm:"not null;default:current_timestamp"`
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
	Miis    []struct {
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
	TLSNextProto: map[string]func(string, *tls.Conn)http.RoundTripper{},
}

var useNNIDToMiiMapForAPI0 bool

func initNNIDFetchDatabases(cache gorm.Dialector, n2mm gorm.Dialector) {
	var err error
	cdb, err = gorm.Open(cache, &gorm.Config{})
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

		mdb, err = gorm.Open(n2mm, &gorm.Config{})
		if err != nil {
			log.Fatalln("Failed to connect NNID to Mii mapping database:", err)
			// fatal = database will not be used
			// because the program will have crashed
		}
	}
}


var (
	errNNIDAPIIDNotRecognized   = errors.New("API ID not in apiBases")
	errNNIDNoNormalizationFunc  = errors.New("no normalization function defined in normalizationFuncs for this API ID")
	errNNIDDoesNotExist     = errors.New("NNID does not exist")
	errNNIDNoMiiDataFound       = errors.New("no Mii data found")
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
		err := errNNIDNoNormalizationFunc
		log.Println(err)
		return 0, err
	}

	normalizedNNID := normalizeNNIDFunc(nnid)
	if result := cdb.Where("nnid = ? AND api_id = ?", normalizedNNID, apiID).First(&mapping); result.Error == nil {
		return mapping.PID, result.Error
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


func fetchMii(pid uint64, apiID int, forceRefresh bool) (MiisResponse, error) {
	now := time.Now()
	var cache CachedResult

	// Attempt to fetch from cache unless forceRefresh is true
	// AddDate call: one day
	// NOTE: this IGNORES ERRORS
	var whereClause *gorm.DB
	// TODO: MAKE LESS HACKY!!! BUT ALWAYS USE NNAS CACHE FOR NINTENDO
	if apiID == 0 {
		whereClause = cdb.Where("pid = ? AND api_id = ?"/* AND date_last_latest > ?"*/, pid, apiID /*now.AddDate(0, -1, 0)*/)
	} else {
		whereClause = cdb.Where("pid = ? AND api_id = ? AND date_last_latest > ?", pid, apiID, now.AddDate(0, -1, 0))
	}

	shouldFetch := forceRefresh || whereClause.First(&cache).Error != nil

	var miiResponse MiisResponse

	var result string
	if shouldFetch {
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
	Data          string `json:"data"`
	Images        struct {
		// this is only a pointer so that omitempty will work
		LastModified *time.Time `json:"last_modified,omitempty"`
	} `json:"images"`
	Name          string `json:"name"`
	PID           uint64 `json:"pid"`
	StudioURLData string `json:"studio_url_data"`
	UserID        string `json:"user_id"`
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


func handleMiiDataResponse(w http.ResponseWriter, data ResponseData, miiDataBytes *[]byte, acceptsOctetStream bool, lastModified time.Time) {
	header := w.Header()

	// set last modified only if it is defined
	if !lastModified.IsZero() {
		header.Set("Last-Modified", lastModified.Format(http.TimeFormat))
	}

	if acceptsOctetStream {
		// octet stream = need raw bytes
		w.Write(*miiDataBytes)
	} else {
		if !lastModified.IsZero() {
			data.Images.LastModified = &lastModified
		} // otherwise it will be undefined/nil/excluded

		// consuming base64 mii data...
		// if there is no base64 data but there IS binary data...
		if data.Data == "" && miiDataBytes != nil {
			data.Data = base64.StdEncoding.EncodeToString(*miiDataBytes)
		}
		response, err := json.Marshal(data)
		if err != nil {
			http.Error(w, "Failed to marshal JSON", http.StatusInternalServerError)
			return
		}
		header.Set("Content-Type", "application/json; charset=UTF-8")
		w.Write(response)
	}
}

func retrieveMiiDataFromNNIDOrPID(w http.ResponseWriter, nnid string, pid int64, apiID int, acceptsOctetStream bool, forceRefresh bool) (ResponseData, *[]byte, time.Time, error) {
	var data ResponseData
	var lastModified time.Time
	var miiDataBytes *[]byte

	if useNNIDToMiiMapForAPI0 && apiID == 0 {
		// Lookup by PID if it's provided (not -1), otherwise lookup by NNID
		var miiData NNIDToMiiDataMap
		if pid != -1 {
			result := mdb.Model(&miiData).Where("pid = ?", pid).First(&miiData)
			if result.Error != nil {
				if result.Error == gorm.ErrRecordNotFound {
					http.Error(w, "PID not found in archive", http.StatusNotFound)
				} else {
					http.Error(w, result.Error.Error(), http.StatusInternalServerError)
				}
				return data, nil, lastModified, result.Error
			}
		} else {
			nnid = normalizeDashUnderscoreDot(nnid)
			result := mdb.Model(&miiData).Where("normalized_nnid = ?", nnid).First(&miiData)
			if result.Error != nil {
				if result.Error == gorm.ErrRecordNotFound {
					http.Error(w, "NNID not found in archive", http.StatusNotFound)
				} else {
					http.Error(w, result.Error.Error(), http.StatusInternalServerError)
				}
				return data, nil, lastModified, result.Error
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
	} else {
		// Pass pid if it's not -1, otherwise lookup with nnid
		var fetchedPID uint64
		if pid == -1 {
			fetchedPID, _ = fetchNNIDToPID(nnid, apiID)
		} else {
			fetchedPID = uint64(pid)
		}

		miiResponse, err := fetchMii(fetchedPID, apiID, forceRefresh)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
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

	// If a valid pid is provided, use it, otherwise -1
	pid, err := strconv.ParseInt(query.Get("pid"), 10, 64)
	if err != nil {
		pid = -1
	}

	if len(parts) != 3 || parts[2] == "" && pid == -1 {
		http.Error(w, "usage: " + nnidLookupHandlerPrefix + "(nnid)", http.StatusBadRequest)
		return
	}
	nnid := parts[2]

	apiID, _ := strconv.Atoi(query.Get("api_id"))
	acceptsOctetStream := r.Header.Get("Accept") == "application/octet-stream"

	// retrieve mii data based on nnid or pid
	forceRefresh, _ := strconv.ParseBool(query.Get("force_refresh"))
	data, miiDataBytes, lastModified, err := retrieveMiiDataFromNNIDOrPID(w, nnid, pid, apiID, acceptsOctetStream, forceRefresh)
	if err != nil {
		return
	}

	if acceptsOctetStream && miiDataBytes == nil {
		var miiDataBytesTmp []byte
		miiDataBytesTmp, err = base64.StdEncoding.DecodeString(data.Data)
		if err != nil {
			http.Error(w, "Failed to decode base64 data", http.StatusInternalServerError)
			return
		}
		miiDataBytes = &miiDataBytesTmp
	}

	handleMiiDataResponse(w, data, miiDataBytes, acceptsOctetStream, lastModified)
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

	randomPIDInput := int64(maxPID-minPID)
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

	handleMiiDataResponse(w, data, &miiData.Data, acceptsOctetStream, lastModified)
}

func utf16LESliceToString(utf16Data []byte) string {
	// Convert UTF-16 LE to a slice of uint16
	u16s := make([]uint16, 10)
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
