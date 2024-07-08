package main

import (
	"encoding/json"
	"net/http"
	"sync"
)

var errorSessions = make(map[string]chan errorEvent) // Maps session IDs to error channels

type errorEvent struct {
	RequestID string `json:"requestID"`
	Message   string `json:"message"`
	Code      int    `json:"code"`
	//Trace     string `json:"trace,omitempty"` // Optional field for stack trace
}

// Mutex for safe concurrent access to errorSessions map
var errorSessionsMutex = &sync.Mutex{}

type errorResponseWriter struct {
	http.ResponseWriter
	statusCode int
	sessionID  string
	requestID  string
}

func (rw *errorResponseWriter) WriteHeader(statusCode int) {
	rw.statusCode = statusCode
	rw.ResponseWriter.WriteHeader(statusCode)
}

func (rw *errorResponseWriter) Write(b []byte) (int, error) {
	if rw.statusCode >= 400 {
		errorSessionsMutex.Lock()
		if ch, ok := errorSessions[rw.sessionID]; ok {
			ch <- errorEvent{
				RequestID: rw.requestID,
				Message:   string(b),
				Code:      rw.statusCode,
			}
		}
		errorSessionsMutex.Unlock()
	}
	return rw.ResponseWriter.Write(b)
}

func sseErrorHandler(w http.ResponseWriter, r *http.Request) {
	header := w.Header()
	header.Set("Access-Control-Allow-Private-Network", "true")
	header.Set("Access-Control-Allow-Origin", "*")
	header.Set("Access-Control-Allow-Headers", "Cache-Control")

	sessionID := r.URL.Query().Get("errorSessionID")
	if sessionID == "" {
		http.Error(w, "Error session ID required", http.StatusBadRequest)
		return
	}

	header.Set("Content-Type", "text/event-stream")
	header.Set("Cache-Control", "no-cache")
	header.Set("Connection", "keep-alive")

	errorSessionsMutex.Lock()
	current, exists := errorSessions[sessionID]
	if exists {
		close(current) // Safely close existing channel
	}
	current = make(chan errorEvent, 10) // Always create a new channel
	errorSessions[sessionID] = current
	errorSessionsMutex.Unlock()

	flusher, _ := w.(http.Flusher)

	defer func() {
		errorSessionsMutex.Lock()
		if cur, ok := errorSessions[sessionID]; ok && cur == current {
			close(cur) // Close the channel if it's still the current channel
			delete(errorSessions, sessionID)
		}
		errorSessionsMutex.Unlock()
	}()

	for {
		select {
		case errEvt, ok := <-current:
			if !ok {
				return // Exit if channel is closed
			}
			jsonData, _ := json.Marshal(errEvt)
			data := "data: " + string(jsonData) + "\n\n"
			_, err := w.Write([]byte(data))
			if err != nil {
				return // Exit if we cannot write to the response
			}
			flusher.Flush()
		case <-r.Context().Done():
			return
		}
	}
}
