package main

import (
	"net/http"

	"encoding/json"
	"encoding/xml"

	"regexp"
	"strconv"
	"strings"

	"io"
	"time"

	"fmt"
	"log"

	// PURELY just for nnid cache
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var apiBases = map[int]string{
	0: "https://accountws.nintendo.net/v1/api",
	1: "https://account.pretendo.cc/v1/api",
	// Add additional APIs as needed
}

type NNIDToPID struct {
	// nnid is normalized in the database
	NNID  string `gorm:"primaryKey;column:nnid"`
	PID   int64  `gorm:"not null;column:pid"`
	APIID int    `gorm:"primaryKey;not null"`
}
type CachedResult struct {
	ID             uint      `gorm:"primaryKey"`
	PID            int64     `gorm:"index;not null;column:pid"`
	Result         string    `gorm:"not null"`
	DateFetched    time.Time `gorm:"not_null"`
	DateLastLatest time.Time `gorm:"not_null"`
	APIID          int       `gorm:"not null"`
}

func normalizeNNID(nnid string) string {
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

type MiiDataResponse struct {
	Miis []struct {
		Data string `json:"data" xml:"data"`
	} `json:"miis" xml:"mii"`
}

var db *gorm.DB

func initNNASCacheDB() {
	var err error
	db, err = gorm.Open(sqlite.Open("nnas_cache_b4_multi.db"), &gorm.Config{})
	if err != nil {
		log.Fatalln("Failed to connect database:", err)
	}
	db.AutoMigrate(&NNIDToPID{}, &CachedResult{})
}

func nnasHTTPRequest(endpoint string, apiID int) ([]byte, error) {
	base, exists := apiBases[apiID]
	if !exists {
		return nil, fmt.Errorf("API ID %d not recognized", apiID)
	}

	client := &http.Client{}
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

func fetchNNIDToPID(nnid string, apiID int) (int64, error) {
	var mapping NNIDToPID

	normalizedNNID := normalizeNNID(nnid)
	if db.Where("nnid = ? AND api_id = ?", normalizedNNID, apiID).First(&mapping).Error == nil {
		return mapping.PID, nil
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
		return 0, fmt.Errorf("NNID does not exist")
	}

	pid, _ := strconv.ParseInt(response.MappedIDs[0].OutID, 10, 64)
	// place normalized NNID in the database
	db.Create(&NNIDToPID{NNID: normalizedNNID, PID: pid, APIID: apiID})

	return pid, nil
}

func fetchMii(pid int64, apiID int, forceRefresh bool) (string, error) {
	now := time.Now()
	var cache CachedResult

	// Attempt to fetch from cache unless forceRefresh is true
	// AddDate call: one day
	shouldFetch := forceRefresh || db.Where("pid = ? AND api_id = ? AND date_last_latest > ?", pid, apiID, now.AddDate(0, -1, 0)).First(&cache).Error != nil

	var result string
	if shouldFetch {
		// Fetch from HTTP and update cache
		body, err := nnasHTTPRequest(fmt.Sprintf("/miis?pids=%d", pid), apiID)
		if err != nil {
			return "", err
		}
		result = string(body)

		// Update cache
		if db.Where("pid = ? AND api_id = ?", pid, apiID).First(&cache).Error != nil {
			cache = CachedResult{PID: pid, DateFetched: now, DateLastLatest: now, APIID: apiID}
		}
		cache.Result = result
		cache.DateFetched = now
		cache.DateLastLatest = now
		db.Save(&cache)
	} else {
		// Use cached result
		result = cache.Result
	}

	// Decode result to extract the data field, default to XML, check if it's JSON
	var miiResponse MiiDataResponse
	// TODO: usually the response returns nothing when it also
	// returns an error like 404 or 410 that indicates acc deleted among others
	if len(result) > 0 {
		// TODO: should this be nested? i am doing it to preserve
		// the exact same Errorf at the bottom
		if result[0] == '{' { // Guessing it's JSON
			if err := json.Unmarshal([]byte(result), &miiResponse); err != nil {
				return "", err
			}
		} else {
			if err := xml.Unmarshal([]byte(result), &miiResponse); err != nil {
				return "", err
			}
		}
	}

	// Check if we have at least one Mii and return the data
	if len(miiResponse.Miis) > 0 {
		return miiResponse.Miis[0].Data, nil
	}

	return "", fmt.Errorf("no Mii data found")
}

func miiHandler(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) != 3 || parts[2] == "" {
		http.Error(w, "usage: /mii_data/(nnid here)", http.StatusBadRequest)
		return
	}
	nnid := parts[2]

	query := r.URL.Query()
	apiID, _ := strconv.Atoi(query.Get("api_id"))
	forceRefresh, _ := strconv.ParseBool(query.Get("force_refresh"))

	pid, err := fetchNNIDToPID(nnid, apiID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	miiData, err := fetchMii(pid, apiID, forceRefresh)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Write([]byte(miiData))
}

/*
func main() {
    initDB()
    http.HandleFunc("/mii", miiHandler)
    fmt.Println("Server started")
    log.Fatal(http.ListenAndServe(":8069", nil))
}
*/
