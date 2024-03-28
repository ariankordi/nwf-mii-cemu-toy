package main

/*
#include <stdlib.h>

#define IPC_IMPLEMENTATION
#include "ipc.h"
*/
import "C"
import (
	"bytes"
	"encoding/binary"
	"fmt"
	"image"
	"image/color"

	//"image/draw"
	"image/png"
	"log"

	"os"
	//"os/exec"
	"sync"
	"time"

	// to make a direct pointer to shm data
	"unsafe"

	"encoding/base64"
	"hash/crc32"
	"io/ioutil"
	"math/rand"
	"net"
	"net/http"
	"strconv"

	"github.com/google/go-cmp/cmp"
	"github.com/sigurn/crc16"
	//"slices" // for slices.Delete which did not even work
)

type renderResponse struct {
	parameters RenderParameters
	pixels     image.NRGBA
}

type renderRequest struct {
	parameters RenderParameters
	//channel    chan renderResponse
	timestamp  time.Time  // Timestamp when the request was added
}

var (
	markersMutex sync.RWMutex

	//markers = make(map[uint32]*RenderParameters)
	renderRequests []*renderRequest

	// used to notify screenshot signaling thread of new request
	// blank channel, only used to notify that there is something new
	newRequestChannel = make(chan struct{})

	processFinishChannel = make(chan struct{})

	responseChannel = make(chan renderResponse)
)

func removeExpiredRequestsThread() {
	ticker := time.NewTicker(2 * time.Second)
	for {
		// constantly wait to receive from channel
		<-ticker.C

		markersMutex.Lock()
		currentTime := time.Now()
		var indexesToRemove []int
		for i, request := range renderRequests {
			if currentTime.Sub(request.timestamp) > timeout {
				indexesToRemove = append(indexesToRemove, i)
			}
		}
		for i := len(indexesToRemove) - 1; i >= 0; i-- {
			index := indexesToRemove[i]
			renderRequests = append(renderRequests[:index], renderRequests[index+1:]...)
		}
		// now we are good to unlock
		markersMutex.Unlock()
	}
}

const (
	// fixed height and width used below
	width = 1920
	height = 1080
)

func processImage(buf []byte) {
	// NOTE: This may take a while, it may be worth it to just copy the marker instead of locking it
	// go through each coordinate plane

	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			// Calculate the index in the buffer for the current pixel
			// Each pixel is 4 bytes (RGBA), hence the *4
			// NOTE: change this if you are not using RGBA
			idx := (y*width + x) * 4

			// Extract marker directly from the buffer, if present
			marker, found := extractMarker(buf, idx, width)
			if !found {
				// skip if extractMarker says this is not a marker
				continue
			}

			markersMutex.RLock() // Lock the mutex before reading the markers slice
			// iterate through all markers to see if this one is a match
			for i, request := range renderRequests {
				// compare if we are even dealing with the same mii
				if marker.MiiDataHash != request.parameters.MiiDataHash {
					//log.Println("mii data hash doesn't match:", marker.MiiDataHash, request.parameters.MiiDataHash)
					continue
				}

				log.Println("found mii hash inside this marker: ", marker)
				// then compare ENTIRE STRUCT
				if !cmp.Equal(marker, request.parameters) {
					// skip if this is not an identical request
					log.Println("markers don't match:", marker, request.parameters)
					continue
				}
				log.Printf("Found marker at (%d, %d) with resolution %d\n", x, y, marker.Resolution)
				//fmt.Printf("Found new marker: %+v at (%d, %d)\n", *matchedMarker, x, y)
				// if scale is zero...
				if marker.Scale == 0 {
					log.Println("WARNING: SCALE IS ZERO???? NO!!!!!!")
					marker.Scale = 1
				}
				go extractAndSaveSquare(buf, x, y,
					marker.getWindowSize(), width, request)
				/*go func() {
					// resolution is one number bc this image is square
					rect := image.Rect(x, y, x+resolution, y+resolution)
					square := image.NewNRGBA(rect)

					log.Printf("sending %d resolution back to channel\n", resolution)
					// send back thru channel
					responseChannel <- renderResponse{
						parameters: marker,
						pixels:     *square,
					}
				}()*/
				/*go func(x, y int, resolution uint16) {
					extractAndSaveSquare(img, x, y, int(resolution), &marker)
				}(x, y, marker.Resolution / uint16(marker.Scale))*/
				// remove the one
				renderRequests = append(renderRequests[:i], renderRequests[i+1:]...)
				break // Found a known marker, no need to check the rest
			}
			markersMutex.RUnlock() // Unlock the mutex after iterating
		}
	}
	processFinishChannel <- struct{}{}
	log.Println("Processing complete.")
}

