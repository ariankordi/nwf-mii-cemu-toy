package main

import (
	"net/http"

	"encoding/json"

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

const nnasAPIBase = "https://accountws.nintendo.net/v1/api"

type NNIDToPID struct {
	// nnid is normalized in the database
	NNID string `gorm:"primaryKey;column:nnid"`
	PID  int64  `gorm:"not null;column:pid"`
}
type CachedResult struct {
	ID             uint      `gorm:"primaryKey"`
	PID            int64     `gorm:"index;not null;column:pid"`
	Result         string    `gorm:"not null"`
	DateFetched    time.Time `gorm:"not_null"`
	DateLastLatest time.Time `gorm:"not_null"`
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

var db *gorm.DB

func initNNASCacheDB() {
	var err error
	db, err = gorm.Open(sqlite.Open("nnas_cache_b4.db"), &gorm.Config{})
	if err != nil {
		log.Fatalln("Failed to connect database:", err)
	}
	db.AutoMigrate(&NNIDToPID{}, &CachedResult{})
}

func nnasHTTPRequest(endpoint string) ([]byte, error) {
	client := &http.Client{}
	req, err := http.NewRequest("GET", nnasAPIBase+endpoint, nil)
	if err != nil {
		return nil, err
	}

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

func fetchNNIDToPID(nnid string) (int64, error) {
	var mapping NNIDToPID

	normalizedNNID := normalizeNNID(nnid)
	if db.Where("nnid = ?", normalizedNNID).First(&mapping).Error == nil {
		return mapping.PID, nil
	}

	body, err := nnasHTTPRequest("/admin/mapped_ids?input_type=user_id&output_type=pid&input=" + nnid)
	if err != nil {
		return 0, err
	}

	var response struct {
		MappedIDs []struct {
			OutID string `json:"out_id"`
		} `json:"mapped_ids"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return 0, err
	}

	if len(response.MappedIDs) == 0 || response.MappedIDs[0].OutID == "" {
		return 0, fmt.Errorf("NNID does not exist")
	}

	pid, _ := strconv.ParseInt(response.MappedIDs[0].OutID, 10, 64)
	// place normalized NNID in the database
	db.Create(&NNIDToPID{NNID: normalizedNNID, PID: pid})

	return pid, nil
}

func fetchMii(pid int64, forceRefresh bool) (string, error) {
	now := time.Now()

	var cache CachedResult
	if !forceRefresh &&
		// one day
		db.Where("pid = ? AND date_last_latest > ?", pid, now.AddDate(0, 0, -1)).First(&cache).Error == nil {
		var miiData struct {
			Miis []struct {
				Data string `json:"data"`
			} `json:"miis"`
		}
		json.Unmarshal([]byte(cache.Result), &miiData)
		if len(miiData.Miis) > 0 {
			return miiData.Miis[0].Data, nil
		}
	}

	body, err := nnasHTTPRequest("/miis?pids=" + strconv.FormatInt(pid, 10))
	if err != nil {
		return "", err
	}

	if db.Where("pid = ?", pid).First(&cache).Error != nil {
		cache = CachedResult{PID: pid, DateFetched: now, DateLastLatest: now}
	}
	cache.Result = string(body)
	db.Save(&cache)

	var miiData struct {
		Miis []struct {
			Data string `json:"data"`
		} `json:"miis"`
	}
	json.Unmarshal(body, &miiData)
	if len(miiData.Miis) > 0 {
		return miiData.Miis[0].Data, nil
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
	forceRefresh, _ := strconv.ParseBool(query.Get("force_refresh"))

	pid, err := fetchNNIDToPID(nnid)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	miiData, err := fetchMii(pid, forceRefresh)
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
