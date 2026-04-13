package main

import (
	"errors"
	"path/filepath"
	"reflect"
	"strconv"
	"time"

	"strings"

	"log"
	"net" // purely for unix sockets

	// to cleanup on exit
	"os"

	"flag"
	"net/http"
	"net/url"

	// for tls sni whitelist
	"crypto/tls"
	// add custom mime types
	"mime"

	"github.com/CloudyKit/jet/v6"
	"github.com/natefinch/lumberjack"
	"golang.org/x/text/language"

	// html/template worked okay but
	// jet doesn't exclude comments and
	// is a lil bit more efficient
	"github.com/leonelquinteros/gotext"

	// compresses static assets but not dynamic pages
	"github.com/lpar/gzipped/v2"

	//"slices" // for slices.Delete which did not even work

	"github.com/getsentry/sentry-go"
	sentryhttp "github.com/getsentry/sentry-go/http"
	roundrobin "github.com/hlts2/round-robin"

	// gorm dialector type
	// TODO:
	// * do not require either database type
	// ... or gorm in general if you don't even want it
	"github.com/aarol/reload"
	"gorm.io/driver/mysql"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	// import swaggo documentation:
	"github.com/swaggo/http-swagger"
	_ "ffl-testing-frontend-http/docs"
	"slices"
)

var (
	locale                    map[string]* gotext.Locale
	defaultLocale             *gotext.Locale

	languageDefault         = language.AmericanEnglish.String()
	languageStrings           []string
	languageStringsUnderscore []string
)

func loadLocaleFiles(dir string) error {
	// TODO: you may want to set this to the computer's language
	locale = make(map[string]*gotext.Locale)
	files, err := os.ReadDir(dir)
	if err != nil {
		return err
	}
	dirOuter := filepath.Join(dir, "..")

	ext := ".po"//".mo"

	for _, file := range files {
		if !file.IsDir() && filepath.Ext(file.Name()) == ext {
			lang := strings.TrimSuffix(file.Name(), ext)
			//loc := gotext.NewLocale(dir, lang)

			// HACK: instead of having LC_MESSAGES/language/domain.po ...
			// the "locales" folder is the language, and each language is a "domain"
			loc := gotext.NewLocale(dirOuter, dir)
			//loc.AddDomain("messages") // Default domain
			loc.AddDomain(lang)
			loc.SetDomain(lang)

			log.Println("loaded locale:", lang)
			locale[lang] = loc
			if (lang == languageDefault) {
				defaultLocale = loc
			}
		}
	}

	// return early if language strings is populated already
	if len(languageStrings) > 0 {
		return nil
	}
	// populate languages for templates
	for lang := range locale {
		languageStrings = append(languageStrings, lang)
		// replace dashes with underscores
		languageStringsUnderscore = append(languageStringsUnderscore, strings.ReplaceAll(lang, "-", "_"))
	}
	return nil
}

// createLocaleFunction creates a personalized localized translation function.
func createLocaleFunction(r *http.Request) (func(a jet.Arguments) reflect.Value, error) {
	query := r.URL.Query()
	//cookieLang := r.Cookie("lang")
	cookieLang := query.Get("locale.lang")
	// this is the language that opengraph clients
	// will request for other languages, i think
	  // ogLang := query.Get("fb_locale")
	// Determine the language from the "Accept-Language" header.
	  // acceptLang := r.Header.Get("Accept-Language")

	lang := cookieLang
	if lang == "" {
		lang = r.Header.Get("Accept-Language")
		if strings.Contains(lang, ",") {
			lang = strings.SplitN(lang, ",", 2)[0]
		}
	}
	lang = strings.TrimSpace(lang)
	// check if lang exists, fallback to english if doesn't exist
	if _, ok := locale[lang]; !ok {
		lang = languageDefault//language.AmericanEnglish.String() // fallback
	}
	// if english doesn't exist then panic
	if _, ok := locale[lang]; !ok {
		log.Fatalf("fallback locale %s does not exist\n", lang)
	}

	Tfunc := func(msgid string) string {
		// NOTE: For whatever reason, IsTranslated() where pluralized count is 0
		// will always return false, but IsTranslatedND() with count of 1 works.
		if (!locale[lang].IsTranslatedND(locale[lang].GetDomain(), msgid, 1) &&
			defaultLocale != nil) {
			// If this string is not translated, get from the default locale.
			return defaultLocale.Get(msgid)
		}
		return locale[lang].Get(msgid)
	}

	// map translation function to be used as "T" in template
	//return template.FuncMap{"_": Tfunc}, nil
	return func(a jet.Arguments) reflect.Value {
		strIn := a.Get(0).Interface().(string)
		strOut := Tfunc(strIn)
		return reflect.ValueOf(strOut)
	}, nil
}