func extractMarker(buf []byte, idx, width int) (RenderParameters, bool) {
	// Bounds checking
	if idx < 0 || idx >= len(buf) { // or (idx+28): 14 color values * 2 bytes per color
		return RenderParameters{}, false
	}

	var params RenderParameters
	colors := make([]byte, 14)

	// Assuming you extract colors starting from idx, adjust as necessary
	for i := 0; i < len(colors)/2; i++ {
		// Each pixel is 4 bytes in the buffer
		// NOTE: also accomodate rgba here
		baseIdx := idx + i*4
		if baseIdx+1 >= len(buf) { // Ensure we don't read beyond the buffer
			return RenderParameters{}, false
		}
		colors[2*i], colors[2*i+1] = buf[baseIdx], buf[baseIdx+1] // Only need R and G
	}

	reader := bytes.NewReader(colors)
	if err := binary.Read(reader, binary.BigEndian, &params); err != nil {
		return RenderParameters{}, false
	}

	return params, true
}

const (
	// CHROMA KEY COLOR
	targetR = 0
	targetG = 255
	targetB = 0
)

// TODO: probably remove RenderParameters when you get this to send back
func extractAndSaveSquare(buf []byte, x, y, resolution, width int, request *renderRequest) {
	// Calculate starting index in buffer
	// NOTE: 4 bytes for rgba again
	startIdx := (y*width + x) * 4
	// Create a new image to hold the extracted square
	square := image.NewNRGBA(image.Rect(0, 0, resolution, resolution))

	// Pre-define target green (key) color and transparent color
	targetKey := color.NRGBA{R: targetR, G: targetG, B: targetB, A: 255}
	transparent := color.NRGBA{R: 0, G: 0, B: 0, A: 0}

	// Copy buffer to square image
	for sy := 0; sy < resolution; sy++ {
		for sx := 0; sx < resolution; sx++ {
			// Calculate index for source pixel
			idx := startIdx + (sy*width+sx)*4
			//idx := ((y+sy)*width + (x+sx)) * 4
			if idx >= len(buf)-4 { // Ensure we don't go out of bounds
				continue
			}

			// skip first row of pixels, for removing the marker
			if sy == 0 { //&& sx < 20 {
				continue
			}
			// Extract RGBA values
			r, g, b, a := buf[idx], buf[idx+1], buf[idx+2], buf[idx+3]
			// Set pixel in square
			//square.Set(sx, sy, color.RGBA{R: r, G: g, B: b, A: a})
			// Process chroma key to set pixel or transparency
			pixel := color.NRGBA{R: r, G: g, B: b, A: a}
			if pixel == targetKey {
				square.Set(sx, sy, transparent)
			} else {
				square.Set(sx, sy, pixel)
			}
		}
	}

	log.Printf("sending %d resolution back to channel\n", resolution)
	// send back thru channel
	//request.channel <- renderResponse{
	responseChannel <- renderResponse{
		parameters: request.parameters,
		pixels:     *square,
	}
	/*
		fileName := fmt.Sprintf("/dev/shm/%d-%d-%d-square.png", time.Now().UnixNano(), marker.MiiDataHash, resolution)
		file, err := os.Create(fileName)
		if err != nil {
			fmt.Printf("Failed to create file: %v\n", err)
			return
		}
		defer file.Close()

		if err := png.Encode(file, square); err != nil {
			fmt.Printf("Failed to encode image: %v\n", err)
			return
		}

		fmt.Printf("Extracted square saved to %s\n", fileName)

		// Optionally open the image with xdg-open
		cmd := exec.Command("xdg-open", fileName)
		if err := cmd.Start(); err != nil {
			fmt.Printf("Failed to open image: %v\n", err)
		}*/
}

