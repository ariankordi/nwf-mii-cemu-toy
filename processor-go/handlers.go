package main

import (
	"net/http"

	"golang.org/x/image/draw"
	"image"
	"image/color"
	"image/png"

	"encoding/base64"
	"hash/crc32"
	"strconv"
	"strings"

	"bytes"
	"encoding/binary"
	"math/rand"

	"github.com/google/go-cmp/cmp"
	"github.com/sigurn/crc16"

	"errors"
	"io"
	"time"

	"fmt"
	"log"
)

// maps expression strings, NOT to their direct values (16-bit)
// but to the array in render-listener.js instead
var expressionKeyMap = map[string]uint8{
	"SURPRISE":              1,
	"SURPRISE_OPEN_MOUTH":   2,
	"WINK_LEFT_OPEN_MOUTH":  3,
	"LIKE":                  4,
	"ANGER_OPEN_MOUTH":      5,
	"BLINK_OPEN_MOUTH":      6,
	"ANGER":                 7,
	"LIKE_WINK_LEFT":        8,
	"HAPPY":                 9,
	"BLINK":                 10,
	"SMILE":                 11,
	"SORROW_OPEN_MOUTH":     12,
	"WINK_RIGHT":            13,
	"SORROW":                14,
	"NORMAL":                15,
	"LIKE_WINK_RIGHT":       16,
	"WINK_RIGHT_OPEN_MOUTH": 17,
	"SMILE_OPEN_MOUTH":      18,
	"FRUSTRATED":            19,
	"SURPRISED":             20,
	"WINK_LEFT":             21,
	"OPEN_MOUTH":            22,
	"PUZZLED":               23,
	"NORMAL_OPEN_MOUTH":     22,
}

// requests are timing out after this amount of time
const timeout = 7 * time.Second