const templatesDir = "views"
// walk through and load templates

func assetURLWithTimestamp(assetPath string) (string) {//, error) {
	// Get the file stats
	fileInfo, err := os.Stat(assetPath)
	if err != nil {
		// If the file doesn't exist then return nothing
		if errors.Is(err, os.ErrNotExist) {
			return ""//, nil
		}
		errStr := "error loading asset path: " + assetPath + " , error:" + err.Error()
		log.Println(errStr)
		return errStr//"", err
	}

	// Extract the modification time
	modTime := fileInfo.ModTime()

	// Format the modification time as a timestamp (e.g., Unix timestamp)
	timestamp := strconv.FormatInt(modTime.Unix(), 16)

	// Append the timestamp as a query parameter
	url := assetPath + "?" + timestamp
	return url//, nil
}
func assetURLWithTimestampJet(a jet.Arguments) reflect.Value {
	assetPath := a.Get(0).String()
	url := assetURLWithTimestamp(assetPath)
	return reflect.ValueOf(url)
}

// jet templates are stored here
var views *jet.Set

// specify your own jet options to this like jet.InDevelopmentMode()
func loadTemplates(templatesDir string, opts []jet.Option) {
	// initialize jet loader that reads all templates in the dir
	loader := jet.NewOSFileSystemLoader(templatesDir)
	views = jet.NewSet(
		loader,
		opts...,
	)

	// add global function to append date to asset urls
	views.AddGlobalFunc("asset", assetURLWithTimestampJet)
}

const (
	localesDir                 = "locales"

	nnidLookupHandlerPrefix    = "/mii_data/"
	cmocLookupHandlerPrefix    = "/cmoc_lookup/"
	miitomoLookupHandlerPrefix = "/miitomo_get_player_data/"
)

var handler http.Handler = http.DefaultServeMux

var gtmContainerID, cloudflareAnalyticsToken, sentryDSN string
var sentryInitialized, isDevelopment bool
var lumberjackLogger *lumberjack.Logger