var (
	// TODO: this should be customizable
	cemuPort = "12345"
	// usually runs locally, this is not supposed
	// to be remote, sockets are just IPC
	cemuSocketHost = "127.0.0.1:" + cemuPort
	// TODO: these probably need more specific names.
	// this is for screenshot shm and signal
	shmName = "CemuSharedMemory" + cemuPort
	semName = "CemuSemaphore" + cemuPort
	// TODO ALL OF THESE NEED BRAND NEW NAMES FOR SEM/SHM
	shmSize = 4 * 1920 * 1080 // RGBA format

	shm C.ipc_sharedmemory
	sem C.ipc_sharedsemaphore
	// for nfp is lkower
)

func processImageOnSemNotifyThread() {
	// Initialize shared memory and semaphore
	C.ipc_mem_init(&shm, C.CString(shmName), C.size_t(shmSize))
	if C.ipc_mem_open_existing(&shm) != 0 {
		log.Println("Opening existing memory failed, maybe we're first?")
		if C.ipc_mem_create(&shm) != 0 {
			panic("Creating memory failed.")
		}
		// Initialize memory if we're the first
		// Note: Direct memory initialization not shown; handle as needed
		log.Println("Initialized new shared memory.")
	} else {
		log.Println("Attached to existing shared memory.")
	}
	defer C.ipc_mem_close(&shm)

	C.ipc_sem_init(&sem, C.CString(semName))
	if C.ipc_sem_create(&sem, 1) != 0 { // Using '1' to ensure it's unlocked initially
		panic("Failed to create or open existing semaphore.")
	}
	defer C.ipc_mem_close(&shm)

	for {
		// Wait on semaphore
		C.ipc_sem_decrement(&sem)

		// Access the shared memory
		addr := unsafe.Pointer(C.ipc_mem_access(&shm))
		// TODO: not sure what this code does, specifically the bitshift
		// it would probably be wise to check if we do not have to use unsafe
		buf := (*[1 << 30]byte)(unsafe.Pointer(addr))[:shmSize:shmSize]
		// blocks the thread, however, that's fine
		// as we shouldn't be able to process more anyway until next cycle
		processImage(buf)
	}
}

// 3 frames duration (1 frame = 16.6 ms)
// wait to make sure this many frames has passed since last run
//const minMsWaitDuration = 15 * 16.6 * time.Millisecond

func watchRequestsAndSignalScreenshot() {
	for {
		if len(renderRequests) < 1 {
			// if there is nothing in the queue
			// then go ahead and wait for the next message
			log.Println("no more renderRequests, waiting for new one to arrive")
			<-newRequestChannel
		}

		// below here there is a new request...
		connection, err := net.Dial("tcp", cemuSocketHost)
		if err != nil {
			log.Println("error connecting to cemu host to submit screenshot request:", err)
		} else {
			// NOTE: handling errors on connect() but not write()
			// hacky ass screenshot request

			connection.Write([]byte("SCREENS "))
			log.Println("sent screenshot request...")
			// ngl we should be done so we can just close now
			defer connection.Close()
		}

		// TODO: this shouldn't be a static wait we should wait on our image processing
		// but we are doing it anyway
		<-processFinishChannel
		//time.Sleep(minMsWaitDuration)
	}
}

var (
	nfpShm C.ipc_sharedmemory
	nfpSem C.ipc_sharedsemaphore

	nfpShmName = "NfpShmName" + cemuPort
	nfpSemName = "NfpSemName" + cemuPort
	// TODO ALL OF THESE NEED BRAND NEW NAMES FOR SEM/SHM
	nfpShmSize = 540 // size of amiibo

	// channel we will submit nfp data to!!!!
	nfpChannel = make(chan []byte, nfpShmSize)
)

