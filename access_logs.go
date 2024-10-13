package main

import (
	"bufio"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
	"time"
)

const (
	// ANSI color codes for access logs
	ANSIReset     = "\033[0m"
	ANSIRed       = "\033[31m"
	ANSIGreen     = "\033[32m"
	ANSIYellow    = "\033[33m"
	ANSIPurple    = "\033[35m"
	ANSIFaint     = "\033[2m"
	ANSIBold      = "\033[1m"
	ANSICyan      = "\033[36m"
	ANSIBgRed     = "\033[101m"
	ANSIBgBlue    = "\033[104m"
	ANSIBgMagenta = "\033[105m"
)

func isColorTerminal() bool {
	// NOTE: hack
	return os.Getenv("TERM") == "xterm-256color"
}

// getClientIP retrieves the client IP address from the request,
// considering the X-Forwarded-For header if present.
func getClientIP(r *http.Request) string {
	if useXForwardedFor {
		xff := r.Header.Get("X-Forwarded-For")
		if xff != "" {
			ips := strings.Split(xff, ",")
			return strings.TrimSpace(ips[0])
		}
	}
	host, _, _ := net.SplitHostPort(r.RemoteAddr)
	return host
}

// captureStatusCodeResponseWriter is a custom http.ResponseWriter that captures the status code
type captureStatusCodeResponseWriter struct {
	http.ResponseWriter
	statusCode int
}

// websocket doesn't work without this
func (u *captureStatusCodeResponseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	return u.ResponseWriter.(http.Hijacker).Hijack()
}
// just for good measure
func (u *captureStatusCodeResponseWriter) Flush() {
	u.ResponseWriter.(http.Flusher).Flush()
}
func (u *captureStatusCodeResponseWriter) Push(target string, opts *http.PushOptions) error {
	return u.ResponseWriter.(http.Pusher).Push(target, opts)
}

// newResponseWriter creates a new captureStatusCodeResponseWriter
func newResponseWriter(w http.ResponseWriter) *captureStatusCodeResponseWriter {
	return &captureStatusCodeResponseWriter{w, http.StatusOK}
}

// WriteHeader captures the status code
func (rw *captureStatusCodeResponseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// logRequest logs each request in Apache/Nginx standard format with ANSI colors
func logRequest(handler http.Handler, ignoredPaths []string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check if the request path should be ignored
		for _, ignoredPath := range ignoredPaths {
			if strings.HasPrefix(r.URL.Path, ignoredPath) {
				// If path matches one of the ignored paths, just serve the request without logging
				handler.ServeHTTP(w, r)
				return
			}
		}

		start := time.Now()
		rw := newResponseWriter(w)
		handler.ServeHTTP(rw, r)
		status := rw.statusCode

		latency := time.Since(start)
		clientIP := getClientIP(r)

		log.SetFlags(log.Flags() &^ (log.Ldate | log.Ltime))
		if isColorTerminal() || lumberjackLogger == nil {
			statusColor := ANSIGreen

			// Determine the status color
			if status >= 400 && status < 500 {
				statusColor = ANSIYellow
			} else if status >= 500 {
				statusColor = ANSIRed
			}
			latencyColor := getLatencyGradientColor(latency)

			clientIPColor := ANSICyan
			if r.Header.Get("X-Forwarded-For") != "" {
				clientIPColor = ANSIBgMagenta
			}

			var query string
			if r.URL.RawQuery != "" {
				query += "?"
			}
			query += r.URL.RawQuery
			queryColored := colorQueryParameters(query)

			// so many colors.....
			log.Println(clientIPColor + clientIP + ANSIReset +
				" - - [" + start.Format("02/Jan/2006:15:04:05 -0700") + "] \"" +
				ANSIGreen + r.Method + " " + r.URL.Path + queryColored + " " + ANSIReset +
				ANSIFaint + r.Proto + ANSIReset + "\" " +
				statusColor + fmt.Sprint(status) + ANSIReset + " " +
				fmt.Sprint(r.ContentLength) + " \"" +
				ANSIPurple + r.Referer() + ANSIReset + "\" \"" +
				ANSIFaint + r.UserAgent() + ANSIReset + "\" " +
				latencyColor + fmt.Sprint(latency) + ANSIReset)
		} else {
			// apache/nginx request format with latency at the end
			log.Println(clientIP + " - - [" + start.Format("02/Jan/2006:15:04:05 -0700") + "] \"" +
				r.Method + " " + r.RequestURI + " " + r.Proto + "\" " +
				fmt.Sprint(status) + " " + fmt.Sprint(r.ContentLength) + " \"" +
				r.Referer() + "\" \"" + r.UserAgent() + "\" " +
				fmt.Sprint(latency))
		}
		log.SetFlags(0)
	})
}

// Color ranges for latency gradient
var latencyColors = []string{
	"\033[38;5;39m",  // Blue
	"\033[38;5;51m",  // Light blue
	"\033[38;5;27m",  // Added color (Dark blue)
	"\033[38;5;82m",  // Green
	"\033[38;5;34m",  // Added color (Forest green)
	"\033[38;5;154m", // Light green
	"\033[38;5;220m", // Yellow
	"\033[38;5;208m", // Orange
	"\033[38;5;198m", // Light red
}

// getLatencyGradientColor returns a gradient color based on the latency
func getLatencyGradientColor(latency time.Duration) string {
	millis := latency.Milliseconds()
	// Define latency thresholds
	thresholds := []int64{40, 60, 85, 100, 150, 230, 400, 600}

	for i, threshold := range thresholds {
		if millis < threshold {
			return latencyColors[i]
		}
	}
	return latencyColors[len(latencyColors)-1]
}

// colorQueryParameters colors the query parameters
func colorQueryParameters(query string) string {
	if query == "" {
		return ""
	}
	// NOTE: the question mark and first query key are colored the same
	params := strings.Split(query, "&")
	var coloredParams []string
	for _, param := range params {
		keyValue := strings.Split(param, "=")
		if len(keyValue) == 2 {
			coloredParams = append(coloredParams, fmt.Sprintf("%s%s%s=%s%s%s", ANSICyan, keyValue[0], ANSIReset, ANSIYellow, keyValue[1], ANSIReset))
		} else {
			coloredParams = append(coloredParams, param)
		}
	}
	return strings.Join(coloredParams, "&")
}
