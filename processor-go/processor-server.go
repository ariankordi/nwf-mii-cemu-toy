package main

/*
#include <stdlib.h>

#define IPC_IMPLEMENTATION
#include "ipc.h"
*/
import "C"
import (
	// TODO: you can probably run something to organize all of these at some point
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"image"
	"image/color"
	"regexp"
	"strings"

	"image/png"
	"log"

	"golang.org/x/image/draw"

	// to cleanup on exit
	"os"
	"os/signal"

	//"os/exec"
	"sync"
	"time"

	// to make a direct pointer to shm data
	"unsafe"

	"runtime"
	"syscall"

	"encoding/base64"
	"encoding/json"
	"flag"
	"hash/crc32"
	"io"
	"math/rand"
	"net"
	"net/http"
	"strconv"

	"github.com/google/go-cmp/cmp"
	"github.com/sigurn/crc16"

	// for suspending and resuming the process
	"github.com/shirou/gopsutil/v3/process"
	//"slices" // for slices.Delete which did not even work

	// PURELY just for nnid cache
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type renderResponse struct {
	parameters RenderParameters
	pixels     image.NRGBA
}

type renderRequest struct {
	parameters RenderParameters
	//channel    chan renderResponse
	timestamp time.Time // Timestamp when the request was added
	// TODO: should these be receive-only?
	// this will be sent back to the queue
	ready chan struct{}
	// the queue will use this to tell the request to go ahead
	done chan struct{}
	// if this is received from then cemu is not running
	connErrChan chan struct{}
}

var (
	markersMutex sync.RWMutex

	//markers = make(map[uint32]*RenderParameters)
	renderRequests []*renderRequest

	renderRequestQueue = make(chan *renderRequest, 1) // Queue size set to 1 for simplicity
	// TODO: this is actually a buffer, try removing this buffer at some point
	// bc it is probably not needed and adds more unintended behavior

	// used to notify screenshot signaling thread of new request
	// blank channel, only used to notify that there is something new
	newRequestChannel = make(chan struct{})

	processFinishChannel = make(chan struct{})

	responseChannel = make(chan renderResponse)
)

func processQueue() {
	// doesn't this only go through one at a time
	for request := range renderRequestQueue {
		log.Println("next in queue:", request)
		select {
		case request.ready <- struct{}{}:
		default:
		}
		// wait until to receive once
		select {
		case <-request.done:
			// schedule same timeout in case request routine hangs?
		case <-time.After(timeout):
			log.Println("queue timed out on request, moving along...")
		}
		log.Println("request finished, moving along in queue")
	}
}

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
	width  = 1920
	height = 1080
)