func nfpSubmitSemThread() {
	C.ipc_mem_init(&nfpShm, C.CString(nfpShmName), C.size_t(nfpShmSize))
	if C.ipc_mem_open_existing(&nfpShm) != 0 {
		log.Println("NFP: Opening existing memory failed, maybe we're first?")
		if C.ipc_mem_create(&nfpShm) != 0 {
			panic("NFP: Creating memory failed.")
		}
		// Initialize memory if we're the first
		// Note: Direct memory initialization not shown; handle as needed
		log.Println("NFP: Initialized new shared memory.")
	} else {
		log.Println("NFP: Attached to existing shared memory.")
	}
	defer C.ipc_mem_close(&nfpShm)

	C.ipc_sem_init(&nfpSem, C.CString(nfpSemName))
	if C.ipc_sem_create(&nfpSem, 1) != 0 { // Using '1' to ensure it's unlocked initially
		panic("NFP: Failed to create or open existing semaphore.")
	}
 
	defer C.ipc_sem_close(&nfpSem)
	for {
		// wait for anyone to command us
		data := <-nfpChannel
		log.Println("submitting amiibo to semaphore...")
		// Ensure the data size does not exceed the allocated shared memory size.
		if len(data) > int(nfpShmSize) {
			panic("Data size exceeds allocated shared memory size.")
		}

		// Write data to shared memory.
		addr := unsafe.Pointer(C.ipc_mem_access(&nfpShm))
		copy((*[1 << 30]byte)(addr)[:len(data)], data)

		// Signal the semaphore to notify the consumer.
		C.ipc_sem_increment(&nfpSem)
	}
}


func main() {
	http.HandleFunc("/render.png", miiPostHandler)
	log.Println("now listening")
	go nfpSubmitSemThread()
	go removeExpiredRequestsThread()
	go processImageOnSemNotifyThread()
	go watchRequestsAndSignalScreenshot()
	listenStr := ":8080"
	if len(os.Args) > 2 {
		// first argv as listen host port
		listenStr = os.Args[1]
	}
	log.Fatal(http.ListenAndServe(listenStr, nil))
}

// make http client that does not do keep alives
// the cemu server does not support any keepalives and will lock up if you try
// TODO: THIS SERVER SHOULD BE A SEMAPHORE + SHM!
// NOTE: you are moving AMIIBO REQUESTS and SCREENSHOT REQUESTS to those!
var client = &http.Client{
	Transport: &http.Transport{
		DisableKeepAlives: true,
	},
}

type RenderParameters struct {
	// This "hash" is a CRC32 for now, which I know isn't a hash.
	// It can be used as a marker pattern for the start of the data
	MiiDataHash uint32
	Resolution  uint16
	Mode        uint8
	// TODO: zero R, G, & B results in premature null so this needs reorganization
	Expression  uint8
	BackgroundR uint8
	BackgroundG uint8
	BackgroundB uint8
	Scale       uint8
	// For splitting an image into multiple chunks
	HorizontalTotal uint8
	HorizontalChunk uint8
	// All chunks are assumed to be split evenly.
}

// gets the resolution divided by the (down)scale as calculated by the js
func (params RenderParameters) getWindowSize() int {
	// divide by scale to calculate same size that js calculates
	return int(params.Resolution / uint16(params.Scale))
}

// requests are timing out after this amount of time
const timeout = 7 * time.Second

