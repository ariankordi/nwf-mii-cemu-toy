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

// exhaust sets the counter to the limit, immediately locking out any further
// requests for the remainder of the current window.
func (l *removalRateLimiter) exhaust() {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	if now.After(l.windowEnd) {
		l.windowEnd = now.Add(time.Hour)
	}
	l.count = RemovalHourlyLimit
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

// reservedNNIDs is a normalized set of NNIDs that may never be removed via the
// self-service form. Submitting one still consumes a rate limit slot.
var reservedNNIDs = map[string]struct{}{
	"jasminechlora": {},
	"ariankordi": {},
	"nintendotom": {},
}

// nnidRemovalHandlerPrefix is the URL prefix under which the handler is mounted.
// The NNID to remove is read from the path segment following this prefix, so it
// appears in access logs rather than being buried in a request body.
const nnidRemovalHandlerPrefix = "/nnid-archive-remove/"

// nnidRemovalHandler handles POST /nnid-archive-remove/{nnid}.
// It deletes the matching row from nnid_to_mii_data_map and optionally purges
// Cloudflare cache.
//
// Parameters (injected at registration time):
//   - db: GORM database pointing at the nnid_to_mii_data_map table.
//   - cfZoneID, cfAPIToken: Cloudflare credentials (empty = disabled).
//   - publicHostname: used to build cache purge URLs (e.g. "mii-unsecure.ariankordi.net").
//   - noLimit: when true the hourly rate limit is bypassed entirely.
func nnidRemovalHandler(db *gorm.DB, cfZoneID, cfAPIToken, publicHostname string, noLimit bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Read the NNID from the URL path so it is visible in access logs.
		rawNNID := strings.TrimPrefix(r.URL.Path, nnidRemovalHandlerPrefix)
		rawNNID = strings.TrimSpace(rawNNID)
		if rawNNID == "" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte(`{"error":"nnid is required"}`))
			return
		}

		// Normalize the NNID the same way as the lookup path.
		normalizedNNID := normalizeDashUnderscoreDot(rawNNID)

		// Submitting a reserved NNID exhausts the entire hourly limit immediately,
		// locking the submitter out for the rest of the window.
		if _, reserved := reservedNNIDs[normalizedNNID]; reserved {
			if !noLimit {
				globalRemovalLimiter.exhaust()
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusForbidden)
			w.Write([]byte(`{"error":"bro"}`))
			return
		}

		// Apply the global hourly rate limit unless the operator disabled it.
		if !noLimit && !globalRemovalLimiter.allow() {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTooManyRequests)
			w.Write([]byte(`{"error":"hourly removal limit reached, please try again later"}`))
			return
		}

		// "test" short-circuits to a success response for local testing.
		if normalizedNNID == "test" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"removed":true}`))
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
		if err := db.Where("normalized_nnid = ?", normalizedNNID).Delete(&NNIDToMiiDataMap{}).Error; err != nil {
			log.Printf("nnid_removal: delete error for %q: %v", normalizedNNID, err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"error":"failed to remove NNID"}`))
			return
		}

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
