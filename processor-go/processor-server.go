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

	//"os"
	//"os/exec"
	"sync"
	"time"

	// to make a direct pointer to shm data
	"unsafe"

	"encoding/base64"
	"hash/crc32"
	"io/ioutil"
	"net/http"
	"net"
	"strconv"
	"math/rand"

	"github.com/google/go-cmp/cmp"
	//"slices" // for slices.Delete which did not even work
)

type renderResponse struct {
	parameters RenderParameters
	pixels     image.NRGBA
}

type renderRequest struct {
	parameters RenderParameters
	//channel    chan renderResponse
}

var (
	markersMutex sync.Mutex

	//markers = make(map[uint32]*RenderParameters)
	renderRequests []*renderRequest

	// used to notify screenshot signaling thread of new request
	// blank channel, only used to notify that there is something new
	newRequestChannel = make(chan struct{})

	responseChannel = make(chan renderResponse)
)

func processImage(buf []byte) {
	img := image.NewNRGBA(image.Rect(0, 0, 1920, 1080))
	copy(img.Pix, buf)

	//var wg sync.WaitGroup

	// NOTE: This may take a while, it may be worth it to just copy the marker instead of locking it
	// go through each coordinate plane
	for x := 0; x < img.Bounds().Dx(); x++ {
		for y := 0; y < img.Bounds().Dy(); y++ {
			// try to read out a marker from each section of the image
			if marker, found := extractMarker(img, x, y); found {
				markersMutex.Lock() // Lock the mutex before reading the markers slice
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
					fmt.Printf("Found marker at (%d, %d) with resolution %d\n", x, y, marker.Resolution)
					//fmt.Printf("Found new marker: %+v at (%d, %d)\n", *matchedMarker, x, y)
					// if scale is zero...
					if marker.Scale == 0 {
						log.Println("WARNING: SCALE IS ZERO???? NO!!!!!!")
						marker.Scale = 1
					}
					go extractAndSaveSquare(img, x, y, int(marker.Resolution / uint16(marker.Scale)), request)
					/*go func(x, y int, resolution uint16) {
						extractAndSaveSquare(img, x, y, int(resolution), &marker)
					}(x, y, marker.Resolution / uint16(marker.Scale))*/
					// remove the one
					renderRequests = append(renderRequests[:i], renderRequests[i+1:]...)
					break // Found a known marker, no need to check the rest
				}
				markersMutex.Unlock() // Unlock the mutex after iterating
			}
		}
	}
	/*
	for x := 0; x < img.Bounds().Dx(); x++ {
		for y := 0; y < img.Bounds().Dy(); y++ {
			if params, found := extractMarker(img, x, y); found {
				markersMutex.Lock()
				// now try to see if that marker actually exists
				if _, exists := markers[params.MiiDataHash]; !exists {
					// go ahead and verify that this is the one that we want
					// look up... oh wait.
					markers[params.MiiDataHash] = *params
					markersMutex.Unlock()
					fmt.Printf("Found new marker: %+v at (%d, %d)\n", *params, x, y)
					//extractAndSaveSquare(img, x, y, int(params.Resolution))
					//wg.Add(1)
					go func(x, y int, resolution uint16) {
						//defer wg.Done()
						extractAndSaveSquare(img, x, y, int(resolution), &marker)
					}(x, y, marker.Resolution / uint16(marker.Scale))
					//markers = append(markers[:i], markers[i+1:]...)

					// remove when finished
					delete(markers, params.MiiDataHash)
				} else {
					markersMutex.Unlock()
				}
			}
		}
	}*/

	//wg.Wait()
	log.Println("Processing complete.")
}

func extractMarker(img *image.NRGBA, x, y int) (RenderParameters, bool) {
	if x+1 >= img.Bounds().Dx() || y+1 >= img.Bounds().Dy() {
		return RenderParameters{}, false
	}

	var params RenderParameters
	colors := make([]byte, 14) // 6 bytes: R&G for three pixels to read MiiDataHash (uint32) and Resolution (uint16)

	// read about as many pixels as colors we set above
	pixelsToRead := len(colors) / 2

	for i := 0; i < pixelsToRead; i++ {
		r, g, _, _ := img.At(x+i, y).RGBA()
		colors[2*i], colors[2*i+1] = byte(r>>8), byte(g>>8)
	}
	// TODO: UMMMM UHHHHHH FUGGGGGG
	colors[13] = 0

	reader := bytes.NewReader(colors)
	if err := binary.Read(reader, binary.BigEndian, &params); err != nil {
		return RenderParameters{}, false
	}

	return params, true
}

