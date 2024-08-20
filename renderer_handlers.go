package main

import (
	"bytes"
	"log"
	//"database/sql"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"image"
	"image/png"
	"io"
	"net"
	"net/http"
	"strconv"
	"strings"

	// ApproxBiLinear for CPU SSAA
	"golang.org/x/image/draw"
	"gorm.io/gorm"

	"errors"
	"image/color"
	"syscall"

	roundrobin "github.com/hlts2/round-robin"

	_ "github.com/go-sql-driver/mysql"
)

var (
	upstreamTCP      string
	useXForwardedFor bool
	rr               roundrobin.RoundRobin
)

const (
	FFLResolutionMask             = 0x3fffffff
	FFLResolutionMipmapEnableMask = 1 << 30
)

// RenderRequest is the equivalent struct in Go for handling the render request data.
// Added padding bytes to ensure compliance with the original C++ struct.
type RenderRequest struct {
	Data              [96]byte
	DataLength        uint16
	_                 [2]byte
	// NOTE: arbitrary resolutions CRASH THE BACKEND
	Resolution        uint32
	TexResolution     uint32
	ViewType          uint8
	Expression        uint8
	ResourceType      uint8
	ShaderType        uint8
	CameraRotate      [3]int32
	BackgroundColor   [4]uint8

	VerifyCharInfo    bool
	LightEnable       bool
	_                 [2]byte
	//SetLightDirection bool
	//LightDirection    [3]float32
}

var viewTypes = map[string]int {
	"face":             0,
	"face_only":        1,
	"all_body":         2,
	"variableiconbody": 3,
}

// decodeBase64 decodes a Base64 string, handling both standard and URL-safe Base64.
func decodeBase64(s string) ([]byte, error) {
	// Normalize URL-safe Base64 by replacing '-' with '+' and '_' with '/'
	s = strings.ReplaceAll(s, "-", "+")
	s = strings.ReplaceAll(s, "_", "/")

	// Add padding if necessary
	switch len(s) % 4 {
	case 2:
		s += "=="
	case 3:
		s += "="
	}

	return base64.StdEncoding.DecodeString(s)
}

// isHex checks if a string is a valid hexadecimal encoded string
func isHex(s string) bool {
	_, err := hex.DecodeString(s)
	return err == nil
}

// sendRenderRequest sends the render request to the render server and receives the buffer data
func sendRenderRequest(request RenderRequest) ([]byte, error) {
	var buffer bytes.Buffer
	// Writing the struct to the buffer
	err := binary.Write(&buffer, binary.LittleEndian, request)
	if err != nil {
		return nil, err
	}

	// Determine the upstream render server to connect to
	var conn net.Conn
	if rr != nil {
		// Use round-robin balancer
		nextServer := rr.Next().Host
		log.Println("using this upstream:", nextServer)
		conn, err = net.Dial("tcp", nextServer)
		if err != nil {
			log.Println("\033[1;31mURGENT: Failed to connect to "+nextServer+". The upstream may be down:\033[0m", err)
			return nil, err
		}
	} else {
		// Use single upstream server
		conn, err = net.Dial("tcp", upstreamTCP)
		if err != nil {
			log.Println("\033[1mFailed to connect to "+upstreamTCP+" \033[0m:", err)
			return nil, err
		}
	}
	defer conn.Close()

	// Sending the request
	_, err = conn.Write(buffer.Bytes())
	if err != nil {
		return nil, err
	}

	// Calculating the expected buffer size
	bufferSize := request.Resolution * request.Resolution * 4
	receivedData := make([]byte, bufferSize)
	_, err = io.ReadFull(conn, receivedData)
	if err != nil {
		return nil, err
	}

	return receivedData, nil
}

// ssaaFactor controls the resolution and scale multiplier.
//const ssaaFactor = 2

var encoder = png.Encoder{CompressionLevel: png.BestSpeed}

