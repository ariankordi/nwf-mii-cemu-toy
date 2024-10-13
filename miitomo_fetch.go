package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"crypto/rand"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/pierrec/lz4"
)

// miitomo XOR common key
const miitomoCommonKey = "9ec1c78fa2cb34e2bed5691c08432f04"

// get_player_data endpoint from kaeru
const getPlayerDataEndpoint = "https://ktp.kaeru.world/v1/player/get_player_data"

// Custom User-Agent for HTTP requests
const miitomoUserAgent = "hello kaeru devs if you are reading this is mii-unsecure.ariankordi.net. we are spamming your get_player_data endpoint because you did not implement encoding json_data with your qr codes. please contact me i wilL LITERALLY implement the php for this for FREEEEEEE: .arian."

// validate 16 character player ID
var playerIDRegex = regexp.MustCompile(`^[a-fA-F0-9]{16}$`)

// reuseable errors
var (
	errInvalidPlayerID       = errors.New("player ID must be a 16 character long hex string")
	errUpstreamNon200        = errors.New("upstream returned non-200 status code")
	errSessionIDGeneration   = errors.New("failed to generate session ID")
	errInvalidUpstreamJSON   = errors.New("invalid JSON from upstream")
	errEncoding              = errors.New("xor encoding error")
	errDecoding              = errors.New("xor decoding error")
	errInvalidVarint         = errors.New("invalid varint encoding")
	errVarintTooLong         = errors.New("varint too long")
	errIncompleteVarint      = errors.New("incomplete varint")
	errUnexpectedResponse    = errors.New("unexpected response from upstream")
	errPlayerDataNotFound    = errors.New("player data not found for requested namespaces")
)

// transformCommonKey transforms the common key by subtracting 0x62 from each character
// and negating the result, similar to FUN_0004a120 in libsakasho.so.
func transformCommonKey(s string) []byte {
	transformed := make([]byte, len(s))
	for i, c := range s {
		transformed[i] = byte((-0x62 - int(c)) & 0xFF)
	}
	return transformed
}

// buildXorTable builds the XOR table by processing the common key and session ID
// and concatenating the results.
func buildXorTable(commonKey string, sessionID string) []byte {
	transformedCommon := transformCommonKey(commonKey)
	return append(transformedCommon, []byte(sessionID)...)
}

// conditionalXOR applies the conditional XOR operation to the data using the XOR table.
// For each byte in the data:
// - If (key_byte & 7) == 0, XOR the data byte with the key byte.
// - Else, perform a bit rotation based on (key_byte & 7).
func conditionalXOR(data []byte, xorTable []byte, encode bool) []byte {
	output := make([]byte, len(data))
	tableLen := len(xorTable)

	for i := 0; i < len(data); i++ {
		keyByte := xorTable[(i+1)%tableLen]

		if keyByte&7 == 0 {
			// Perform XOR operation
			output[i] = data[i] ^ keyByte
		} else {
			// Perform bit rotation
			shift := keyByte & 7
			if encode {
				// Left rotate the byte
				rotated := ((data[i] << (8 - shift)) | (data[i] >> shift)) & 0xFF
				output[i] = rotated
			} else {
				// Right rotate the byte
				rotated := ((data[i] >> (8 - shift)) | (data[i] << shift)) & 0xFF
				output[i] = rotated
			}
		}
	}
	return output
}

// decodeVarint decodes a variable-length integer (varint) from the beginning of the data.
// Varints are used to encode integers efficiently using one or more bytes.
func decodeVarint(data []byte) (int, int) {
	var value int
	var shift int
	for i, b := range data {
		value |= int(b&0x7F) << shift
		if b&0x80 == 0 {
			// If the most significant bit is not set, this is the last byte
			return value, i + 1
		}
		shift += 7
		if shift >= 35 {
			// Prevent shift overflow
			panic(errVarintTooLong)
		}
	}
	panic(errIncompleteVarint)
}

// encodeVarint encodes an integer into variable-length integer (varint) format.
// Varints are efficient for encoding small integers.
func encodeVarint(value int) []byte {
	var parts []byte
	for {
		b := byte(value & 0x7F)
		value >>= 7
		if value != 0 {
			parts = append(parts, b|0x80)
		} else {
			parts = append(parts, b)
			break
		}
	}
	return parts
}