// @title Mii Renderer (REAL) Frontend and API
// @version 1.0
// @description This API contains endpoints to fetch Mii data from NNID, CMOC, or Miitomo and an endpoint to render a Mii icon. As of writing, the repo for the renderer server is located here: https://github.com/ariankordi/FFL-Testing/tree/renderer-server-prototype and for the frontend/APIs itself is located here: https://github.com/ariankordi/nwf-mii-cemu-toy/tree/ffl-renderer-proto-integrate If you are lurking and found this, my email address is ariankordi@ariankordi.net
// @host mii-unsecure.ariankordi.net
// @BasePath /
func main() {
	var host, unixSocket, certFile, keyFile, hostnamesSniAllowArg, assetsDir string
	var sentryEnableTracing bool
	//var isDevelopment bool
	flag.StringVar(&host, "host", ":8080", "hostname to listen to http on, OR https if you specify cert and key")
	flag.StringVar(&unixSocket, "unix-socket", "", "unix socket to listen on, overrides host")
	flag.StringVar(&certFile, "cert", "", "TLS certificate file")
	flag.StringVar(&keyFile, "key", "", "TLS key file")
	flag.StringVar(&hostnamesSniAllowArg, "hostnames", "", "Allowlist of hostnames for TLS SNI")
	flag.BoolVar(&isDevelopment, "live-reloading", false, "Live reload locales and HTML")
	flag.StringVar(&assetsDir, "assets-dir", "assets", "Set directory for assets")

	// analytics
	flag.StringVar(&gtmContainerID, "gtm-container-id", "", "Google Tag Manager container ID - passing this will enable it")
	flag.StringVar(&cloudflareAnalyticsToken, "cloudflare-analytics-token", "", "Cloudflare Analytics Token (for if you choose the JS snippet option, rather than automatic setup) - passing this will enable it")
	flag.StringVar(&sentryDSN, "sentry-dsn", "", "Sentry (or other compatible platform) DSN")
	flag.BoolVar(&sentryEnableTracing, "sentry-enable-tracing", false, "Enable performance tracing for Sentry")

	// lumberjack logging
	var enableLumberjack, compressLogs bool
	var logFile string
	var maxSize, maxBackups, maxAge int
	flag.BoolVar(&enableLumberjack, "enable-logging", false, "Enable lumberjack logging to a file")
	flag.StringVar(&logFile, "log-file", "ffl-testing-frontend-http.log", "Log file name (used if logging is enabled)")
	flag.IntVar(&maxSize, "log-max-size", 10, "Maximum size of log file in MB before rotation")
	flag.IntVar(&maxBackups, "log-max-backups", 3, "Maximum number of old log files to retain")
	flag.IntVar(&maxAge, "log-max-age", 28, "Maximum number of days to retain old log files")
	flag.BoolVar(&compressLogs, "log-compress", false, "Compress old log files")


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
	upstreamAddrs := flag.String("upstreams", "", "Comma-separated list of upstream TCP server addresses. If you specify this, it will use round robin load balancing with all of the upstreams.")
	flag.BoolVar(&useXForwardedFor, "use-x-forwarded-for", false, "Use X-Forwarded-For header for client IP")

	flag.Parse()

	// // Configure logging
	if enableLumberjack {
		log.Println("Lumberjack logging enabled with file:", logFile)
		lumberjackLogger = &lumberjack.Logger{
			Filename:   logFile,
			MaxSize:    maxSize,    // megabytes
			MaxBackups: maxBackups, // number of old logs to keep
			MaxAge:     maxAge,     // days
			Compress:   compressLogs, // compress the old log files
		}
		log.SetOutput(lumberjackLogger)
	}

	if sentryDSN != "" {
		log.Println("Sentry enabled, client and server - DSN:", sentryDSN)
		clientOptions := sentry.ClientOptions{
			Dsn: sentryDSN,
			EnableTracing: sentryEnableTracing,
			Debug: isDevelopment,
		}
		err := sentry.Init(clientOptions)
		if err != nil {
			log.Println("sentry.Init ERROR:", err)
		}
		defer sentry.Flush(5 * time.Second)
	}
	sentryHandler := sentryhttp.New(sentryhttp.Options{
		Repanic: true,
	})
	sentryInitialized = sentry.CurrentHub().Client() != nil

	if gtmContainerID != "" {
		log.Println("Google Tag Manager enabled - container ID:", gtmContainerID)
	}
	if cloudflareAnalyticsToken != "" {
		log.Println("Cloudflare Analytics enabled - token:", cloudflareAnalyticsToken)
	}

	jetOpts := []jet.Option{}
	if isDevelopment {
		jetOpts = append(jetOpts, jet.InDevelopmentMode())
		// Call `New()` with a list of directories to recursively watch
		reloader := reload.New("locales/", "views/")

		// Optionally, define a callback to
		// invalidate any caches
		reloader.OnReload = func() {
			loadLocaleFiles(localesDir)
			//loadTemplates(templatesDir, jetOpts)
		}

		// Use the Handle() method as a middleware
		handler = reloader.Handle(handler)
		log.Println("Live reloading enabled")
	}

	if *upstreamAddrs != "" {
		urls := []*url.URL{}
		for _, addr := range strings.Split(*upstreamAddrs, ",") {
			u, err := url.Parse("tcp://" + addr)
			if err != nil {
				log.Fatalf("Failed to parse upstream address %s: %v", addr, err)
			}
			urls = append(urls, u)
		}
		var err error
		rr, err = roundrobin.New(urls...)
		if err != nil {
			log.Fatalf("Failed to create round-robin balancer: %v", err)
		}
		log.Println("Using multiple upstreams:")
		for _, u := range urls {
			log.Printf("- %s\n", u.Host)
		}
	} else {
		upstreamTCP = *upstreamAddr
		log.Println("Using single upstream:", upstreamTCP)
	}

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
	// nnid lookups
	// TODO: YOU MAY WANT TO RENAME THESE TO BE MORE CONCISELY FOR NNID
	http.HandleFunc(nnidLookupHandlerPrefix, nnidLookupHandler) // mii_data
	http.HandleFunc("/mii_data_random", randomNNIDHandler)
	// cmoc and miitomo lookups
	http.HandleFunc(cmocLookupHandlerPrefix, cmocLookupHandler)
	http.HandleFunc(miitomoLookupHandlerPrefix, miitomoLookupHandler)

	http.HandleFunc("/error_reporting", sseErrorHandler)

	http.HandleFunc("/render.png", miisImagePngRedirectHandler)

	// add frontend
	mime.AddExtensionType(".cjs", "application/javascript")
	fileServer := gzipped.FileServer(gzipped.Dir(assetsDir))
	if isDevelopment {
		// Wrap the file server with CORS handler middleware
		http.HandleFunc("/assets/", func(w http.ResponseWriter, r *http.Request) {
			// Set CORS headers
			w.Header().Set("Access-Control-Allow-Private-Network", "true")
			w.Header().Set("Access-Control-Allow-Origin", "*")

			// Handle preflight requests
			if r.Method == "OPTIONS" {
				return
			}

			// Serve the files
			http.StripPrefix("/assets/", fileServer).ServeHTTP(w, r)
		})
	} else {
		http.Handle("/assets/", http.StripPrefix("/assets/", fileServer))
	}
	http.Handle("/.well-known/", http.StripPrefix("/.well-known/", http.FileServer(http.Dir(assetsDir + "/.well-known/"))))

	// Load locale files
	if err := loadLocaleFiles(localesDir); err != nil {
		log.Fatalln("failed to load locale files:", err)
	}

	loadTemplates(templatesDir, jetOpts)

	// Pre-compile templates
	/*var err error
	templates, err = template.ParseFiles("views/index.html")
	if err != nil {
		log.Fatal("Error loading templates: ", err)
	}*/



	// index = /index.html
	http.HandleFunc("/", endpointsHandler)

	// do not log these annoying ass paths to see in my logs
	ignoredPaths := []string{"/assets/", "/favicon.",
		// my paths
		"/error_reporting"}
	handler = logRequest(handler, ignoredPaths)

	if sentryInitialized {
		handler = sentryHandler.Handle(handler)
	}

	http.HandleFunc("/miis/image.png", renderImage)
	http.HandleFunc("/miis/image.glb", renderImage)
	http.HandleFunc("/miis/image.tga", renderImage)

	// Swagger UI handler
	http.Handle("/swagger/", httpSwagger.WrapHandler)

	var err error

	var udsListener *net.Listener
	if unixSocket != "" {
		os.Remove(unixSocket)
		/*if _, err := os.Stat(unixSocket); err == nil {
			os.Remove(unixSocket)
		}*/
		var udsListenerNew net.Listener
		udsListenerNew, err = net.Listen("unix", unixSocket)
		if err != nil {
			log.Fatalln("cannot listen on unix socket:", err)
		}
		udsListener = &udsListenerNew
		defer (*udsListener).Close()
		os.Chmod(unixSocket, 0666)
		log.Println("listening on unix socket path:", unixSocket)
	} else {
		log.Println("now listening on", host)
	}

	if certFile != "" && keyFile != "" {
		hostnamesSniAllow := strings.Split(hostnamesSniAllowArg, ",")
		// Create a custom TLS configuration (default)
		tlsConfig := &tls.Config{}

		// TODO YOU PROBABLY WANT TO LOG ALL OF THE HOSTNAMES
		// If we have a list of allowed TLS SNI names, configure GetConfigForClient
		if len(hostnamesSniAllow) > 0 && hostnamesSniAllow[0] != "" {
			tlsConfig.GetConfigForClient = func(helloInfo *tls.ClientHelloInfo) (*tls.Config, error) {
				if slices.Contains(hostnamesSniAllow, helloInfo.ServerName) {
					return nil, nil // Proceed with normal config
				}
				// TODO YOU WANT TO MAKE THIS LOG BETTER
				log.Println(helloInfo.Conn.RemoteAddr(), "sent unrecognized hostname from client:", helloInfo.ServerName)
				return &tls.Config{Certificates: []tls.Certificate{}}, nil // Close connection
			}
		}

		// Create an HTTP server with the custom TLS configuration
		server := &http.Server{
			Addr:      host,
			TLSConfig: tlsConfig,
			Handler:   handler,
		}
		if udsListener != nil {
			// listen on unix socket
			err = server.ServeTLS(*udsListener, certFile, keyFile)
		} else {
			err = server.ListenAndServeTLS(certFile, keyFile)
		}
	} else {
		// no handler because we defined HandleFunc
		if udsListener != nil {
			// listen on unix socket
			err = http.Serve(*udsListener, handler)
		} else {
			err = http.ListenAndServe(host, handler)
		}
	}
	// this will only be reached when either function returns
	log.Fatalln(err)
}