// renderImage handles the /render.png endpoint
func renderImage(ow http.ResponseWriter, r *http.Request) {
	// NOTE: permissive config here is somewhat temporary
	header := ow.Header()
	header.Set("Access-Control-Allow-Private-Network", "true")
	header.Set("Access-Control-Allow-Origin", "*")
	header.Set("Access-Control-Allow-Methods", "POST")
	header.Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method == "OPTIONS" {
		// do not return any text on OPTIONS and preflight headers were already sent
		return
	}

	query := r.URL.Query()

	// use original response writer
	w := ow
	errorSessionAndRequestID := query.Get("erri")
	if errorSessionAndRequestID != "" {
		parts := strings.Split(errorSessionAndRequestID, "-")
		if len(parts) != 2 {
			http.Error(w, "the combined error session and request id, called \"erri\", does not contain exactly one dash or has more than two parts", http.StatusBadRequest)
			return
		}
		errorSessionID := parts[0]
		errorRequestID := parts[1]
		// ... unless error parameters are available
		w = &errorResponseWriter{ResponseWriter: w, sessionID: errorSessionID, requestID: errorRequestID}
	}

	data := query.Get("data")
	typeStr := query.Get("type")
	if typeStr == "" {
		typeStr = "face"
	}
	expressionStr := query.Get("expression")
	widthStr := query.Get("width")
	if widthStr == "" {
		widthStr = "270" // default width
	}
	ssaaFactorStr := query.Get("scale")
	if ssaaFactorStr == "" {
		ssaaFactorStr = "2" // default scale is 2x
	}
	// overrideTexResolution is set if the user specified texResolution
	overrideTexResolution := false
	texResolutionStr := query.Get("texResolution")
	if texResolutionStr == "" {
		texResolutionStr = widthStr
	} else {
		overrideTexResolution = true
	}
	nnid := query.Get("nnid")
	resourceTypeStr := query.Get("resourceType")
	if resourceTypeStr == "" {
		resourceTypeStr = "1"
	}
	shaderTypeStr := query.Get("shaderType")
	if shaderTypeStr == "" {
		shaderTypeStr = "0"
	}

	var storeData []byte
	var err error

	// Checking for required data
	/*if widthStr == "" {
		http.Error(w, "specify a width", http.StatusBadRequest)
		return
	}*/
	if data == "" && nnid == "" {
		http.Error(w, "specify data as FFLStoreData/mii studio data in hex/base64, or nnid as an nnid, also specify \"width\" as the resolution", http.StatusBadRequest)
		return
	}

	// Fetching data from database if nnid is provided
	if nnid != "" {
		// if there is no mii data, but there IS an nnid...
		// (data takes priority over nnid)
		if !validNNIDRegex.MatchString(nnid) {
			http.Error(w,
				"nnids are 4-16 alphanumeric chars with dashes, underscores, and dots",
				http.StatusBadRequest)
			return
		}
		// selects which api endpoint to use from apiBases
		// 0 (default) is nintendo, 1 is pretendo
		apiID, _ := strconv.Atoi(query.Get("api_id"))

		if useNNIDToMiiMapForAPI0 && apiID == 0 {
			// use nnid to mii map database instead...
			nnid = normalizeDashUnderscoreDot(nnid)

			var mii NNIDToMiiDataMap
			result := mdb.Model(&mii).Where("normalized_nnid = ?", nnid).First(&mii)

			if result.Error != nil {
				if result.Error == gorm.ErrRecordNotFound {
					http.Error(w, "NNID not found in archive", http.StatusNotFound)
				} else {
					http.Error(w, result.Error.Error(), http.StatusInternalServerError)
				}
				return
			}

			// use later
			storeData = mii.Data
		} else {
			pid, err := fetchNNIDToPID(nnid, apiID)
			if err != nil {
				// usually the resolution error means the nnid does not exist
				// it can also just mean it cannot reach the account server or it failed
				// it can also mean but i donot care enough to add differentiation logic
				http.Error(w, "error resolving nnid to pid: "+err.Error(), http.StatusNotFound)
				return
			}

			forceRefresh, _ := strconv.ParseBool(query.Get("force_refresh"))

			var miiResponse MiisResponse

			miiResponse, err = fetchMii(pid, apiID, forceRefresh)
			if err != nil {
				http.Error(w, "error fetching mii after nnid to pid resolution: "+err.Error(), http.StatusInternalServerError)
				return
			}

			storeData, err = base64.StdEncoding.DecodeString(miiResponse.Miis[0].Data)
			if err != nil {
				http.Error(w, "failed to decode base64 from your pnid's mii data for whatever reason: "+err.Error(), http.StatusInternalServerError)
				return
			}
		}
	} else {
		// Decoding data from hex or base64
		data = strings.ReplaceAll(data, " ", "")
		if isHex(data) {
			storeData, err = hex.DecodeString(data)
		} else {
			storeData, err = decodeBase64(data)
		}
		if err != nil {
			http.Error(w, fmt.Sprintf("failed to decode data: %v", err), http.StatusBadRequest)
			return
		}
	}

	// Data length validation
	/*
		if len(storeData) != 96 {
			http.Error(w, "fflstoredata must be 96 bytes please", http.StatusBadRequest)
			return
		}
	*/
	// 46: size of studio data raw
	// 96: length of FFLStoreData
	if len(storeData) < 46 || len(storeData) > 96 {
		http.Error(w, "data length should be between 46-96 bytes", http.StatusBadRequest)
		return
	}

	// parse background color
	var bgColor color.NRGBA
	// set default background color
	// NOTE: DEFAULT BACKGROUND COLOR IS NOT ALL ZEROES!!!!
	// IT IS TRANSPARENT WHITE. NOT USING THAT MAKES GLASSES TINTS WRONG
	bgColor = color.NRGBA{R: 0xFF, G: 0xFF, B: 0xFF, A: 0x0}
	// taken from nwf-mii-cemu-toy miiPostHandler
	bgColorParam := query.Get("bgColor")
	// only process bgColor if it  exists
	if bgColorParam != "" {
		// this function will panic if length is 0
		bgColor, err = ParseHexColorFast(bgColorParam)
		// ignore alpha zero error
		if err != nil && err != errAlphaZero {
			http.Error(w, "bgColor format is wrong: "+err.Error(), http.StatusBadRequest)
			return
		}
	}

	viewTypeStr := query.Get("type")
	if viewTypeStr == "" {
		viewTypeStr = "face"
	}

	viewType, exists := viewTypes[viewTypeStr]
	if !exists {
		http.Error(w, "we did not implement that view sorry", http.StatusBadRequest)
		return
	}
	// NOTE: WHAT SHOULD BOOLS LOOK LIKE...???
	mipmapEnable := query.Get("mipmapEnable") != "" // is present?
	lightEnable := query.Get("lightEnable") != "0" // 0 = no lighting
	verifyCharInfo := query.Get("verifyCharInfo") != "0" // verify default

	// Parsing and validating expression flag
	/*expressionFlag, err := strconv.Atoi(expressionFlagStr)
	if err != nil {
		http.Error(w, `oh, sorry... expression is the expression FLAG, not the name of the expression. find the values at https://github.com/ariankordi/nwf-mii-cemu-toy/blob/master/nwf-app/js/render-listener.js#L138`, http.StatusBadRequest)
		return
	}
	if expressionFlag < 1 {
		expressionFlag = 1
	}*/
	//expressionFlag := getExpressionFlag(expressionStr)
	expression := getExpressionInt(expressionStr)

	// Parsing and validating width
	width, err := strconv.Atoi(widthStr)
	if err != nil {
		http.Error(w, "width = resolution, int, no limit on this lmao,", http.StatusBadRequest)
		return
	}
	if width > 4096 {
		http.Error(w, "ok bro i set the limit to 4K", http.StatusBadRequest)
		return
	}

	// Parsing and validating texture resolution
	texResolution, err := strconv.Atoi(texResolutionStr)
	if err != nil || texResolution < 2 {
		http.Error(w, "texResolution is not a number", http.StatusBadRequest)
		return
	}
	// NOTE: excessive high texture resolutions crash (assert fail) the renderer
	if texResolution > 8192 {
		http.Error(w, "you cannot make texture resolution this high it will make your balls explode", http.StatusBadRequest)
		return
	}

	// Parsing and validating resource type
	resourceType, err := strconv.Atoi(resourceTypeStr)
	if err != nil {
		http.Error(w, "resource type is not a number", http.StatusBadRequest)
		return
	}

	ssaaFactor, err := strconv.Atoi(ssaaFactorStr)
	if err != nil || ssaaFactor > 2 {
		http.Error(w, "scale must be a number less than 2", http.StatusBadRequest)
		return
	}


	cameraRotateVec3i := [3]int32{0, 0, 0}

	// Read and parse query parameters
	if camXPos := query.Get("cameraXRotate"); camXPos != "" {
		x, err := strconv.Atoi(camXPos)
		if err == nil {
			cameraRotateVec3i[0] = int32(x)
		}
	} else if charXPos := query.Get("characterXRotate"); charXPos != "" {
		x, err := strconv.Atoi(charXPos)
		if err == nil {
			cameraRotateVec3i[0] = int32(x)
		}
	}

	if camYPos := query.Get("cameraYRotate"); camYPos != "" {
		y, err := strconv.Atoi(camYPos)
		if err == nil {
			cameraRotateVec3i[1] = int32(y)
		}
	} else if charYPos := query.Get("characterYRotate"); charYPos != "" {
		y, err := strconv.Atoi(charYPos)
		if err == nil {
			cameraRotateVec3i[1] = int32(y)
		}
	}

	if camZPos := query.Get("cameraZRotate"); camZPos != "" {
		z, err := strconv.Atoi(camZPos)
		if err == nil {
			cameraRotateVec3i[2] = int32(z)
		}
	} else if charZPos := query.Get("characterZRotate"); charZPos != "" {
		z, err := strconv.Atoi(charZPos)
		if err == nil {
			cameraRotateVec3i[2] = int32(z)
		}
	}

	// Strip mipmap bit from texResolution
	texResolution &= FFLResolutionMask
	// Also multiply it by two if it's particularly low...
	if width < 256 && !overrideTexResolution {
		texResolution *= 2
	}
	// Apply ssaaFactor to width
	width *= ssaaFactor
	// Also apply it to texResolution
	if !overrideTexResolution {
		texResolution *= ssaaFactor
	}

	// convert bgColor to floats
	//bgColor4f := [4]float32{float32(bgColor.R), float32(bgColor.G), float32(bgColor.B), float32(bgColor.A)}

	bgColor4u8 := [4]uint8{bgColor.R, bgColor.G, bgColor.B, bgColor.A}

	/*shaderType := 0
	if resourceType > 1 {
		shaderType = 1
	}*/
	shaderType, err := strconv.Atoi(shaderTypeStr)
	if err != nil {
		http.Error(w, "shader type is not a number", http.StatusBadRequest)
		return
	}

	// Creating the render request
	renderRequest := RenderRequest{
		Data:            [96]byte{},
		DataLength:      uint16(len(storeData)),
		Resolution:      uint32(width),
		TexResolution:   uint32(texResolution),
		ViewType:        uint8(viewType),
		Expression:      uint8(expression),
		ResourceType:    uint8(resourceType),
		ShaderType:      uint8(shaderType),
		CameraRotate:    cameraRotateVec3i,
		BackgroundColor: bgColor4u8,
		VerifyCharInfo:  verifyCharInfo,
		LightEnable:     lightEnable,
	}

	// Enabling mipmap if specified
	if mipmapEnable {
		renderRequest.TexResolution += FFLResolutionMipmapEnableMask
	}

	// Copying store data into the request data buffer
	copy(renderRequest.Data[:], storeData)

	// Sending the render request and receiving buffer data
	bufferData, err := sendRenderRequest(renderRequest)
	if err != nil {
		/*
		isIncompleteData := err.Error() == "EOF"
		var opError *net.OpError
		var syscallError *os.SyscallError
		if errors.As(err, &opError) && errors.As(err, &syscallError) {
			if syscallError.Err == syscall.ECONNRESET ||
				// WSAECONNREFUSED on windows
				syscallError.Err == syscall.Errno(10061) {
					isIncompleteData = true
				}
		}
		*/
		// Handling incomplete data response
		if err.Error() == "EOF" ||
		errors.Is(err, syscall.ECONNRESET) ||
		// WSAECONNREFUSED on windows
		errors.Is(err, syscall.Errno(10061)) {
			http.Error(w, `incomplete data from backend :( render probably failed bc FFLInitCharModelCPUStep failed... probably because data is invalid
<details>
<summary>
TODO: to make this error better here are the steps where the error is discarded:
</summary>
<pre>
* RootTask::calc_ responds to socket
* Model::initialize makes model nullptr
* Model::setCharModelSource_ calls initializeCpu_
* Model::initializeCpu_ calls FFLInitCharModelCPUStep
  - FFLResult is discarded here
* FFLInitCharModelCPUStep...
* FFLiInitCharModelCPUStep...
* FFLiCharModelCreator::ExecuteCPUStep
* FFLiDatabaseManager::PickupCharInfo
now, PickupCharInfo calls:
* GetCharInfoFromStoreData, fails if StoreData is not big enough or its CRC16 fails - pretty simple.
* FFLiiVerifyCharInfo or FFLiIsNullMiiID are called.
  - i think FFLiIsNullMiiID is for if a mii is marked as deleted by setting its ID to null
  - FFLiiVerifyCharInfo -> FFLiVerifyCharInfoWithReason
    + FFLiVerifyCharInfoReason is discarded here
    + <b>FFLiVerifyCharInfoWithReason IS THE MOST LIKELY REASON</b>
</pre>
</details>
		`, http.StatusInternalServerError)
			return
		}
		http.Error(w, "incomplete response from backend, error is: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Creating an image directly using the buffer
	img := &image.NRGBA{
		Pix:    bufferData,
		Stride: width * 4,
		Rect:   image.Rect(0, 0, width, width),
	}

	if ssaaFactor != 1 {
		// Scale down image by the ssaaFactor
		width /= ssaaFactor
		scaledImg := image.NewNRGBA(image.Rect(0, 0, width, width))
		// Use draw.ApproxBiLinear method
		// TODO: try better scaling but this is already pretty fast
		draw.ApproxBiLinear.Scale(scaledImg, scaledImg.Bounds(), img, img.Bounds(), draw.Over, nil)
		// replace the image with the scaled version
		img = scaledImg
	}

	// Sending the image as a PNG response
	header.Set("Content-Type", "image/png")
	encoder.Encode(w, img)
}

// Expression constants
const (
	FFL_EXPRESSION_NORMAL                = 0
	FFL_EXPRESSION_SMILE                 = 1
	FFL_EXPRESSION_ANGER                 = 2
	FFL_EXPRESSION_SORROW                = 3
	FFL_EXPRESSION_SURPRISE              = 4
	FFL_EXPRESSION_BLINK                 = 5
	FFL_EXPRESSION_OPEN_MOUTH            = 6
	FFL_EXPRESSION_HAPPY                 = 7
	FFL_EXPRESSION_ANGER_OPEN_MOUTH      = 8
	FFL_EXPRESSION_SORROW_OPEN_MOUTH     = 9
	FFL_EXPRESSION_SURPRISE_OPEN_MOUTH   = 10
	FFL_EXPRESSION_BLINK_OPEN_MOUTH      = 11
	FFL_EXPRESSION_WINK_LEFT             = 12
	FFL_EXPRESSION_WINK_RIGHT            = 13
	FFL_EXPRESSION_WINK_LEFT_OPEN_MOUTH  = 14
	FFL_EXPRESSION_WINK_RIGHT_OPEN_MOUTH = 15
	FFL_EXPRESSION_LIKE                  = 16
	FFL_EXPRESSION_LIKE_WINK_RIGHT       = 17
	FFL_EXPRESSION_FRUSTRATED            = 18
)

// Expression flag constants
const (
	FFL_EXPRESSION_FLAG_NORMAL                = 1 << FFL_EXPRESSION_NORMAL
	FFL_EXPRESSION_FLAG_SMILE                 = 1 << FFL_EXPRESSION_SMILE
	FFL_EXPRESSION_FLAG_ANGER                 = 1 << FFL_EXPRESSION_ANGER
	FFL_EXPRESSION_FLAG_SORROW                = 1 << FFL_EXPRESSION_SORROW
	FFL_EXPRESSION_FLAG_SURPRISE              = 1 << FFL_EXPRESSION_SURPRISE
	FFL_EXPRESSION_FLAG_BLINK                 = 1 << FFL_EXPRESSION_BLINK
	FFL_EXPRESSION_FLAG_OPEN_MOUTH            = 1 << FFL_EXPRESSION_OPEN_MOUTH
	FFL_EXPRESSION_FLAG_HAPPY                 = 1 << FFL_EXPRESSION_HAPPY
	FFL_EXPRESSION_FLAG_ANGER_OPEN_MOUTH      = 1 << FFL_EXPRESSION_ANGER_OPEN_MOUTH
	FFL_EXPRESSION_FLAG_SORROW_OPEN_MOUTH     = 1 << FFL_EXPRESSION_SORROW_OPEN_MOUTH
	FFL_EXPRESSION_FLAG_SURPRISE_OPEN_MOUTH   = 1 << FFL_EXPRESSION_SURPRISE_OPEN_MOUTH
	FFL_EXPRESSION_FLAG_BLINK_OPEN_MOUTH      = 1 << FFL_EXPRESSION_BLINK_OPEN_MOUTH
	FFL_EXPRESSION_FLAG_WINK_LEFT             = 1 << FFL_EXPRESSION_WINK_LEFT
	FFL_EXPRESSION_FLAG_WINK_RIGHT            = 1 << FFL_EXPRESSION_WINK_RIGHT
	FFL_EXPRESSION_FLAG_WINK_LEFT_OPEN_MOUTH  = 1 << FFL_EXPRESSION_WINK_LEFT_OPEN_MOUTH
	FFL_EXPRESSION_FLAG_WINK_RIGHT_OPEN_MOUTH = 1 << FFL_EXPRESSION_WINK_RIGHT_OPEN_MOUTH
	FFL_EXPRESSION_FLAG_LIKE                  = 1 << FFL_EXPRESSION_LIKE
	FFL_EXPRESSION_FLAG_LIKE_WINK_RIGHT       = 1 << FFL_EXPRESSION_LIKE_WINK_RIGHT
	FFL_EXPRESSION_FLAG_FRUSTRATED            = 1 << FFL_EXPRESSION_FRUSTRATED
)

// Map of expression strings to their respective flags
var expressionMap = map[string]int{
	"surprise":              FFL_EXPRESSION_SURPRISE,
	"surprise_open_mouth":   FFL_EXPRESSION_SURPRISE_OPEN_MOUTH,
	"wink_left_open_mouth":  FFL_EXPRESSION_WINK_LEFT_OPEN_MOUTH,
	"like":                  FFL_EXPRESSION_LIKE,
	"anger_open_mouth":      FFL_EXPRESSION_ANGER_OPEN_MOUTH,
	"blink_open_mouth":      FFL_EXPRESSION_BLINK_OPEN_MOUTH,
	"anger":                 FFL_EXPRESSION_ANGER,
	"like_wink_left":        FFL_EXPRESSION_LIKE,
	"happy":                 FFL_EXPRESSION_HAPPY,
	"blink":                 FFL_EXPRESSION_BLINK,
	"smile":                 FFL_EXPRESSION_SMILE,
	"sorrow_open_mouth":     FFL_EXPRESSION_SORROW_OPEN_MOUTH,
	"wink_right":            FFL_EXPRESSION_WINK_RIGHT,
	"sorrow":                FFL_EXPRESSION_SORROW,
	"normal":                FFL_EXPRESSION_NORMAL,
	"like_wink_right":       FFL_EXPRESSION_LIKE_WINK_RIGHT,
	"wink_right_open_mouth": FFL_EXPRESSION_WINK_RIGHT_OPEN_MOUTH,
	"smile_open_mouth":      FFL_EXPRESSION_HAPPY,
	"frustrated":            FFL_EXPRESSION_FRUSTRATED,
	"surprised":             FFL_EXPRESSION_SURPRISE,
	"wink_left":             FFL_EXPRESSION_WINK_LEFT,
	"open_mouth":            FFL_EXPRESSION_OPEN_MOUTH,
	"puzzled":               FFL_EXPRESSION_SORROW, // assuming PUZZLED is similar to SORROW
	"normal_open_mouth":     FFL_EXPRESSION_OPEN_MOUTH,
}

// Function to map a string input to an expression flag
func getExpressionFlag(input string) int {
	input = strings.ToLower(input)
	if expression, exists := expressionMap[input]; exists {
		return 1 << expression
	}
	return 1 << FFL_EXPRESSION_NORMAL
}

func getExpressionInt(input string) int {
	input = strings.ToLower(input)
	if expression, exists := expressionMap[input]; exists {
		return expression
	}
	return FFL_EXPRESSION_NORMAL
}


// NOTE: BELOW IS IN nwf-mii-cemu-toy handlers.go

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
		// NOTE: the official mii studio api DOES NOT accept lowercase
		// ... however, this function is used for both studio format RGBA hex
		// as well as traditional RGB hex so we will forgive it
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
		c.R, c.G, c.B, c.A = r, g, b, a
		if a > 0 {
			// alpha is zero, meaning transparent
			err = errAlphaZero
		}
	}

	return
}
