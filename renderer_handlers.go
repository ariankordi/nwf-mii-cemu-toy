package main

import (
	"bytes"
	"log"
	"time"

	//"database/sql"
	"bufio"
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

// RenderRequest is the equivalent struct in Go for handling the render request data.
type RenderRequest struct {
	Data                 [96]byte
	DataLength           uint16
	ModelFlag            uint8
	ResponseFormat       uint8   // rgba, gltf, tga
	Resolution           uint16
	TexResolution        int16
	ViewType             uint8
	ResourceType         uint8
	ShaderType           uint8
	Expression           uint8
	ExpressionFlag       FFLAllExpressionFlag //uint32  // used if there are multiple
	CameraRotate         [3]int16
	ModelRotate          [3]int16
	BackgroundColor      [4]uint8

	AAMethod             uint8   // UNUSED
	DrawStageMode        uint8
	VerifyCharInfo       bool
	VerifyCRC16          bool
	LightEnable          bool
	ClothesColor         int8    // default: -1
	PantsColor           uint8
	InstanceCount        uint8   // UNUSED
	InstanceRotationMode uint8   // UNUSED
	_                    [3]byte // padding for alignment
	//SetLightDirection bool
	//LightDirection    [3]int32
}

const FFL_EXPRESSION_LIMIT = 70
type FFLAllExpressionFlag struct {
	Flags [3]uint32 // 0-96
}
func SetExpressionFlagIndex(ef *FFLAllExpressionFlag, index int, set bool) {
	if index < 0 || index >= FFL_EXPRESSION_LIMIT {
		fmt.Printf("FFLSetExpressionFlagIndex: input out of range: %d\n", index)
		return // Do not set anything.
	}

	part := index / 32       // Determine which 32-bit block
	bitIndex := index % 32   // Determine which bit within the block

	if set {
		ef.Flags[part] |= (1 << bitIndex) // Set the bit
	} else {
		ef.Flags[part] &^= (1 << bitIndex) // Clear the bit
	}
}

// TGAHeader is put in front of render responses.
// It indicates the width, height, and BPP of the render.
// Note that while TGAs are supposed to represent BGRA...
// ... currently the server outputs RGBA. But this could
// be changed in the future to directly output compliant
// TGA if needed. Otherwise most of this is still unused
type TGAHeader struct {
	IDLength        uint8 // unused (0)
	ColorMapType    uint8 // always 0 for no color map
	ImageType       uint8 // image_type_enum, 2 = uncomp_true_color
	ColorMapOrigin  int16 // unused
	ColorMapLength  int16 // unused (0)
	ColorMapDepth   uint8 // unused
	OriginX         int16 // unused (0)
	OriginY         int16 // unused (0)
	Width           int16 // Width of the image in pixels
	Height          int16 // Height of the image in pixels
	BitsPerPixel    uint8 // Number of bits per pixel
	ImageDescriptor uint8 // ???
}

// GLBHeader represents a binary glTF header and it
// is used to return the size of a glTF before it is fully read.
type GLBHeader struct {
	Magic   uint32 // we do not actually care about these
	Version uint32
	Length  uint32
}

var viewTypes = map[string]int{
	"face":             0,
	"face_only":        1,
	"all_body":         2,
	"fflmakeicon":      3,
	"variableiconbody": 4,
	"all_body_sugar":   5,
}

var modelTypes = map[string]int{
	"normal":    0,
	"hat":       1,
	"face_only": 2,
}

var drawStageModes = map[string]int{
	"all":       0,
	"opa_only":  1,
	"xlu_only":  2,
	"mask_only": 3,
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

func isConnectionRefused(err error) bool {
	return errors.Is(err, syscall.ECONNREFUSED) ||
		// WSAECONNREFUSED on windows
		errors.Is(err, syscall.Errno(10061))
}

// if a socket response starts with this it
// is always read out to the api response
const socketErrorPrefix = "ERROR: "

// sendRenderRequest sends the render request to the render server
// It returns the first KB and a reader for the data.
func sendRenderRequest(request RenderRequest) ([]byte, io.Reader, error) {
	// Serialize the RenderRequest struct
	var buffer bytes.Buffer
	err := binary.Write(&buffer, binary.LittleEndian, request)
	if err != nil {
		return nil, nil, err
	}

	// Determine the upstream render server to connect to
	var conn net.Conn
	if rr != nil {
		// Use round-robin balancer
		nextServer := rr.Next().Host
		//log.Println("using this upstream:", nextServer)
		conn, err = net.Dial("tcp", nextServer)
		if err != nil {
			log.Println("\033[1;31mURGENT: Failed to connect to "+nextServer+". The upstream may be down:\033[0m", err)

			go handleConnectionRefused(err) // handle error async

			return nil, nil, err
		}
	} else {
		// Use single upstream server
		conn, err = net.Dial("tcp", upstreamTCP)
		if err != nil {
			log.Println("\033[1mFailed to connect to "+upstreamTCP+" \033[0m:", err)
			return nil, nil, err
		}
	}

	// Send the render request
	_, err = conn.Write(buffer.Bytes())
	if err != nil {
		conn.Close()
		return nil, nil, err
	}

	// Buffer the first KB of the response
	// The caller will use this to parse a header or error
	initialBuffer := make([]byte, 1024)
	_, err = io.ReadFull(conn, initialBuffer)
	if err != nil {
		conn.Close()
		return initialBuffer, nil, err
	}

	return initialBuffer, conn, nil
}

// handleRenderRequestError sends a response for an error from the renderer backend.
func handleRenderRequestError(w http.ResponseWriter, bufferData []byte, err error) {
	// Handling incomplete data response
	if err.Error() == "EOF" ||
		err.Error() == "unexpected EOF" || // from io.ReadFull
		errors.Is(err, syscall.ECONNRESET) {
		// if it begins with the prefix
		responseStr := string(bufferData)
		// Find the first occurrence of the null character (0 byte)
		if nullIndex := strings.Index(responseStr, string(byte(0))); nullIndex != -1 {
			// If the null character exists, slice the string until that point
			responseStr = responseStr[:nullIndex]
		}
		if strings.HasPrefix(responseStr, socketErrorPrefix) {
			// in this case, respond with that error
			http.Error(w, "renderer returned "+responseStr, http.StatusInternalServerError)
			return
		}

		http.Error(w, `incomplete data from backend :( render probably failed for one of the following reasons:
* FFLInitCharModelCPUStep failed: internal error or use of out-of-bounds parts
* FFLiVerifyCharInfoWithReason failed: mii data/CharInfo is invalid`, http.StatusInternalServerError)
		return
		// handle connection refused/backend down
	} else if isConnectionRefused(err) {
		msg := "OH NO!!! the site is up, but the renderer backend is down..."
		if sentryInitialized {
			msg += "\n(AN ALERT HAS BEEN SENT TO THE SITE OWNER ABOUT THIS. please try again in a few minutes...)"
		}
		msg += "\nerror detail: " + err.Error()
		http.Error(w, msg, http.StatusInternalServerError)
		return
	}
	http.Error(w, "incomplete response from backend, error is: "+err.Error(), http.StatusInternalServerError)
}

// ssaaFactor controls the resolution and scale multiplier.
//const ssaaFactor = 2

var encoder = png.Encoder{CompressionLevel: png.BestSpeed}

// renderImage handles the /miis/image.png endpoint
func renderImage(ow http.ResponseWriter, r *http.Request) {
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
	usingDefaultWidth := false
	if widthStr == "" {
		usingDefaultWidth = true
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
	pidStr := query.Get("pid")
	resourceTypeStr := query.Get("resourceType")
	if resourceTypeStr == "" {
		resourceTypeStr = "1"
	}
	shaderTypeStr := query.Get("shaderType")
	if shaderTypeStr == "" {
		shaderTypeStr = "0"
	}
	clothesColorStr := query.Get("clothesColor")
	if clothesColorStr == "" {
		clothesColorStr = "-1"
	}
	pantsColorStr := query.Get("pantsColor")
	if pantsColorStr == "" {
		pantsColorStr = "red"
	}

	var responseFormat uint8 = 0
	if strings.HasSuffix(r.URL.Path, ".glb") {
		responseFormat = 1 // output is gltf
	} else if strings.HasSuffix(r.URL.Path, ".tga") {
		responseFormat = 2 // flips Y, emits BGRA
	}

	var storeData []byte
	var err error

	// Checking for required data
	/*if widthStr == "" {
		http.Error(w, "specify a width", http.StatusBadRequest)
		return
	}*/
	if data == "" && nnid == "" && pidStr == "" {
		http.Error(w, "specify \"data\" as FFLStoreData/mii studio data in hex/base64, or \"nnid\" as an nnid (add &api_id=1 if it is a pnid), finally specify \"width\" as the resolution", http.StatusBadRequest)
		return
	}

	// Fetching data from database if nnid is provided
	if nnid != "" || pidStr != "" {
		var pidQuery int64
		pidQuery = -1
		if nnid != "" {
			if !validNNIDRegex.MatchString(nnid) {
				http.Error(w,
					"nnids are 4-16 alphanumeric chars with dashes, underscores, and dots",
					http.StatusBadRequest)
				return
			}
		} else if pidStr != "" {
			pidQuery, err = strconv.ParseInt(pidStr, 10, 64)
			if err != nil || pidQuery <= 0 {
				http.Error(w, "invalid pid provided", http.StatusBadRequest)
				return
			}
		}
		// selects which api endpoint to use from apiBases
		// 0 (default) is nintendo, 1 is pretendo
		apiID, _ := strconv.Atoi(query.Get("api_id"))

		if useNNIDToMiiMapForAPI0 && apiID == 0 {
			// use nnid to mii map database instead...
			var mii NNIDToMiiDataMap
			if pidQuery != -1 {
				result := mdb.Model(&mii).Where("pid = ?", pidQuery).First(&mii)

				if result.Error != nil {
					if result.Error == gorm.ErrRecordNotFound {
						http.Error(w, "PID not found in archive", http.StatusNotFound)
					} else {
						http.Error(w, result.Error.Error(), http.StatusInternalServerError)
					}
					return
				}
			} else {
				nnid = normalizeDashUnderscoreDot(nnid)

				result := mdb.Model(&mii).Where("normalized_nnid = ?", nnid).First(&mii)

				if result.Error != nil {
					if result.Error == gorm.ErrRecordNotFound {
						http.Error(w, "NNID not found in archive", http.StatusNotFound)
					} else {
						http.Error(w, result.Error.Error(), http.StatusInternalServerError)
					}
					return
				}
			}

			// use later
			storeData = mii.Data
		} else {
			var pid uint64
			if pidQuery == -1 {
				pid, err = fetchNNIDToPID(nnid, apiID)
				if err != nil {
					// usually the resolution error means the nnid does not exist
					// it can also just mean it cannot reach the account server or it failed
					// it can also mean but i donot care enough to add differentiation logic
					http.Error(w, "error resolving nnid to pid: "+err.Error(), http.StatusNotFound)
					return
				}
			} else {
				pid = uint64(pidQuery)
			}

			forceRefresh, _ := strconv.ParseBool(query.Get("force_refresh"))

			var miiResponse MiisResponse

			miiResponse, err = fetchMiiFromPID(pid, apiID, forceRefresh)
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

	modelTypeStr := query.Get("modelType")
	if modelTypeStr == "" {
		modelTypeStr = "normal"
	}
	modelType, exists := modelTypes[modelTypeStr]
	if !exists {
		http.Error(w, "valid model types: normal, hat, face_only", http.StatusBadRequest)
		return
	}
	/*
		modelType, err := strconv.Atoi(modelTypeStr)
		if err != nil || modelType > 2 {
			http.Error(w, "modelType must be 0-2", http.StatusBadRequest)
			return
		}
	*/
	flattenNose := query.Get("flattenNose") != ""

	modelFlag := (1 << modelType)
	if flattenNose {
		modelFlag |= (1 << 3)
	}

	drawStageModeStr := query.Get("drawStageMode")
	if drawStageModeStr == "" {
		drawStageModeStr = "all"
	}
	drawStageMode, exists := drawStageModes[drawStageModeStr]
	if !exists {
		drawStageMode = 0
	}

	// NOTE: WHAT SHOULD BOOLS LOOK LIKE...???
	mipmapEnable := query.Get("mipmapEnable") != ""      // is present?
	lightEnable := query.Get("lightEnable") != "0"       // 0 = no lighting
	verifyCharInfo := query.Get("verifyCharInfo") != "0" // verify default

	// Parsing and validating resource type
	resourceType, err := strconv.Atoi(resourceTypeStr)
	if err != nil {
		http.Error(w, "resource type is not a number", http.StatusBadRequest)
		return
	}
	verifyCRC16 := query.Get("verifyCRC16") != "0" // 0 = no verify

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
	// first try to parse the expression as int
	// should be safe as long as the server wraps around exp flags
	var expression int
	expression, err = strconv.Atoi(expressionStr)
	if err != nil {
		// now try to parse it as a string
		// this defaults to normal if it fails
		expression = getExpressionInt(expressionStr)
	}

	if expression > 18 && resourceType < 1 {
		http.Error(w, "🥺🥺 🥺🥺🥺🥺 🥺🥺🥺, 🥺🥺🥺 😔 (Translation: Sorry, you cannot use this expression with the middle resource.)", http.StatusBadRequest)
		return
	}

	var expressionFlag FFLAllExpressionFlag //uint32 = 0
	// check for multiple expressions
	// (only applies for glTF!!!!!!!)
	if responseFormat == 1 && query.Has("expression") {
		expressionStr := query.Get("expression")
		// Split the comma-separated expressions
		expressions := strings.Split(expressionStr, ",")

		// Multiple expressions provided, compose the expression flag.
		for _, expressionStr := range expressions {
			// Trim spaces around each expression.
			expressionStr = strings.TrimSpace(expressionStr)

			// parse expression or use as an int
			var expression int
			expression, err = strconv.Atoi(expressionStr)
			if err != nil {
				// now try to parse it as a string
				// this defaults to normal if it fails
				expression = getExpressionInt(expressionStr)
			}
			// set expression flag
			// Bitwise OR to combine all the flags
			//expressionFlag |= (1 << expression)
			SetExpressionFlagIndex(&expressionFlag, expression, true)
		}
	}


	var clothesColor int
	clothesColor, err = strconv.Atoi(clothesColorStr)
	if err != nil {
		clothesColor = getClothesColorInt(clothesColorStr)
	}
	var pantsColor int
	pantsColor, err = strconv.Atoi(pantsColorStr)
	if err != nil {
		pantsColor = getPantsColorInt(pantsColorStr)
	}

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
	if texResolution > 6000 {
		http.Error(w, "you cannot make texture resolution this high it will make your balls explode", http.StatusBadRequest)
		return
	}

	ssaaFactor, err := strconv.Atoi(ssaaFactorStr)
	if err != nil || ssaaFactor > 2 {
		http.Error(w, "scale must be a number less than 2", http.StatusBadRequest)
		return
	}

	cameraRotateVec3i := [3]int16{0, 0, 0}

	// Read and parse query parameters
	if camXPos := query.Get("cameraXRotate"); camXPos != "" {
		x, err := strconv.Atoi(camXPos)
		if err == nil {
			cameraRotateVec3i[0] = int16(x)
		}
	}
	if camYPos := query.Get("cameraYRotate"); camYPos != "" {
		y, err := strconv.Atoi(camYPos)
		if err == nil {
			cameraRotateVec3i[1] = int16(y)
		}
	}
	if camZPos := query.Get("cameraZRotate"); camZPos != "" {
		z, err := strconv.Atoi(camZPos)
		if err == nil {
			cameraRotateVec3i[2] = int16(z)
		}
	}

	modelRotateVec3i := [3]int16{0, 0, 0}

	if charXPos := query.Get("characterXRotate"); charXPos != "" {
		x, err := strconv.Atoi(charXPos)
		if err == nil {
			modelRotateVec3i[0] = int16(x)
		}
	}
	if charYPos := query.Get("characterYRotate"); charYPos != "" {
		y, err := strconv.Atoi(charYPos)
		if err == nil {
			modelRotateVec3i[1] = int16(y)
		}
	}
	if charZPos := query.Get("characterZRotate"); charZPos != "" {
		z, err := strconv.Atoi(charZPos)
		if err == nil {
			modelRotateVec3i[2] = int16(z)
		}
	}

	// Also multiply it by two if it's particularly low...
	if width < 256 && !overrideTexResolution {
		texResolution *= 2
	}
	if drawStageMode == 3 { // mask only means it will return the texResolution
		if usingDefaultWidth {
			width = texResolution
		} else {
			texResolution = width
		}
		ssaaFactor = 1
	} else { // do not upscale aa or change texresolution then
		// Apply ssaaFactor to width
		width *= ssaaFactor
		// Also apply it to texResolution
		if !overrideTexResolution {
			texResolution *= ssaaFactor
		}
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
		ModelFlag:       uint8(modelFlag),
		ResponseFormat:  responseFormat,
		Resolution:      uint16(width),
		TexResolution:   int16(texResolution),
		ViewType:        uint8(viewType),
		ResourceType:    uint8(resourceType),
		ShaderType:      uint8(shaderType),
		Expression:      uint8(expression),
		ExpressionFlag:  expressionFlag,
		CameraRotate:    cameraRotateVec3i,
		ModelRotate:     modelRotateVec3i,
		BackgroundColor: bgColor4u8,
		DrawStageMode:   uint8(drawStageMode),
		VerifyCharInfo:  verifyCharInfo,
		VerifyCRC16:     verifyCRC16,
		LightEnable:     lightEnable,
		ClothesColor:    int8(clothesColor),
		PantsColor:      uint8(pantsColor),
	}

	// Enabling mipmap if specified
	if mipmapEnable {
		renderRequest.TexResolution *= -1 // negative value means mipmap enabled
	}

	// Copying store data into the request data buffer
	copy(renderRequest.Data[:], storeData)

	var bufferData []byte
	var reader io.Reader
	// Send the render request and receive the initial buffer and reader
	bufferData, reader, err = sendRenderRequest(renderRequest)
	if err != nil {
		handleRenderRequestError(w, bufferData, err)
		return
	}

	fullReader := bufio.NewReader(io.MultiReader(bytes.NewReader(bufferData), reader)) // use bufio to allow discard

	if responseFormat == 1 { // gltf
		// Read size from GLB header
		var glbHeader GLBHeader
		if err := binary.Read(bytes.NewReader(bufferData), binary.LittleEndian, &glbHeader); err != nil {
			http.Error(w, "failed to parse glb header from backend for some reason: "+err.Error(), http.StatusInternalServerError)
			return
		}
		// all we care about is the length
		glbSize := strconv.Itoa(int(glbHeader.Length))
		// set content-length from it
		w.Header().Set("Content-Length", glbSize)

		// now set filename
		filename := time.Now().Format("2006-01-02_15-04-05-")
		if nnid != "" {
			filename += nnid
		} else {
			filename += "mii-data"
		}
		filename += ".glb"
		w.Header().Add("Content-Disposition", "attachment; filename="+filename)

		// Stream the data directly to the HTTP response without buffering
		_, err = io.Copy(w, fullReader)
		if err != nil {
			handleRenderRequestError(w, bufferData, err)
			return
		}

		return // done copying the gltf response
	}

	// If no error, interpret initial buffer as TGA header
	var tgaHeader TGAHeader
	if err := binary.Read(bytes.NewReader(bufferData), binary.LittleEndian, &tgaHeader); err != nil {
		http.Error(w, "failed to parse tga header from backend for some reason: "+err.Error(), http.StatusInternalServerError)
		return
	}
	fullReader.Discard(18) // tga header length, move past the tga reader

	imageDataSize := int(tgaHeader.Width) * int(tgaHeader.Height) * int(tgaHeader.BitsPerPixel) / 8
	imageData := make([]byte, imageDataSize)
	if _, err := io.ReadFull(fullReader, imageData); err != nil {
		handleRenderRequestError(w, bufferData, err)
		return
	}

	// Create an image directly using the read data
	img := &image.NRGBA{
		Pix:    imageData,
		Stride: int(tgaHeader.Width) * 4,
		Rect:   image.Rect(0, 0, int(tgaHeader.Width), int(tgaHeader.Height)),
	}

	if ssaaFactor != 1 {
		// Scale down image by the ssaaFactor
		width := int(tgaHeader.Width) / ssaaFactor
		height := int(tgaHeader.Height) / ssaaFactor
		scaledImg := image.NewNRGBA(image.Rect(0, 0, width, height))
		// Use draw.ApproxBiLinear method
		// TODO: try better scaling but this is already pretty fast
		draw.ApproxBiLinear.Scale(scaledImg, scaledImg.Bounds(), img, img.Bounds(), draw.Over, nil)
		// replace the image with the scaled version
		img = scaledImg
	}

	if responseFormat == 2 { // tga
		// change tga header to reflect img
		tgaHeader.Width = int16(img.Rect.Dx())
		tgaHeader.Height = int16(img.Rect.Dy())
		tgaHeader.BitsPerPixel = 32 // NRGBA

		// size is deterministic so set it
		imageDataSize := int(img.Rect.Dx()) * int(img.Rect.Dy()) * 4 // NRGBA
		size := imageDataSize + 18 // tga header size
		header.Set("Content-Length", strconv.Itoa(size))
		header.Set("Content-Type", "image/tga")

		if err := binary.Write(w, binary.LittleEndian, &tgaHeader); err != nil {
			http.Error(w, "failed to write out tga header: "+err.Error(), http.StatusInternalServerError)
			return
		}

		pixReader := bytes.NewReader(img.Pix)
		_, err = io.Copy(w, pixReader)
		if err != nil {
			http.Error(w, "failed to write out tga data: "+err.Error(), http.StatusInternalServerError)
			return
		}

		return // done copying the tga response
	}
	// otherwise encode as png

	// Sending the image as a PNG response
	w.Header().Set("Content-Type", "image/png")

	png.Encode(w, img)
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

// Map of expression strings to their respective flags
// NOTE: Mii Studio expression parameters, which
// this aims to be compatible with, use
// the opposite direction for all wink expressions.
var expressionMap = map[string]int{
	"surprise":              FFL_EXPRESSION_SURPRISE,
	"surprise_open_mouth":   FFL_EXPRESSION_SURPRISE_OPEN_MOUTH,
	"wink_left_open_mouth":  FFL_EXPRESSION_WINK_RIGHT_OPEN_MOUTH,
	"like":                  FFL_EXPRESSION_LIKE,
	"anger_open_mouth":      FFL_EXPRESSION_ANGER_OPEN_MOUTH,
	"blink_open_mouth":      FFL_EXPRESSION_BLINK_OPEN_MOUTH,
	"anger":                 FFL_EXPRESSION_ANGER,
	"like_wink_left":        FFL_EXPRESSION_LIKE_WINK_RIGHT,
	"happy":                 FFL_EXPRESSION_HAPPY,
	"blink":                 FFL_EXPRESSION_BLINK,
	"smile":                 FFL_EXPRESSION_SMILE,
	"sorrow_open_mouth":     FFL_EXPRESSION_SORROW_OPEN_MOUTH,
	"wink_right":            FFL_EXPRESSION_WINK_LEFT,
	"sorrow":                FFL_EXPRESSION_SORROW,
	"normal":                FFL_EXPRESSION_NORMAL,
	"like_wink_right":       FFL_EXPRESSION_LIKE,
	"wink_right_open_mouth": FFL_EXPRESSION_WINK_LEFT_OPEN_MOUTH,
	"smile_open_mouth":      FFL_EXPRESSION_HAPPY,
	"frustrated":            FFL_EXPRESSION_FRUSTRATED,
	"surprised":             FFL_EXPRESSION_SURPRISE,
	"wink_left":             FFL_EXPRESSION_WINK_RIGHT,
	"open_mouth":            FFL_EXPRESSION_OPEN_MOUTH,
	"puzzled":               FFL_EXPRESSION_SORROW, // assuming PUZZLED is similar to SORROW
	"normal_open_mouth":     FFL_EXPRESSION_OPEN_MOUTH,
	"🥺":                     65,
}

var clothesColorMap = map[string]int{
	// NOTE: solely based on mii studio consts, not FFL enums
	"default":     -1,
	"red":         0,
	"orange":      1,
	"yellow":      2,
	"yellowgreen": 3,
	"green":       4,
	"blue":        5,
	"skyblue":     6,
	"pink":        7,
	"purple":      8,
	"brown":       9,
	"white":       10,
	"black":       11,
}

var pantsColorMap = map[string]int{
	"gray": 0,
	"blue": 1,
	"red":  2,
	"gold": 3,
}

func getExpressionInt(input string) int {
	input = strings.ToLower(input)
	if expression, exists := expressionMap[input]; exists {
		return expression
	}
	// NOTE: mii studio rejects requests if the string doesn't match ..
	// .. perhaps we should do the same
	return FFL_EXPRESSION_NORMAL
}

func getPantsColorInt(input string) int {
	input = strings.ToLower(input)
	if colorIdx, exists := pantsColorMap[input]; exists {
		return colorIdx
	}
	// NOTE: mii studio rejects requests if the string doesn't match ..
	// .. perhaps we should do the same
	return 0
}

func getClothesColorInt(input string) int {
	input = strings.ToLower(input)
	if colorIdx, exists := clothesColorMap[input]; exists {
		return colorIdx
	}
	// NOTE: mii studio rejects requests if the string doesn't match ..
	// .. perhaps we should do the same
	return -1
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
