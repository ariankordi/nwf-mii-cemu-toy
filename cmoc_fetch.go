package main

import (
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
)

// As of 2024-10-05, this is the WiiLink Check Mii Out Channel API
// would be able to request this in JS if it returned CORS headers :(
const (
	cmocSearchEndpoint = "https://miicontestp.wii.rc24.xyz/cgi-bin/search.cgi?entryno=%s"
	cmocFileSuffix = ".rsd" // content-disposition file extension
)

// Parses a CMOC entry number string to a string usable
// as entryno on the API(s), adapted from mii2studio.py
func cmocEntryStringParse(input string) (string, error) {
	// Strip dashes, convert to an integer, then to a binary string
	numStr := strings.ReplaceAll(input, "-", "")
	num, err := strconv.ParseInt(numStr, 10, 64)
	if err != nil {
		return "", err
	}

	// Pad to 40 characters, and take slice from 8th bit onward
	binaryStr := fmt.Sprintf("%032b", num)
	paddedBinaryStr := fmt.Sprintf("%040s", binaryStr)
	trimmedBinary := paddedBinaryStr[8:]
	num, _ = strconv.ParseInt(trimmedBinary, 2, 64)
	// we created that binary string so shouldn't parse wrong

	// Scramble the number using bitwise operations
	// NOTE: did not look into which binary this came from
	num ^= 0x20070419
	num ^= (num >> 0x1D) ^ (num >> 0x11) ^ (num >> 0x17)
	num ^= (num & 0xF0F0F0F) << 4
	num ^= ((num << 0x1E) ^ (num << 0x12) ^ (num << 0x18)) & 0xFFFFFFFF

	// Return the final descrambled number as a string
	return strconv.FormatInt(num, 10), nil
}

// Predefined errors for response statuses
var (
	errCMOCEndpointReturnedNon200 = errors.New("mii probably not found (CMOC endpoint returned non-200 status)")
	errCMOCResponseTooShort       = errors.New("response from CMOC endpoint is too short")
	errCMOCResponseNotFound       = errors.New("mii not found")
)

// Requests a CMOC entry from the endpoint defined in cmocSearchEndpoint
// and then cuts out the output (RFLStoreData) from the response
func lookupCMOCAndCutoutMiiData(entryNo string) ([]byte, error) {
	url := fmt.Sprintf(cmocSearchEndpoint, entryNo)

	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	// NOTE: does not account for 10x, 30x but whatever
	if resp.StatusCode != 200 {
		return nil, errCMOCEndpointReturnedNon200
	}

	// Read the response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	// according to mii2studio.py...
	if len(body) == 32 { // 32 = empty response
		return nil, errCMOCResponseNotFound
	}

	// Extract the RFLStoreData portion
	if len(body) < 188 {
		return nil, errCMOCResponseTooShort
	}
	binaryData := body[56:132]

	return binaryData, nil
}

//var cmocCodeRegex = regexp.MustCompile(`^\d{4}-\d{4}-\d{4}$`)

const cmocLookupHandlerUsageSuffix = `

this code should be just, the CMOC entry number
in the form: 1234-5678-9123 - we will descramble it
the search endpoint is: ` + cmocSearchEndpoint + `
soooo as of writing this, the site is accessed at: https://miicontest.wiilink.ca`

// looks up a check mii out code to RFLStoreData
func cmocLookupHandler(w http.ResponseWriter, r *http.Request) {
	setCORSHeaders(w, r) // nnid_fetch.go

	// Split the URL path and validate input format
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) != 3 || parts[2] == "" {
		http.Error(w, "usage: " + cmocLookupHandlerPrefix + "(cmoc code)" + cmocLookupHandlerUsageSuffix, http.StatusBadRequest)
		return
	}
	/*
	if !cmocCodeRegex.MatchString(parts[2]) {
		http.Error(w, "Invalid code format. Expected '1234-5678-9123'", http.StatusBadRequest)
		return
	}
	*/
	inputCode := parts[2]

	// Descramble the input code to get the CMOC entryNo
	entryNo, err := cmocEntryStringParse(inputCode)
	if err != nil {
		http.Error(w, "failed to parse entry as number", http.StatusInternalServerError)
		return
	}

	// Lookup the CMOC entry and return RFLStoreData
	data, err := lookupCMOCAndCutoutMiiData(entryNo)
	if err != nil {
		if err == errCMOCResponseNotFound {
			// return 404 for this specific error
			http.Error(w, err.Error(), http.StatusNotFound)
		} else {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}

	// Check Accept header to determine response format
	acceptsOctetStream := r.Header.Get("Accept") == "application/octet-stream"
	if acceptsOctetStream {
		// Return as octet-stream with Content-Disposition header
		w.Header().Set("Content-Type", "application/octet-stream")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s%s\"", inputCode, cmocFileSuffix))
		w.WriteHeader(http.StatusOK)
		w.Write(data)
	} else {
		// Otherwise return as base64 encoded string
		encoded := base64.StdEncoding.EncodeToString(data)
		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(encoded))
	}
}