func getSelectedInputTypeCookie(r *http.Request, defaultValue string) string {
	// Default value if the cookie is not found

	// Try to get the cookie from the request
	cookie, err := r.Cookie("selectedInputType")
	if err != nil {
		// If the cookie is not found, return the default value
		if err == http.ErrNoCookie {
			return defaultValue
		}
		// Handle other possible errors
		log.Println("Error retrieving cookie:", err)
		return defaultValue
	}

	// Return the cookie value
	return cookie.Value
}

func endpointsHandler(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/favicon.ico" {
		http.ServeFile(w, r, "assets/favicon.ico")
		return
	}
	// funny easter egg, shows an image of steve jobs
	if r.URL.Path == "/jobs" {
		w.Header().Set("Content-Type", "text/html")
		http.ServeFile(w, r, "assets/jobs.html")
		return
	}
	if r.URL.Path != "/" {
		// Use the 404 handler if the path is not exactly "/"
		//http.NotFound(w, r)
		w.Header().Set("Content-Type", "text/html")
		w.WriteHeader(http.StatusNotFound)
		// todo please find a more elegant way to do this
		// TODO: seeing superfluous writeheader calls here.?
		http.ServeFile(w, r, "assets/404-scary.html") //"404.html")
		return
	}
	// serve index
	// gets the user's language from the request
	i18nFunc, err := createLocaleFunction(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var tmpl *jet.Template
	// look up the precompiled index.html
	tmpl, err = views.GetTemplate("index.html")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Get modification date of the binary
	exePath, err := os.Executable()
	if err != nil {
		log.Println("Failed to get executable path:", err)
	}
	fileInfo, err := os.Stat(exePath)
	if err != nil {
		log.Println("Failed to stat file:", err)
	}
	lastUpdated := ""
	if err == nil {
		lastUpdated = fileInfo.ModTime().Format("January 2, 2006")
	}

	// default group that is enabled, controlled by cookie
	groupEnabled := getSelectedInputTypeCookie(r, "nnid")
	data := map[string]interface{}{
		// analytics, optional
		"GTMContainerID": gtmContainerID,
		"CloudflareAnalyticsToken": cloudflareAnalyticsToken,
		"SentryDSN": sentryDSN,

		"IframeMode": r.URL.Query().Has("iframeMode"),
		"GroupEnabled": groupEnabled,
		"LanguageStrings": languageStrings,
		"LanguageStringsUnderscore": languageStringsUnderscore,
		"LastUpdated": lastUpdated,
		"IsDevelopment": isDevelopment,
	}
	// functions need to be in vars i think
	vars := jet.VarMap{}
	vars.SetFunc("T", i18nFunc)

	// send early hints
	w.Header().Add("Link", "</assets/nintendo_NTLG.woff2>; rel=prefetch; as=font; type=\"font/woff2\"; crossorigin=anonymous")
	w.Header().Add("Link", "</" + assetURLWithTimestamp("assets/style.css") + ">; rel=prefetch; as=style")
	w.Header().Add("Link", "</" + assetURLWithTimestamp("assets/script.js") + ">; rel=prefetch; as=script")
	w.WriteHeader(http.StatusEarlyHints)

	// write response
	if err = tmpl.Execute(w, vars, data); err != nil {
		log.Println("tmpl.Execute:", err)
		// this will probably say headers already sent sigh
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
	//http.ServeFile(w, r, "index.html")
}

// NOTE: redirect /render.png to /miis/image.png why did this ever use render.png
func miisImagePngRedirectHandler(w http.ResponseWriter, r *http.Request) {
	// Parse the new endpoint URL
	newURL, _ := url.Parse("/miis/image.png")

	// Copy the query parameters from the original request
	newURL.RawQuery = r.URL.RawQuery

	// Perform the redirect
	http.Redirect(w, r, newURL.String(), http.StatusFound)
}

// make http client that does not do keep alives
var client = &http.Client{
	Transport: &http.Transport{
		DisableKeepAlives: true,
	},
}
