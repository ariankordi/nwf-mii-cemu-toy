package main

import (
	"path/filepath"

	"strings"

	"log"

	// to cleanup on exit
	"os"

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

	upstreamAddr := flag.String("upstream", "localhost:12346", "Upstream TCP server address")
	//flag.BoolVar(&useXForwardedFor, "use-x-forwarded-for", false, "Use X-Forwarded-For header for client IP")

	flag.Parse()

	upstreamTCP = *upstreamAddr
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
	http.HandleFunc("/render.png", renderImage)

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
var client = &http.Client{
	Transport: &http.Transport{
		DisableKeepAlives: true,
	},
}