const (
	// FOR CHROMA KEYING
	targetR = 0
	targetG = 255
	targetB = 0
)

// TODO: probably remove RenderParameters when you get this to send back
func extractAndSaveSquare(img *image.NRGBA, x, y, resolution int, request *renderRequest) {
	rect := image.Rect(x, y, x+resolution, y+resolution)
	square := image.NewNRGBA(rect)
	green := color.NRGBA{R: targetR, G: targetG, B: targetB, A: 255} // Define the green color to be removed
	transparent := color.NRGBA{R: 0, G: 0, B: 0, A: 0} // Define transparent color

	// Extract the square and process the background and first row
	for ix := rect.Min.X; ix < rect.Max.X; ix++ {
		for iy := rect.Min.Y; iy < rect.Max.Y; iy++ {
			c := img.At(ix, iy)
			// Remove green background
			if c == green {
				square.Set(ix-x, iy-y, transparent)
			} else {
				square.Set(ix-x, iy-y, c)
			}
				// Make the first row transparent
				if iy == rect.Min.Y {
				square.Set(ix-x, iy-y, transparent)
			}
		}
	}

	log.Printf("sending %d resolution back to channel\n", resolution)
	// send back thru channel
	//request.channel <- renderResponse{
	responseChannel <- renderResponse{
		parameters: request.parameters,
		pixels: *square,
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
	shmSize = 4 * 1920 * 1080 // RGBA format


	shm C.ipc_sharedmemory
	sem C.ipc_sharedsemaphore
)

func processImageOnSemNotifyThread() {
	// Initialize shared memory and semaphore
	C.ipc_mem_init(&shm, C.CString(shmName), C.size_t(shmSize))
	C.ipc_sem_init(&sem, C.CString(semName))

	// Try to open or create shared memory and semaphore
	if C.ipc_mem_open_existing(&shm) != 0 {
		panic("Failed to open or create shared memory")
	}
	defer C.ipc_mem_close(&shm)

	if C.ipc_sem_create(&sem, 0) != 0 {
		panic("Failed to create semaphore")
	}
	defer C.ipc_sem_close(&sem)

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
const minMsWaitDuration = 15 * 16.6 * time.Millisecond

func watchRequestsAndSignalScreenshot() {
	// TODO: implementing a rate limit
	// ... because it uh sented too many requests
	const rateLimitForNow = 5
	var rateCounter int
	for {
		if len(renderRequests) < 1 {
			// if there is nothing in the queue
			// then go ahead and wait for the next message
			log.Println("no more renderRequests, waiting for new one to arrive")
			rateCounter = 0
			<-newRequestChannel
		}

		if rateCounter > rateLimitForNow {
			// skip sending requests if we have sent enough
			// for now, keep waiting indefinitely
			// NOTE this will STOP SENDING ANY AND LL REQUESTS AFTER REQUEST CHANNEL IF THERE ARE ANY PENDING REQUESTS HHHHHHHHHHHHH DONOT DO THIS
			continue
		}
		// below here there is a new request...
		connection, err := net.Dial("tcp", cemuSocketHost)
		if err != nil {
			log.Println("error connecting to cemu host to submit screenshot request:", err)
		}
		// NOTE: handling errors on connect() but not write()
		// hacky ass screenshot request
		connection.Write([]byte("SCREENS "))
		rateCounter++
		log.Println("sent screenshot request...")
		// ngl we should be done so we can just close now
		defer connection.Close()

		// TODO: this shouldn't be a static wait we should wait on our image processing
		// but we are doing it anyway
		time.Sleep(minMsWaitDuration)
	}
}

func main() {
	http.HandleFunc("/", miiPostHandler)
	log.Println("now listening")
	go processImageOnSemNotifyThread()
	go watchRequestsAndSignalScreenshot()
	log.Fatal(http.ListenAndServe(":8080", nil))
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
	MiiDataHash     uint32
	Resolution      uint16
	Mode            uint8
	// TODO: zero R, G, & B results in premature null so this needs reorganization
	Expression      uint8
	BackgroundR     uint8
	BackgroundG     uint8
	BackgroundB     uint8
	Scale           uint8
	// For splitting an image into multiple chunks
	HorizontalTotal uint8
	HorizontalChunk uint8
	// All chunks are assumed to be split evenly.
}

func miiPostHandler(w http.ResponseWriter, r *http.Request) {
	// NOTE: permissive config here is somewhat temporary
	header := w.Header()
	header.Set("Access-Control-Allow-Private-Network", "true")
	header.Set("Access-Control-Allow-Origin", "https://savemii.rixy.eu.org")
	header.Set("Access-Control-Allow-Methods", "POST")
	header.Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method != "POST" {
		// do not return any text on OPTIONS and preflight headers were already sent
		if r.Method != "OPTIONS" {
			// TODO: replace this with something funny
			http.Error(w, "you have to POST (TODO: replace this with something funny like skibidi toilet idk)", http.StatusMethodNotAllowed)
		}
		return
	}

	// Read Mii data from the request. You could decide the format (base64 or binary) using a header or part of the request
	var miiData []byte

	var err error
	miiData, err = ioutil.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "io.ReadAll error on request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	contentType := r.Header.Get("Content-Type")
	if contentType == "application/base64" {
		// If the data is base64-encoded
		miiData, err = base64.StdEncoding.DecodeString(string(miiData))
		if err != nil {
			http.Error(w, "base64 decode error: "+err.Error(), http.StatusBadRequest)
			return
		}
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

	// add to markers TODO TODO ADD ENTIRE STRUCT TO THIS
	request := renderRequest{
		parameters: params,
		//channel: make(chan renderResponse),
	}
	log.Println("sending this struct: ", params)
	markersMutex.Lock() // Lock the mutex before modifying the markers slice
	renderRequests = append(renderRequests, &request)
	markersMutex.Unlock()

	// Serialize the params to bytes as before
	encodedParams := &bytes.Buffer{}
	// not only are the multi-byte numbers big endian...
	// ... but the arrangement in general is for UTF-16BE
	err = binary.Write(encodedParams, binary.BigEndian, params)
	if err != nil {
		http.Error(w, "binary.Write struct failed!!!: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// buffer to accomodate zeroes for amiibo, as well as mii data at the end
	buf := make([]byte, 172)
	// Fill amiiboData as needed, example:
	buf[0x2C] = 0x10
	copy(buf[0x4C:], miiData)
	copy(buf[0x38:], encodedParams.Bytes())

	// Assume you do something with the parameters, like saving or processing
	// For now, let's just return a success message
	//w.Write([]byte("ure data is on its way sir"))

	// Prepare and send the POST request
	/*resp, err := http.Post("http://127.0.0.1:12345", "application/octet-stream", bytes.NewReader(buf))
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	// Read the response (for demonstration purposes)
	responseBody, _ := ioutil.ReadAll(resp.Body)
	println(string(responseBody))
	*/

	// Asynchronous request example (commented-out)
	go func() {
		resp, err := client.Post("http://" + cemuSocketHost, "application/octet-stream", bytes.NewReader(buf))
		if err != nil {
			log.Println("Error sending async request:", err)
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode >= 400 {
			log.Println("Bad response status code:", resp.StatusCode)
		}
	}()

	// go ahead and notify the screenshot signaling thread
	// that renderRequests changed and it can act on it
	newRequestChannel <- struct{}{}

	const timeout = 7
	// now wait for channel receive
	select {
		//case renderedResponse := <-request.channel:
		case renderedResponse := <-responseChannel:
			if !cmp.Equal(renderedResponse.parameters, params) {
				log.Println("NO MATCH UHHH UHHHH POOOOOOOP")
				return
			}
			// ENCODE RESPONSE YAAAAAY!!!!
			log.Println("RECEIVED FROM CHANNEL!!!!!!!! with this struct: ", renderedResponse.parameters)
			//fmt.Println(renderedResponse)
			header.Set("Content-Type", "image/png")
			if err := png.Encode(w, &renderedResponse.pixels); err != nil {
				http.Error(w, "Failed to encode image: "+err.Error(), http.StatusInternalServerError)
			}
		case <-time.After(timeout * time.Second):
			log.Printf("timeout after %i seconds\n", timeout)
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
