package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"gorm.io/gorm"
)

// removalRateLimiter tracks a global hourly removal request count.
// It is not per-IP — the limit is site-wide to prevent abuse.
type removalRateLimiter struct {
	mu        sync.Mutex
	count     int
	windowEnd time.Time
}

// RemovalHourlyLimit is the maximum number of NNID removals allowed per hour.
const RemovalHourlyLimit = 8

var globalRemovalLimiter = &removalRateLimiter{}

// allow returns true if a request is within the rate limit, false otherwise.
// It resets the counter when the current hour window has elapsed.
func (l *removalRateLimiter) allow() bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	if now.After(l.windowEnd) {
		// Start a new one-hour window.
		l.count = 0
		l.windowEnd = now.Add(time.Hour)
	}
	if l.count >= RemovalHourlyLimit {
		return false
	}
	l.count++
	return true
}

// cfPurgeURLs calls the Cloudflare cache purge API to evict the given URLs.
func cfPurgeURLs(zoneID, apiToken string, urls []string) error {
	body, err := json.Marshal(map[string][]string{"files": urls})
	if err != nil {
		return fmt.Errorf("marshal purge body: %w", err)
	}
	endpoint := fmt.Sprintf("https://api.cloudflare.com/client/v4/zones/%s/purge_cache", zoneID)
	req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build purge request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+apiToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("purge request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("purge API returned %d: %s", resp.StatusCode, respBody)
	}
	return nil
}

// nnidRemovalHandler handles POST /nnid_remove.
// It expects a form field or JSON field "nnid", deletes the matching row from
// nnid_to_mii_data_map, and optionally purges Cloudflare cache.
//
// Parameters (injected at registration time):
//   - db: GORM database pointing at the nnid_to_mii_data_map table.
//   - cfZoneID, cfAPIToken: Cloudflare credentials (empty = disabled).
//   - publicHostname: used to build cache purge URLs (e.g. "mii-unsecure.ariankordi.net").
func nnidRemovalHandler(db *gorm.DB, cfZoneID, cfAPIToken, publicHostname string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Parse the NNID from either JSON body or form data.
		var rawNNID string
		contentType := r.Header.Get("Content-Type")
		if strings.Contains(contentType, "application/json") {
			var payload struct {
				NNID string `json:"nnid"`
			}
			if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
				http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
				return
			}
			rawNNID = payload.NNID
		} else {
			if err := r.ParseForm(); err != nil {
				http.Error(w, `{"error":"invalid form"}`, http.StatusBadRequest)
				return
			}
			rawNNID = r.FormValue("nnid")
		}

		rawNNID = strings.TrimSpace(rawNNID)
		if rawNNID == "" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte(`{"error":"nnid is required"}`))
			return
		}

		// Normalize the NNID the same way as the lookup path.
		normalizedNNID := normalizeDashUnderscoreDot(rawNNID)

		// Apply the global hourly rate limit.
		if !globalRemovalLimiter.allow() {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTooManyRequests)
			w.Write([]byte(`{"error":"hourly removal limit reached, please try again later"}`))
			return
		}

		// Confirm the row exists before attempting deletion.
		var existing NNIDToMiiDataMap
		result := db.Where("normalized_nnid = ?", normalizedNNID).First(&existing)
		if result.Error != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			w.Write([]byte(`{"error":"NNID not found in database"}`))
			return
		}

		// Delete the row.
		/*
		if err := db.Where("normalized_nnid = ?", normalizedNNID).Delete(&NNIDToMiiDataMap{}).Error; err != nil {
			log.Printf("nnid_removal: delete error for %q: %v", normalizedNNID, err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"error":"failed to remove NNID"}`))
			return
		}
		*/

		log.Printf("nnid_removal: removed NNID %q (normalized: %q)", existing.NNID, normalizedNNID)

		// Optionally purge Cloudflare cache.
		if cfZoneID != "" && cfAPIToken != "" && publicHostname != "" {
			urlsToPurge := []string{
				fmt.Sprintf("https://%s/mii_data/%s", publicHostname, existing.NNID),
				fmt.Sprintf("https://%s/mii_data/%s", publicHostname, normalizedNNID),
			}
			if err := cfPurgeURLs(cfZoneID, cfAPIToken, urlsToPurge); err != nil {
				// Log but do not fail the request — the row is already deleted.
				log.Printf("nnid_removal: cloudflare purge error for %q: %v", normalizedNNID, err)
			} else {
				log.Printf("nnid_removal: purged CF cache for %q", normalizedNNID)
			}
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"removed":true}`))
	}
}
