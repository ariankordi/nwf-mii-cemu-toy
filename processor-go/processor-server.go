package main

import (
	"fmt"
	"image"
	"path/filepath"

	"strings"

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
	// for tls sni whitelist
	"crypto/tls"

	"html/template"

	"github.com/nicksnyder/go-i18n/i18n"

	// compresses static assets but not dynamic pages
	"codeberg.org/meta/gzipped/v2"

	//"slices" // for slices.Delete which did not even work

	// gorm dialector type
	// TODO:
	// * do not require either database type
	// ... or gorm in general if you don't even want it
	"gorm.io/driver/sqlite"
	"gorm.io/driver/mysql"
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

// Declare a variable to hold the pre-compiled templates.
var templates *template.Template

func loadLocaleFiles(dir string) {
	files, err := os.ReadDir(dir)
	if err != nil {
		log.Println("Error reading directory", dir, ":", err)
		return
	}
	for _, f := range files {
		// Construct the full path and load each file
		filePath := filepath.Join(dir, f.Name())
		if err := i18n.LoadTranslationFile(filePath); err != nil {
			log.Println("Error loading file", filePath, ":", err)
		}
	}
}

// TODO: you may want to set this to the computer's language
const defaultLang = "en-US"

// createLocaleFuncMap creates a template.FuncMap with the localized translation function.
func createLocaleFuncMap(r *http.Request) (template.FuncMap, error) {
	query := r.URL.Query()
	//cookieLang := r.Cookie("lang")
	cookieLang := query.Get("locale.lang")
	// this is the language that opengraph clients
	// will request for other languages, i think
	ogLang := query.Get("fb_locale")
	// Determine the language from the "Accept-Language" header.
	acceptLang := r.Header.Get("Accept-Language")
	Tfunc, err := i18n.Tfunc(ogLang, cookieLang, acceptLang, defaultLang)
	// Default to English if there's an error
	if err != nil {
		return nil, err
	}

	// map translation function to be used as "T" in template
	return template.FuncMap{"T": Tfunc}, nil
}

func main() {
	var port, certFile, keyFile, hostnamesSniAllowArg string
	flag.StringVar(&port, "port", ":8080", "http port to listen to, OR https if you specify cert and key")
	flag.StringVar(&certFile, "cert", "", "TLS certificate file")
	flag.StringVar(&keyFile, "key", "", "TLS key file")
	flag.StringVar(&hostnamesSniAllowArg, "hostnames", "", "Allowlist of hostnames for TLS SNI")

	var (
		// cache db connection string
		nnasCacheDBDSN         string
		// nnid to mii map connection string
		// when nnid to mii map database is used...
		// instead of nnid cache for api 0...
		// ... instead it resolves the data directly in this db
		nnidToMiiMapDBDSN      string
		// table name for nnid to mii map
		//nnidToMiiMapDBTabName  string

		// connections which could be any db
		nnasCacheDBConn        gorm.Dialector
		nnidToMiiMapDBConn     gorm.Dialector
	)
	// TODO: hacky non descriptive or helpful name
	const defaultNNASCacheDBDSN = "./nnas_cache_b4_multi.db"
	flag.StringVar(&nnasCacheDBDSN, "cache-db", defaultNNASCacheDBDSN, "Cache DB SQLite location")
	flag.StringVar(&nnidToMiiMapDBDSN, "nnid-to-mii-map-db", "", "MySQL connection string for NNID to Mii mapping database. If you exclude this, it will not be used. If it is the same as the cache DSN, it will use that database instead.")
	// defined/used in nnid_fetch.go
	flag.StringVar(&nnidToMiiDataTable, "nnid-to-mii-map-table", "nnid_to_mii_data_map", "NNID to Mii mapping table if it's not the default.")

	// make default false on windows because it does not work currently
	defaultEnableSuspending := true
	if runtime.GOOS == "windows" {
		defaultEnableSuspending = false
	}
	var enableSuspending bool
	flag.BoolVar(&enableSuspending, "enable-suspending", defaultEnableSuspending, "Enable suspending the Cemu process to save CPU")
	flag.Parse()

	// NOTE: you can change these to use any db if you want
	nnasCacheDBConn = sqlite.Open(nnasCacheDBDSN)
	// nnid mii map db was passed in, so USE IT!!
	if nnidToMiiMapDBDSN != "" {
		if nnidToMiiMapDBDSN == nnasCacheDBDSN {
			log.Println("nnid to mii map dsn is same as nnas cache dsn, using nnas cache database for nnid to mii map (may or may not actually work)")
			nnidToMiiMapDBConn = nnasCacheDBConn
		} else {
			log.Println("using nnid to mii map mysql database")
			nnidToMiiMapDBConn = mysql.Open(nnidToMiiMapDBDSN)
		}
	}
	initNNIDFetchDatabases(nnasCacheDBConn, nnidToMiiMapDBConn)
	http.HandleFunc("/mii_data/", miiHandler)
	http.HandleFunc("/mii_data_random", randomMiiHandler)


	http.HandleFunc("/error_reporting", sseErrorHandler)
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
	http.Handle("/assets/", http.StripPrefix("/assets/", gzipped.FileServer(gzipped.Dir("assets"))))

	// Load locale files
	loadLocaleFiles("locales")

	// Pre-compile templates
	/*var err error
	templates, err = template.ParseFiles("views/index.html")
	if err != nil {
		log.Fatal("Error loading templates: ", err)
	}*/

	// index = /index.html
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/favicon.ico" {
			http.ServeFile(w, r, "assets/favicon.ico")
			return
		}
		// funny easter egg, shows an image of steve jobs
		if r.URL.Path == "/jobs" {
			w.Header().Set("Content-Type", "text/html")
			http.ServeFile(w, r, "views/jobs.html")
			return
		}
		if r.URL.Path != "/" {
			// Use the 404 handler if the path is not exactly "/"
			//http.NotFound(w, r)
			w.Header().Set("Content-Type", "text/html")
			w.WriteHeader(http.StatusNotFound)
			// todo please find a more elegant way to do this
			// TODO: seeing superfluous writeheader calls here.?
			http.ServeFile(w, r, "views/404-scary.html") //"404.html")
			return
		}
		// serve index
		// gets the user's language from the request
		funcMap, err := createLocaleFuncMap(r)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		//tmpl := templates.Lookup("index.html").Funcs(funcMap)
		var tmpl *template.Template
		tmpl, err = template.New("index.html").Funcs(funcMap).ParseFiles("views/index.html")
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if err = tmpl.Execute(w, nil); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		//http.ServeFile(w, r, "index.html")
	})
	log.Println("now listening")
	var err error
	if certFile != "" && keyFile != "" {
		hostnamesSniAllow := strings.Split(hostnamesSniAllowArg, ",")
		// Create a custom TLS configuration (default)
		tlsConfig := &tls.Config{}

		// TODO YOU PROBABLY WANT TO LOG ALL OF THE HOSTNAMES
		// If we have a list of allowed TLS SNI names, configure GetConfigForClient
		if len(hostnamesSniAllow) > 0 && hostnamesSniAllow[0] != "" {
			tlsConfig.GetConfigForClient = func(helloInfo *tls.ClientHelloInfo) (*tls.Config, error) {
				for _, hostname := range hostnamesSniAllow {
					if helloInfo.ServerName == hostname {
						return nil, nil // Proceed with normal config
					}
				}
				// TODO YOU WANT TO MAKE THIS LOG BETTER
				log.Println(helloInfo.Conn.RemoteAddr(), "sent unrecognized hostname from client:", helloInfo.ServerName)
				return &tls.Config{Certificates: []tls.Certificate{}}, nil // Close connection
			}
		}

		// Create an HTTP server with the custom TLS configuration
		server := &http.Server{
			Addr:      port,
			TLSConfig: tlsConfig,
		}
		err = server.ListenAndServeTLS(certFile, keyFile)
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

// reordered on 2024-05-11 to avoid premature termination with all black BG
type RenderParameters struct {
	// This "hash" is a CRC32 for now, which I know isn't a hash.
	// It can be used as a marker pattern for the start of the data
	MiiDataHash uint32
	// resolution can have a zero i thiiinkkk
	Resolution  uint16
	// mode can also be zero
	Mode        uint8
	// expression should always be non-zero
	Expression  uint8
	BackgroundR uint8
	// scale is also non-zero
	Scale       uint8
	BackgroundG uint8
	BackgroundB uint8
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