func processImage(buf []byte) {
	// always signal processing finished at end
	defer func() {
		// probably doesn't need to be non-blocking
		processFinishChannel <- struct{}{}
	}()

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
	//processFinishChannel <- struct{}{}
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

// CHROMA KEY COLOR
var targetKey = color.NRGBA{R: 0, G: 255, B: 0, A: 255}

// TODO: probably remove RenderParameters when you get this to send back
func extractAndSaveSquare(buf []byte, x, y, resolution, width int, request *renderRequest) {
	// Calculate starting index in buffer
	// NOTE: 4 bytes for rgba again
	startIdx := (y*width + x) * 4
	// Create a new image to hold the extracted square
	square := image.NewNRGBA(image.Rect(0, 0, resolution, resolution))

	// Pre-define target green (key) color and transparent color
	transparent := color.NRGBA{R: 0, G: 0, B: 0, A: 0}

	// Copy buffer to square image
	for sy := 0; sy < resolution; sy++ {
		for sx := 0; sx < resolution; sx++ {
			// When sy is 0, we use sy=1 for the source to duplicate the second row into the first row of the target
			sourceY := sy
			if sy == 0 {
				sourceY = 1
			}

			// Calculate index for source pixel
			idx := startIdx + (sourceY*width+sx)*4
			if idx >= len(buf)-4 { // Ensure we don't go out of bounds
				continue
			}

			// skip first row of pixels, for removing the marker
			// leaves first row as transparent which is undesirable for color
			/*if sy == 0 { //&& sx < 20 {
				continue
			}*/

			// Extract RGBA values
			r, g, b, a := buf[idx], buf[idx+1], buf[idx+2], buf[idx+3]
			// Set pixel in square
			//square.Set(sx, sy, color.RGBA{R: r, G: g, B: b, A: a})

			// Process chroma key to set pixel or transparency
			pixel := color.NRGBA{R: r, G: g, B: b, A: a}
			if pixel == targetKey {
				// this pixel is now transparent if it is key
				pixel = transparent
			}
			square.Set(sx, sy, pixel)
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
	// for nfp is lower
)

const (
	inactivityDuration = 20 * time.Second
	// how often to check for inactivity
	inactivityInterval  = 10 * time.Second
	maintenanceInterval = 5 * time.Minute
	maintenanceDuration = 5 * time.Second
	processName         = "Cemu_"
)

var (
	lastActivityTime = time.Now()
	activityNotifier = make(chan struct{})
	// when this is true it will no longer:
	// attempt to keep suspending and spam the console
	// and will let you manually unsuspend by hand instead of fighting with you
	processSuspended = true
	// defaults to true so that it will unsuspend on startup (good)
)

// findProcessesByName searches for processes with a command line containing the target string.
func findProcessesByName(target string) ([]*process.Process, error) {
	var procs []*process.Process
	allProcs, err := process.Processes()
	if err != nil {
		return nil, err
	}

	for _, p := range allProcs {
		cmdline, err := p.Cmdline()
		if err == nil && strings.Contains(cmdline, target) {
			procs = append(procs, p)
		}
	}
	return procs, nil
}

// manageProcessState changes the state of processes with the target name.
func manageProcessState(target string, suspend bool) {
	// If the desired state matches the current state, no action is needed.
	if processSuspended == suspend {
		return
	}
	procs, err := findProcessesByName(target)
	if err != nil {
		log.Println("Error finding processes:", err)
		return
	}

	if len(procs) == 0 {
		log.Println("No", target, "processes found.")
		return
	}

	for _, p := range procs {
		var err error
		if suspend {
			err = p.Suspend()
			if err == nil {
				log.Println("Suspended process:", p.Pid)
			}
		} else {
			err = p.Resume()
			if err == nil {
				log.Println("Resumed process:", p.Pid)
			}
		}

		if err != nil {
			log.Println("Error changing process state:", err)
		} else {
			// Update the tracked state to reflect the successful action.
			processSuspended = suspend
		}
	}
}

// monitorActivityAndManageProcess monitors process activity and adjusts process states as needed,
// introducing maintenance windows and ensuring responsiveness to activity.
func monitorActivityAndManageProcess() {
	// Ensure that any initially suspended processes are resumed when starting.
	manageProcessState(processName, false)

	ticker := time.NewTicker(inactivityInterval)
	defer ticker.Stop()

	maintenanceTimer := time.NewTimer(maintenanceInterval)
	// for whatever reason this just hangs forever and I'm not sure why this was added
	if !maintenanceTimer.Stop() {
		select {
		case <-maintenanceTimer.C: // Drain the timer if it was stopped successfully.
		default:
		}
	}

	for {
		select {
		case <-activityNotifier:
			// Activity detected: reset the last activity time and ensure the target process is active.
			lastActivityTime = time.Now()
			manageProcessState(processName, false)
			log.Println("Activity detected; process resumed if it was suspended.")

			// Reset the maintenance timer whenever there's new activity.
			if !maintenanceTimer.Stop() {
				select {
				case <-maintenanceTimer.C:
				default:
				}
			}
			maintenanceTimer.Reset(maintenanceInterval)

		case <-ticker.C:
			// Regular check: Suspend the process if it has been inactive for the specified duration.
			if time.Since(lastActivityTime) > inactivityDuration {
				manageProcessState(processName, true)
				//log.Println("Process suspended due to inactivity.")
			}

		case <-maintenanceTimer.C:
			// Maintenance window: temporarily resume the process for maintenance activities.
			manageProcessState(processName, false)
			log.Println("Maintenance window: Process resumed for maintenance.")

			// Wait for the maintenance duration or an activity signal.
			select {
			case <-time.After(maintenanceDuration):
				// If no activity, re-suspend the process after maintenance.
				if time.Since(lastActivityTime) >= maintenanceDuration {
					manageProcessState(processName, true)
					log.Println("Maintenance completed; process re-suspended.")
				}
			case <-activityNotifier:
				// If there's activity during maintenance, reset the last activity time
				// and keep the process running to handle the activity.
				lastActivityTime = time.Now()
				log.Println("Activity detected during maintenance; keeping process running.")
			}

			// Prepare for the next maintenance window.
			maintenanceTimer.Reset(maintenanceInterval)
		}
	}
}

// notifyActivity is called to signal activity. It's non-blocking.
func notifyActivity() {
	select {
	case activityNotifier <- struct{}{}:
	default:
		// If the channel is already full, there's no need to block or add another notification.
	}
}

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

	// put a warning if the thread exits which, it should not
	for {
		// Wait on semaphore
		// TODO: will ipc_sem_try_decrement work better??? maybe you reopen the sem when that fails? try it?
		C.ipc_sem_decrement(&sem)
		log.Println("screenshot recv thread: screenshot data is ready, processing is beginning")

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

// delay this function will wait when there is a connection error, before retrying
const retryDelay = 2 * time.Second

func watchRequestsAndSignalScreenshot() {
	for {
		if len(renderRequests) < 1 {
			// if there is nothing in the queue
			// then go ahead and wait for the next message
			log.Println("no more renderRequests, waiting for new one to arrive")
			<-newRequestChannel
		}

		// below here there is a new request...
		// TODO: i wanted to move this to a semaphore but, should it be?
		connection, err := net.Dial("tcp", cemuSocketHost)
		if err != nil {
			log.Println("error connecting to cemu host to submit screenshot request:", err)
			// signal that cemu is down...
			if errors.Is(err, syscall.ECONNREFUSED) ||
				// WSAECONNREFUSED on windows
				errors.Is(err, syscall.Errno(10061)) {
				//log.Println("COULD NOT CONNECT TO CEMU!!!")
				log.Println("OH NO!, screenshot request yielded connection refused, cemu is probably not running. propagating to requests")
				markersMutex.RLock()
				for _, req := range renderRequests {
					select {
					case req.connErrChan <- struct{}{}:
						// Error sent successfully
					default:
						// This prevents blocking if the error channel is not being listened to,
						// but consider if this is the behavior you want, or if logging is needed
					}
				}
				markersMutex.RUnlock()
			}
			// wait before going back into the loop
			time.Sleep(retryDelay)
			log.Println("finished sleeping after failure, retrying screenshot signaling thread")
			continue
		}
		// close the connection but only if there is no error
		defer connection.Close()

		// hacky ass screenshot request http request, thing???
		if _, err = connection.Write([]byte("SCREENS ")); err != nil {
			log.Println("screenshot request write error?:", err)
			// you can probably continue without delay here
			// try again without waiting for image to signal, potentially triggering another shot
			continue
		}
		log.Println("sent screenshot request...")

		select {
		// use a select to enable a timeout for this so it does not hang FOREVERER
		case <-processFinishChannel:
			// just continue...
		case <-time.After(timeout):
			// 7 seconds between screenshot and processing is probably ample time
			log.Println("screenshot signaling thread timed out on image processing...")
		}
		// this will basically just not loop over until it sees that processImage was called
		// that will only happen when the program responds to the semaphore and takes a screenshot
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
		// TODO: THIS WILL HANG IF PROCESS ON THE OTHER SIDE DOES NOT DECREMENT. ADD TIMEOUT???
	}
}

func main() {
	var port, certFile, keyFile string
	flag.StringVar(&port, "port", ":8080", "http port to listen to, OR https if you specify cert and key")
	flag.StringVar(&certFile, "cert", "", "TLS certificate file")
	flag.StringVar(&keyFile, "key", "", "TLS key file")
	// make default false on windows because it does not work currently
	defaultEnableSuspending := true
	if runtime.GOOS == "windows" {
		defaultEnableSuspending = false
	}
	var enableSuspending bool
	flag.BoolVar(&enableSuspending, "enable-suspending", defaultEnableSuspending, "Enable suspending the Cemu process, currently broken on Windows but be my guest")
	flag.Parse()

	// TODO make this better, flags perhaps for different backends
	initNNASCacheDB()
	http.HandleFunc("/mii_data/", miiHandler)

	http.HandleFunc("/render.png", miiPostHandler)
	go nfpSubmitSemThread()
	go removeExpiredRequestsThread()
	go processImageOnSemNotifyThread()
	go watchRequestsAndSignalScreenshot()
	go processQueue()
	if enableSuspending {
		log.Println("suspending enabled, we will periodically suspend and resume cemu")
		log.Println("(notice that it may look crashed because of this, when it hasn't!!!)")
		// NOTE: suspending has been a bit flakey on windows...?
		// sometimes i've seen it suspend the process in a way where it can't be resumed
		// seemingly last time i tested this, this wasn't happening
		// things that may change this are running via MSYS2 or not, and running elevated or not
		if runtime.GOOS == "windows" {
			// set handler to unsuspend when finished on windows
			c := make(chan os.Signal, 2)
			signal.Notify(c, os.Interrupt, syscall.SIGTERM)
			go func() {
				caught := <-c
				log.Println("caught", caught)
				manageProcessState(processName, false)
				fmt.Println("bye bye~!!!!!")
				os.Exit(0)
			}()
		}
		go monitorActivityAndManageProcess()
	}
	// add frontend
	http.Handle("/assets/", http.StripPrefix("/assets/", http.FileServer(http.Dir("assets"))))
	// index = /index.html
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/favicon.ico" {
			http.ServeFile(w, r, "assets/favicon.ico")
			return
		}
		if r.URL.Path != "/" {
			// Use the 404 handler if the path is not exactly "/"
			//http.NotFound(w, r)
			w.Header().Set("Content-Type", "text/html")
			w.WriteHeader(http.StatusNotFound)
			// todo please find a more elegant way to do this
			http.ServeFile(w, r, "404.html")
			return
		}
		http.ServeFile(w, r, "index.html")
	})
	log.Println("now listening")
	var err error
	if certFile != "" && keyFile != "" {
		err = http.ListenAndServeTLS(port, certFile, keyFile, nil)
	} else {
		// no handler because we defined HandleFunc
		err = http.ListenAndServe(port, nil)
	}
	// this will only be reached when either function returns
	log.Fatal(err)
}

// make http client that does not do keep alives
// the cemu server does not support any keepalives and will lock up if you try
// TODO: THIS SERVER SHOULD BE A SEMAPHORE!
// NOTE: you are moving SCREENSHOT REQUESTS to those!
var client = &http.Client{
	Transport: &http.Transport{
		DisableKeepAlives: true,
	},
}

// hardcoded maximum resolution for single image
const maxResolution = 1080

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

// TODO TODO TODO OH MY GOD BREAK THIS OUT INTO ITS OWN FILE

const nnasAPIBase = "https://accountws.nintendo.net/v1/api"

type NNIDToPID struct {
	// nnid is normalized in the database
	NNID string `gorm:"primaryKey;column:nnid"`
	PID  int64  `gorm:"not null;column:pid"`
}
type CachedResult struct {
	ID             uint      `gorm:"primaryKey"`
	PID            int64     `gorm:"index;not null;column:pid"`
	Result         string    `gorm:"not null"`
	DateFetched    time.Time `gorm:"not_null"`
	DateLastLatest time.Time `gorm:"not_null"`
}

func normalizeNNID(nnid string) string {
	// Normalize NNID by removing '-', '_', '.', and converting to lowercase
	// the NNAS server will match NNIDs regardless of any of these
	// the original name is in the mii result
	nnid = strings.ToLower(nnid)
	nnid = strings.ReplaceAll(nnid, "-", "")
	nnid = strings.ReplaceAll(nnid, "_", "")
	nnid = strings.ReplaceAll(nnid, ".", "")
	return nnid
}

// nnids can have dashes, underscores, and dots
// the lower char limit is technically 6
// but if you add those chars you can get to 4 (or lower but)
var validNNIDRegex = regexp.MustCompile(`^[0-9a-zA-Z\-_.]{4,16}$`)

var db *gorm.DB

func initNNASCacheDB() {
	var err error
	db, err = gorm.Open(sqlite.Open("nnas_cache_b4.db"), &gorm.Config{})
	if err != nil {
		log.Fatalln("Failed to connect database:", err)
	}
	db.AutoMigrate(&NNIDToPID{}, &CachedResult{})
}

func nnasHTTPRequest(endpoint string) ([]byte, error) {
	client := &http.Client{}
	req, err := http.NewRequest("GET", nnasAPIBase+endpoint, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("X-Nintendo-Client-ID", "a2efa818a34fa16b8afbc8a74eba3eda")
	req.Header.Set("X-Nintendo-Client-Secret", "c91cdb5658bd4954ade78533a339cf9a")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	return io.ReadAll(resp.Body)
}

func fetchNNIDToPID(nnid string) (int64, error) {
	var mapping NNIDToPID

	normalizedNNID := normalizeNNID(nnid)
	if db.Where("nnid = ?", normalizedNNID).First(&mapping).Error == nil {
		return mapping.PID, nil
	}

	body, err := nnasHTTPRequest("/admin/mapped_ids?input_type=user_id&output_type=pid&input=" + nnid)
	if err != nil {
		return 0, err
	}

	var response struct {
		MappedIDs []struct {
			OutID string `json:"out_id"`
		} `json:"mapped_ids"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return 0, err
	}

	if len(response.MappedIDs) == 0 || response.MappedIDs[0].OutID == "" {
		return 0, fmt.Errorf("NNID does not exist")
	}

	pid, _ := strconv.ParseInt(response.MappedIDs[0].OutID, 10, 64)
	// place normalized NNID in the database
	db.Create(&NNIDToPID{NNID: normalizedNNID, PID: pid})

	return pid, nil
}

func fetchMii(pid int64, forceRefresh bool) (string, error) {
	now := time.Now()

	var cache CachedResult
	if !forceRefresh &&
		// one day
		db.Where("pid = ? AND date_last_latest > ?", pid, now.AddDate(0, 0, -1)).First(&cache).Error == nil {
		var miiData struct {
			Miis []struct {
				Data string `json:"data"`
			} `json:"miis"`
		}
		json.Unmarshal([]byte(cache.Result), &miiData)
		if len(miiData.Miis) > 0 {
			return miiData.Miis[0].Data, nil
		}
	}

	body, err := nnasHTTPRequest("/miis?pids=" + strconv.FormatInt(pid, 10))
	if err != nil {
		return "", err
	}

	if db.Where("pid = ?", pid).First(&cache).Error != nil {
		cache = CachedResult{PID: pid, DateFetched: now, DateLastLatest: now}
	}
	cache.Result = string(body)
	db.Save(&cache)

	var miiData struct {
		Miis []struct {
			Data string `json:"data"`
		} `json:"miis"`
	}
	json.Unmarshal(body, &miiData)
	if len(miiData.Miis) > 0 {
		return miiData.Miis[0].Data, nil
	}
	return "", fmt.Errorf("no Mii data found")
}

func miiHandler(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) != 3 || parts[2] == "" {
		http.Error(w, "usage: /mii_data/(nnid here)", http.StatusBadRequest)
		return
	}
	nnid := parts[2]

	query := r.URL.Query()
	forceRefresh, _ := strconv.ParseBool(query.Get("force_refresh"))

	pid, err := fetchNNIDToPID(nnid)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	miiData, err := fetchMii(pid, forceRefresh)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Write([]byte(miiData))
}

/*
func main() {
    initDB()
    http.HandleFunc("/mii", miiHandler)
    fmt.Println("Server started")
    log.Fatal(http.ListenAndServe(":8069", nil))
}
*/