// detectInterruptions detects and handles interruptions in the data based on predefined cutoffs.
func detectInterruptions(data []byte, cutoffs []string) ([]byte, bool) {
	for _, cutoff := range cutoffs {
		index := bytes.Index(data, []byte(cutoff))
		if index != -1 {
			return data[:index], true
		}
	}
	return data, false
}

// decodeAndDecompress takes the input data, decodes it using the XOR table,
// extracts the compressed data, decompresses it using LZ4, and returns the result.
func decodeAndDecompress(body io.Reader, xorTable []byte) ([]byte, error) {
	// Read the entire input into a buffer
	buf := new(bytes.Buffer)
	_, err := io.Copy(buf, body)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", errDecoding, err)
	}

	data := buf.Bytes()

/*
	// Detect interruptions before processing further
	interruptedData, found := detectInterruptions(data, cutoffs)
	if found {
		fmt.Fprintf(os.Stderr, "\033[1;31mWarning: HTML interruption detected. Decoding only up to the interruption.\033[0m\n")
		data = interruptedData
	}
*/
	// Apply the conditional XOR decoding
	dataAfterXOR := conditionalXOR(data, xorTable, false)

	// Decode varint to get the size of decompressed data
	varintValue, varintLength := decodeVarint(dataAfterXOR)
	compressedData := dataAfterXOR[varintLength:]

	// Allocate buffer for decompressed data
	decompressed := make([]byte, varintValue)
	decompressedLen, err := lz4.UncompressBlock(compressedData, decompressed)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", errDecoding, err)
	}

	return decompressed[:decompressedLen], nil
}

// compressAndEncode compresses the given data using LZ4,
// encodes it using the XOR table, and returns the result.
func compressAndEncode(body []byte, xorTable []byte) ([]byte, error) {
	// Compress the data using LZ4 algorithm
	compressed := make([]byte, lz4.CompressBlockBound(len(body)))
	compressedLen, err := lz4.CompressBlock(body, compressed, nil)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", errEncoding, err)
	}
	compressed = compressed[:compressedLen]

	// Encode the original data length as a varint
	varint := encodeVarint(len(body))

	// Concatenate varint and compressed data
	dataToEncode := append(varint, compressed...)

	// Apply the conditional XOR encoding
	encodedData := conditionalXOR(dataToEncode, xorTable, true)

	return encodedData, nil
}

const sessionIDLength = 48 // 48 bytes -> 64 characters in base64 URL encoding

// generateRandomSessionID generates a random base64 URL-encoded session ID of 64 characters.
func generateRandomSessionID() (string, error) {
	bytes := make([]byte, sessionIDLength)
	_, err := rand.Read(bytes)
	if err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(bytes)[:64], nil
}

const miitomoLookupHandlerUsageSuffix = `

so how do you get the player id?
this is in your friend request invite link
it is the first 16 character hex string after "friend_code/"
hope that helps - if it does, you can specify these query params:
* target_player_id (multiple, can substitute path parameter)
* namespace (multiple, e.g.: own_mii, stock_mii, mii_face_image)

the endpoint this requests is: ` + getPlayerDataEndpoint

