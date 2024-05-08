package main

import (
	"fmt"
	"image"

	"log"

	// to cleanup on exit
	"os"
	"os/signal"

	//"os/exec"
	"sync"
	"time"

	"runtime"
	"syscall"

	"flag"
	"net/http"

	//"slices" // for slices.Delete which did not even work
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