func miiPostHandler(w http.ResponseWriter, r *http.Request) {
	// NOTE: permissive config here is somewhat temporary
	header := w.Header()
	header.Set("Access-Control-Allow-Private-Network", "true")
	header.Set("Access-Control-Allow-Origin", "https://savemii.rixy.eu.org")
	header.Set("Access-Control-Allow-Methods", "POST")
	header.Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method == "OPTIONS" {
		// do not return any text on OPTIONS and preflight headers were already sent
		return
	}

	// if data was specified then this is allowed to be a GET
	b64MiiData := r.URL.Query().Get("data")

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
		// NOTE: 2 KB LIMIT ON REQUEST BODY!!!!!!
		reader := http.MaxBytesReader(w, r.Body, 2 << 10) // 2 KB
		miiData, err = ioutil.ReadAll(reader)
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
		http.Error(w, "your mii data/FFLStoreData has to be exactly 96 bytes long, yours is " +
			strconv.Itoa(miiDataLen), http.StatusBadRequest)
		return
	}
	// do crc16
	crcData := miiData[:len(miiData)-2] // Data without the last 2 bytes
	crcExpected := miiData[len(miiData)-2:] // Last 2 bytes

	// mii hash uses crc xmodem
	table := crc16.MakeTable(crc16.CRC16_XMODEM)
	crcCalculated := crc16.Checksum(crcData, table)

	// take expected crc from mii data
	crcExpectedValue := uint16(crcExpected[0]) << 8 + // lower 16 bits
				uint16(crcExpected[1]) // higher 16 bits
	if crcCalculated != crcExpectedValue {
		http.Error(w,
			fmt.Sprintf("CRC check failed: calculated CRC (%X) does not match expected CRC (%X).\n", crcCalculated, crcExpectedValue),
			http.StatusBadRequest)
		return
	}

	// Extract additional parameters from query or form
	expression, _ := strconv.Atoi(r.URL.Query().Get("expression"))
	// 0 expression MUST become 24 or UTF-16BE null string will terminate early.
	if expression == 0 {
		expression = 24 // Default if not provided or error
	}

	// Assuming other parameters are passed as query parameters for simplicity
	// TODO: VERIFY THESE!!!! ranges for ALL except RGB
	resolution, _ := strconv.Atoi(r.URL.Query().Get("resolution"))
	mode, _ := strconv.Atoi(r.URL.Query().Get("mode"))
	backgroundR, _ := strconv.Atoi(r.URL.Query().Get("backgroundR"))
	backgroundG, _ := strconv.Atoi(r.URL.Query().Get("backgroundG"))
	backgroundB, _ := strconv.Atoi(r.URL.Query().Get("backgroundB"))
	scale, _ := strconv.Atoi(r.URL.Query().Get("scale"))
	horizontalTotal, _ := strconv.Atoi(r.URL.Query().Get("horizontaltotal"))
	horizontalChunk, _ := strconv.Atoi(r.URL.Query().Get("horizontalchunk"))
	// NOTE: you may have been able to get away with parsing uint but that is 64

	// Compute CRC for Mii data
	miiCRC := crc32.ChecksumIEEE(miiData)
	//_ = crc32.ChecksumIEEE(miiData)

	// Setup RenderParameters with received or default values
	params := RenderParameters{
		//MiiDataHash:     0xCAFEBEEF,//miiCRC,
		MiiDataHash:     miiCRC,
		Resolution:      uint16(resolution),
		Mode:            uint8(mode),
		Expression:      uint8(expression),
		BackgroundR:     uint8(backgroundR),
		BackgroundG:     uint8(backgroundG),
		BackgroundB:     uint8(backgroundB),
		Scale:           uint8(scale),
		HorizontalTotal: uint8(horizontalTotal),
		HorizontalChunk: uint8(horizontalChunk),
	}

	// TODO REOPTIMIZE WHERE THIS IS BECAUSE WE DO BINARY ENCODING AGAIN!!!!!....
	// TODO:  ALSO JUMPING BACK HERE, BEFORE THE NEW IMAGE IS READY, MAY SAY "OH IT IS STILL BLANK LEMME RESUBMIT"
	//resendRequest:
	// check if this request is already in renderRequests
	markersMutex.Lock() // Lock the mutex before modifying or reading the markers slice
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
	*/	request = renderRequest{
			parameters: params,
			//channel: make(chan renderResponse),
			timestamp: time.Now(),
		}
		log.Println("sending this struct: ", params)
		renderRequests = append(renderRequests, &request)
		markersMutex.Unlock()

	//}

	// here you can wait for permission to send request

	resendRequest:
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
	// submit New!
	nfpChannel <- buf

	// notify the screenshot channel to detect and start watching for requests
	newRequestChannel <- struct{}{}

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
		if centerPixel.A == 0 {
			// TODO:!!! CHECK IF IT IS BACKGROUND COLOR. IF THAT IS SPECIFIED. OK?
			log.Println("Warning: The pixel in the very center of the image is blank (transparent)!!!, jumping back and resending.")
			goto resendRequest
		}
		header.Set("Content-Type", "image/png")
		if err := png.Encode(w, &renderedResponse.pixels); err != nil {
			//http.Error(w, "Failed to encode image: "+err.Error(), http.StatusInternalServerError)
			log.Println("png.Encode error:", err)
		}
	case <-time.After(timeout):
		log.Printf("timeout after %i seconds\n", timeout)
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