// miitomoLookupHandler looks up stock_mii and own_mii fields and returns raw JSON from the upstream.
func miitomoLookupHandler(w http.ResponseWriter, r *http.Request) {
	setCORSHeaders(w, r) // nnid_fetch.go

	var targetPlayerIDs []string
	query := r.URL.Query()

	// Split the URL path and validate input format
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) != 3 || parts[2] == "" && !query.Has("target_player_id") {
		http.Error(w, "usage: " + miitomoLookupHandlerPrefix + "(player id)" + miitomoLookupHandlerUsageSuffix, http.StatusBadRequest)
		return
	} else if(parts[2] != "") {
		inputPlayerID := parts[2]

		// Validate player ID format (hexadecimal, 16 characters)
		if !playerIDRegex.MatchString(inputPlayerID) {
			http.Error(w, errInvalidPlayerID.Error(), http.StatusBadRequest)
			return
		}
		// Collect target_player_ids from URL path
		targetPlayerIDs = []string{inputPlayerID}
	}


	// Extract target_player_id from query parameters
	for _, id := range query["target_player_id"] {
		if playerIDRegex.MatchString(id) {
			targetPlayerIDs = append(targetPlayerIDs, id)
		} else {
			http.Error(w, fmt.Sprintf("%v: %s", errInvalidPlayerID, id), http.StatusBadRequest)
			return
		}
	}

	// Determine namespaces
	namespaces := []string{"own_mii", "stock_mii"}
	if ns, exists := query["namespace"]; exists && len(ns) > 0 {
		// Override default namespaces with provided query parameters
		namespaces = ns
	}

	// Create the request body
	requestBody := map[string]interface{}{
		"namespaces":        namespaces,
		"target_player_ids": targetPlayerIDs,
	}

	requestBodyBytes, err := json.Marshal(requestBody)
	if err != nil {
		http.Error(w, fmt.Sprintf("%v: %v", errEncoding, err), http.StatusInternalServerError)
		return
	}

	// Generate a random session ID
	sessionID, err := generateRandomSessionID()
	if err != nil {
		http.Error(w, fmt.Sprintf("%v: %v", errSessionIDGeneration, err), http.StatusInternalServerError)
		return
	}

	// Build the XOR table using the common key and session ID
	xorTable := buildXorTable(miitomoCommonKey, sessionID)

	// Compress and encode the request body
	encodedBody, err := compressAndEncode(requestBodyBytes, xorTable)
	if err != nil {
		http.Error(w, fmt.Sprintf("%v: %v", errEncoding, err), http.StatusInternalServerError)
		return
	}

	// Create a new HTTP POST request to the upstream URL
	req, err := http.NewRequest("POST", getPlayerDataEndpoint, bytes.NewReader(encodedBody))
	if err != nil {
		http.Error(w, fmt.Sprintf("%v: %v", errUnexpectedResponse, err), http.StatusInternalServerError)
		return
	}

	// Set custom User-Agent
	req.Header.Set("User-Agent", miitomoUserAgent)

	// Set player_session_id cookie
	req.AddCookie(&http.Cookie{
		Name:  "player_session_id",
		Value: sessionID,
	})

	// Set Content-Type to application/octet-stream
	req.Header.Set("Content-Type", "application/octet-stream")

	// Initialize HTTP client with timeout
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	// Send the HTTP request to the upstream
	resp, err := client.Do(req)
	if err != nil {
		http.Error(w, fmt.Sprintf("%v: %v", errUnexpectedResponse, err), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	// Read the response body
	responseData, err := io.ReadAll(resp.Body)
	if err != nil {
		http.Error(w, fmt.Sprintf("%v: %v", errUnexpectedResponse, err), http.StatusBadGateway)
		return
	}

	// Check for non-200 status codes
	if resp.StatusCode != http.StatusOK {
		http.Error(w, fmt.Sprintf("%v: received status code %d", errUpstreamNon200, resp.StatusCode), resp.StatusCode)
		return
	}

	// Decode and decompress the response data
	decodedResponse, err := decodeAndDecompress(bytes.NewReader(responseData), xorTable)
	if err != nil {
		http.Error(w, fmt.Sprintf("%v: %v", errDecoding, err), http.StatusBadGateway)
		return
	}

	// Validate that the decoded response is valid JSON
	var jsonResponse map[string]interface{}
	if err := json.Unmarshal(decodedResponse, &jsonResponse); err != nil {
		http.Error(w, fmt.Sprintf("%v: %v", errInvalidUpstreamJSON, err), http.StatusBadGateway)
		return
	}

	// Check if there's only one player and all namespaces are null
	if players, ok := jsonResponse["players"].([]interface{}); ok && len(players) == 1 {
		playerData := players[0].(map[string]interface{})["player_data"].(map[string]interface{})
		allNull := true
		for _, ns := range namespaces {
			if playerData[ns] != nil {
				allNull = false
				break
			}
		}
		if allNull {
			http.Error(w, errPlayerDataNotFound.Error(), http.StatusNotFound)
			return
		}
	}

	// Write the raw JSON response to the client
	w.Header().Set("Content-Type", "application/json")
	_, err = w.Write(decodedResponse)
	if err != nil {
		http.Error(w, fmt.Sprintf("%v: %v", errUnexpectedResponse, err), http.StatusInternalServerError)
		return
	}
}