func miiPostHandler(w http.ResponseWriter, r *http.Request) {
	// NOTE: permissive config here is somewhat temporary
	header := w.Header()
	header.Set("Access-Control-Allow-Private-Network", "true")
	header.Set("Access-Control-Allow-Origin", "*")
	header.Set("Access-Control-Allow-Methods", "POST")
	header.Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method == "OPTIONS" {
		// do not return any text on OPTIONS and preflight headers were already sent
		return
	}

	// if data was specified then this is allowed to be a GET
	b64MiiData := r.URL.Query().Get("data")

	nnid := r.URL.Query().Get("nnid")
	// if there is no mii data, but there IS an nnid...
	// (data takes priority over nnid)
	if b64MiiData == "" && nnid != "" {
		if !validNNIDRegex.MatchString(nnid) {
			http.Error(w,
				"nnids are 4-16 alphanumeric chars with dashes, underscores, and dots",
				http.StatusBadRequest)
			return
		}
		pid, err := fetchNNIDToPID(nnid)
		if err != nil {
			// usually the resolution error means the nnid does not exist
			// it can also just mean it cannot reach the account server or it failed
			// it can also mean but i donot care enough to add differentiation logic
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}

		forceRefresh, _ := strconv.ParseBool(r.URL.Query().Get("force_refresh"))
		b64MiiData, err = fetchMii(pid, forceRefresh)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// that function just set b64MiiData as mii data
	}

	// TODO SHOULD THIS GO BEFORE OR AFTER ??!?!?
	if b64MiiData == "" && r.Method != "POST" {
		// TODO: replace this with something funny
		http.Error(w, "you have to POST or specify data url param (TODO: replace this with something funny like skibidi toilet idk)", http.StatusMethodNotAllowed)
		return
	}

	// check length of body before reading it
	// NOTE: if you wanted to limit request uri you could set MaxHeaderBytes
	// ... but default is 1 mb which should be fine

	// Read Mii data from the request. You could decide the format (base64 or binary) using a header or part of the request
	var miiData []byte

	var err error

	// query param takes priority over body
	if b64MiiData != "" {
		// if data is specified, which is base64-encoded
		// NOTE: probably should be base64 url encoding
		miiData, err = base64.StdEncoding.DecodeString(b64MiiData)
		if err != nil {
			http.Error(w, "base64 query param decode error: "+err.Error(), http.StatusBadRequest)
			return
		}
	} else {
		// read request body, instead of query param
		// NOTE: LIMIT ON REQUEST BODY!!!!!!
		reader := http.MaxBytesReader(w, r.Body, 2*1024*1024) // 2 KiB
		miiData, err = io.ReadAll(reader)
		if err != nil {
			http.Error(w, "io.ReadAll error on request body: "+err.Error(), http.StatusBadRequest)
			return
		}
		contentType := r.Header.Get("Content-Type")
		if contentType == "application/base64" {
			// If the data is base64-encoded
			miiData, err = base64.StdEncoding.DecodeString(string(miiData))
			if err != nil {
				http.Error(w, "base64 body decode error: "+err.Error(), http.StatusBadRequest)
				return
			}
		}
	}

	// check length and crc16 of mii data
	miiDataLen := len(miiData)
	if miiDataLen != 96 {
		http.Error(w, "your mii data/FFLStoreData has to be exactly 96 bytes long, yours is "+
			strconv.Itoa(miiDataLen), http.StatusBadRequest)
		return
	}
	// do crc16
	crcData := miiData[:len(miiData)-2]     // Data without the last 2 bytes
	crcExpected := miiData[len(miiData)-2:] // Last 2 bytes

	// mii hash uses crc xmodem
	table := crc16.MakeTable(crc16.CRC16_XMODEM)
	crcCalculated := crc16.Checksum(crcData, table)

	// take expected crc from mii data
	crcExpectedValue := uint16(crcExpected[0])<<8 + // lower 16 bits
		uint16(crcExpected[1]) // higher 16 bits
	if crcCalculated != crcExpectedValue {
		http.Error(w,
			fmt.Sprintf("CRC check failed: calculated CRC (%X) does not match expected CRC (%X).\n", crcCalculated, crcExpectedValue),
			http.StatusBadRequest)
		return
	}

	// Extract additional parameters from query or form
	expressionStr := r.URL.Query().Get("expression")
	// for comparing in the map
	expressionStr = strings.ToUpper(expressionStr)
	expression, _ := expressionKeyMap[expressionStr]
	// 0 expression MUST become 24 or UTF-16BE null string will terminate early.
	if expression == 0 {
		expression = 24 // Default if not provided or error
	}

	// Assuming other parameters are passed as query parameters for simplicity

	// TODO: VERIFY THESE!!!! ranges for ALL except RGB
	width, _ := strconv.Atoi(r.URL.Query().Get("width"))
	if width < 1 {
		http.Error(w, "specify a width", http.StatusBadRequest)
		return
	}
	// will be scaled by either js or us tbd
	scale, _ := strconv.Atoi(r.URL.Query().Get("scale"))
	if scale < 1 {
		// default scale of 1, because scale of 0 will not work
		//scale = 1
		// actually default scale is now 2!!!!!!
		scale = 2
	}
	resolution := width * scale
	if resolution > maxResolution {
		http.Error(w,
			fmt.Sprintf("maximum resolution is %d but yours is %d\n", maxResolution, resolution),
			http.StatusBadRequest)
		return
	}

	// all of these scales produce no greenspill in the renderer
	// ... so they can/will be sent inside of render parameters.
	scaleValues := []int{3, 5, 7}
	// scaleInRequest = do not scale ourselves
	var scaleInRequest bool
	for _, num := range scaleValues {
		if num == scale {
			scaleInRequest = true
			break
		}
	}

	var mode uint8
	modeStr := r.URL.Query().Get("type")
	switch modeStr {
	case "all_body":
		http.Error(w, "we are sorry but we cannot render your whole body mii waifu in 4k at this time....", http.StatusNotImplemented)
		return
	case "face_only":
		mode = 1
	}
	// default mode or any other value stays at 0
	/*backgroundR, _ := strconv.Atoi(r.URL.Query().Get("backgroundR"))
	backgroundG, _ := strconv.Atoi(r.URL.Query().Get("backgroundG"))
	backgroundB, _ := strconv.Atoi(r.URL.Query().Get("backgroundB"))
	*/
	// read bgcolor
	// if there is # then read as hex
	// if there is no # then handle studio RGBA format
	//var bgColor color.NRGBA
	// set as default to initialize color in case func does not return
	bgColor := targetKey
	bgColorParam := r.URL.Query().Get("bgColor")
	// only process bgColor if it is longer than 0
	if len(bgColorParam) > 0 {
		// this function will panic if length is 0
		bgColor, err = ParseHexColorFast(bgColorParam)
		if err != nil {
			http.Error(w, "bgColor format is wrong: "+err.Error(), http.StatusBadRequest)
			return
		}
	}
	// this is what the color will pop out as when we see it, which...
	bgColorFromOutputForErrorDetection := bgColor
	if bgColor == targetKey {
		// will be transparent if it is the target key
		bgColorFromOutputForErrorDetection = color.NRGBA{R: 0, G: 0, B: 0, A: 0}
	}

	// TODO: NOT TO BE SPECIFIED BY USER, PRETTY MUCH ONLY HERE AS A PLACEHOLDER
	/*
		horizontalTotal, _ := strconv.Atoi(r.URL.Query().Get("horizontaltotal"))
		horizontalChunk, _ := strconv.Atoi(r.URL.Query().Get("horizontalchunk"))
	*/
	// NOTE: you may have been able to get away with parsing uint but that is 64

	// Compute CRC for Mii data
	miiCRC := crc32.ChecksumIEEE(miiData)
	//_ = crc32.ChecksumIEEE(miiData)

	// ifN NOT scale in request we are scaling ourselves
	// in which case the scale should be 1
	scaleToRender := scale
	if !scaleInRequest {
		scaleToRender = 1
	}

	// Setup RenderParameters with received or default values
	params := RenderParameters{
		//MiiDataHash:     0xCAFEBEEF,//miiCRC,
		MiiDataHash: miiCRC,
		Resolution:  uint16(resolution),
		Mode:        uint8(mode),
		Expression:  uint8(expression),
		BackgroundR: bgColor.R,
		BackgroundG: bgColor.G,
		BackgroundB: bgColor.B,
		Scale:       uint8(scaleToRender),
		/*HorizontalTotal: horizontalTotal,
		HorizontalChunk: horizontalChunk,
		*/
	}

	// TODO REOPTIMIZE WHERE THIS IS BECAUSE WE DO BINARY ENCODING AGAIN!!!!!....
	// TODO:  ALSO JUMPING BACK HERE, BEFORE THE NEW IMAGE IS READY, MAY SAY "OH IT IS STILL BLANK LEMME RESUBMIT"
	//resendRequest:
	// check if this request is already in renderRequests
	//markersMutex.Lock() // Lock the mutex before modifying or reading the markers slice
	var request renderRequest
	// TODO: BUT REQUEST IS RE-ENCODED AND RESENT EVEN IF IT ALREADY EXISTS
	/*var alreadyExists bool
	for i, request := range renderRequests {
		if request.parameters.MiiDataHash != params.MiiDataHash {
			continue
		}
		if !cmp.Equal(params, request.parameters) {
			continue
		}
		// here there is a matching one presumably, so change its timestamp to now
		alreadyExists = true
		log.Println("request already exists: ", request.parameters)
		// TODO check if this actually modified it
		renderRequests[i].timestamp = time.Now()
		request = renderRequests[i]
		markersMutex.Unlock()
		// stop at first match
		break
	}

	// add to markers TODO TODO ADD ENTIRE STRUCT TO THIS
	if !alreadyExists {
	*/request = renderRequest{
		parameters: params,
		//channel: make(chan renderResponse),
		timestamp:   time.Now(),
		ready:       make(chan struct{}),
		done:        make(chan struct{}),
		connErrChan: make(chan struct{}),
	}
	//log.Println("sending this struct: ", params)
	/*renderRequests = append(renderRequests, &request)
	markersMutex.Unlock()
	*/

	//}

	// here you can wait for permission to send request
	renderRequestQueue <- &request
	log.Println("added to queue: ", request)
	// receive from ready channel
	<-request.ready
	log.Println("continuing with request: ", request)
	// when this thing returns
	defer func() {
		log.Println("signaling request is done")
		select {
		case request.done <- struct{}{}:
		default:
		}
	}()

resendRequest:
	// add to render requests here
	markersMutex.Lock()
	renderRequests = append(renderRequests, &request)
	markersMutex.Unlock()

	// notify cemu state thread to unsuspend cemu if necessary
	notifyActivity()
	//resendRequest: // not here
	// Serialize the params to bytes as before
	encodedParams := &bytes.Buffer{}
	// not only are the multi-byte numbers big endian...
	// ... but the arrangement in general is for UTF-16BE
	err = binary.Write(encodedParams, binary.BigEndian, params)
	if err != nil {
		http.Error(w, "binary.Write struct failed!!!: "+err.Error(),
			http.StatusInternalServerError)
		return
	}

	// buffer to accomodate zeroes for amiibo, as well as mii data at the end
	buf := make([]byte, 172)
	// Fill amiiboData as needed, example:
	buf[0x2C] = 0x10
	copy(buf[0x4C:], miiData)
	copy(buf[0x38:], encodedParams.Bytes())

	// TODO: you probably want to resend here but it means only the originating thread will resend the request
	// non blocking send in case nfp channel is hung up??? bc semaphore is not answering
	select {
	case nfpChannel <- buf:
	default:
	}

	log.Println("request submitted to nfp channel...")
	// notify the screenshot channel to detect and start watching for requests
	select {
	// also a non-blocking send...
	case newRequestChannel <- struct{}{}:
	default:
	}

	// NOTE: there is a phenomenon in which...
	// the screenshot channel will read the screen,
	// and if the exact request we tried to send is already there,
	// it will actually return it back and STILL send the new request
	// which is potentially wasteful, i don't see it as that big of an issue as of now

	// now wait for one of two channel receives
	// i tried using a for loop instead but it broke my mind
restartSelect:
	select {
	//case renderedResponse := <-request.channel:
	case renderedResponse := <-responseChannel:
		if renderedResponse.parameters.MiiDataHash != params.MiiDataHash {
			goto restartSelect
		}
		if !cmp.Equal(renderedResponse.parameters, params) {
			// add extra space so it looks less wrong??
			fmt.Println("", renderedResponse.parameters, "\n(response) vs (request)\n", params)
			log.Println("found response of same hash but not matching params, skipping")
			goto restartSelect
		}
		// ENCODE RESPONSE YAAAAAY!!!!
		log.Println("received from channel with this struct: ", renderedResponse.parameters)
		//fmt.Println(renderedResponse)
		// Calculate the center of the image

		// Extract the pixel at the center
		sizeMiddle := renderedResponse.parameters.getWindowSize() / 2
		centerPixel := renderedResponse.pixels.At(sizeMiddle, sizeMiddle).(color.NRGBA)
		// Check if the center pixel is transparent
		// CHECK BLANK IMAGE AND THEN JUMP BACK UHHHHH
		// if the middle pixel is either the background color OR target transparency...
		if centerPixel == bgColorFromOutputForErrorDetection {
			//if centerPixel.A == 0 {
			log.Println("Warning: The pixel in the very center of the image is blank (transparent)!!!, jumping back and resending.")
			goto resendRequest
		}
		header.Set("Content-Type", "image/png")
		//currentTimeStamp := time.Now().Format("2006-01-02-15_04_05")
		/*fileName := fmt.Sprintf("%X-%d-%s.png", currentTimeStamp,
		params.MiiDataHash, resolution, expressionStr)*/
		// TODO: re-evaluate Content-Disposition format liiike... date-miiName-resolution-expression but then again parsing mii name will potentially introduce unicode trouble ugh
		// you could maaaaybeee use base32 here to "simulate" mii hash string but ehhHHH
		// TODO: expressionStr, modeStr are CONTROLLED BY USER!!!!!
		fileName := fmt.Sprintf("%X_%s_%s_%d.png", params.MiiDataHash,
			expressionStr, modeStr, width)
		header.Set("Content-Disposition", "inline; filename=\""+fileName+"\"")

		// HERE WE HAVE TO SCALE IF SCALE VAL IS PRIME!!!
		pixels := &renderedResponse.pixels
		// this shouldn't be 1 when in request?
		if !scaleInRequest {
			scaledImage := image.NewNRGBA(image.Rect(0, 0, width, width))
			// Resize:
			draw.ApproxBiLinear.Scale(scaledImage, scaledImage.Rect,
				&renderedResponse.pixels, renderedResponse.pixels.Bounds(), draw.Over, nil)
			pixels = scaledImage
		}

		if err := png.Encode(w, pixels); err != nil {
			//http.Error(w, "Failed to encode image: "+err.Error(), http.StatusInternalServerError)
			log.Println("png.Encode error:", err)
		}
	// when screenshot request returns connection refused
	case <-request.connErrChan:
		http.Error(w,
			"OH NO!!! cemu doesn't appear to be running...\nreceived connection refused ☹️",
			http.StatusBadGateway)
	case <-time.After(timeout):
		log.Println(params, ": timeout after", timeout, "seconds")
		// remove this request
		markersMutex.RLock()
		for i, theirRequest := range renderRequests {
			// check pointer meaning they must be the exact same
			if theirRequest != &request {
				continue
			}
			log.Println("found our timed out request, removing it from renderRequests")
			renderRequests = append(renderRequests[:i], renderRequests[i+1:]...)
			break
		}
		markersMutex.RUnlock()
		rand.Seed(time.Now().UnixNano())
		choices := []string{
			"timed out we sorry please allow us to such your ditch i mean WHAT",
			"timed out. we are sorry. for compensation we willl be providing peanits sucking service to you shortly 🙂",
			"timed out. we apologize. we will offer 95,000 Bradentillion Dollars!!!!!!!!!! 🤯 or whatever the Zoomers say these days",
			//"timed out. for your compensation, here is annie may music: /home/arian/2019-toys/usic/Candy Dash VIP final.mp3",
			//"timed out but for your compents ation we will be providing wario land 4 at the https://gba.js.org/player#warioland4",
		}
		chosenString := choices[rand.Intn(len(choices))]
		http.Error(w, chosenString, http.StatusGatewayTimeout)
	}

}

// adapted from https://stackoverflow.com/a/54200713
var errInvalidFormat = errors.New("invalid format")
var errAlphaZero = errors.New("alpha component is zero")

func ParseHexColorFast(s string) (c color.NRGBA, err error) {
	// initialize A to full opacity
	c.A = 0xff

	hexToByte := func(b byte) byte {
		switch {
		case b >= '0' && b <= '9':
			return b - '0'
		case b >= 'a' && b <= 'f':
			return b - 'a' + 10
		case b >= 'A' && b <= 'F':
			return b - 'A' + 10
		}
		err = errInvalidFormat
		return 0
	}

	if s[0] == '#' {
		switch len(s) {
		case 7: // #RRGGBB
			c.R = hexToByte(s[1])<<4 + hexToByte(s[2])
			c.G = hexToByte(s[3])<<4 + hexToByte(s[4])
			c.B = hexToByte(s[5])<<4 + hexToByte(s[6])
		// TODO: is this format really necessary to have?
		case 4: // #RGB
			c.R = hexToByte(s[1]) * 17
			c.G = hexToByte(s[2]) * 17
			c.B = hexToByte(s[3]) * 17
		default:
			err = errInvalidFormat
		}
	} else {
		// Assuming the string is 8 hex digits representing RGBA without '#'
		if len(s) != 8 {
			err = errInvalidFormat
			return
		}

		// Parse RGBA
		r := hexToByte(s[0])<<4 + hexToByte(s[1])
		g := hexToByte(s[2])<<4 + hexToByte(s[3])
		b := hexToByte(s[4])<<4 + hexToByte(s[5])
		a := hexToByte(s[6])<<4 + hexToByte(s[7])

		// Only set RGB if A > 0
		if a > 0 {
			c.R, c.G, c.B = r, g, b
		} else {
			err = errAlphaZero
		}
	}

	return
}
