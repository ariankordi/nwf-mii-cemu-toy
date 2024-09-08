package main

import (
	"errors"
	"path/filepath"
	"reflect"
	"strconv"
	"time"

	"strings"

	"log"

	// to cleanup on exit
	"os"

	"flag"
	"net/http"
	"net/url"

	// for tls sni whitelist
	"crypto/tls"

	"github.com/CloudyKit/jet/v6"
	"github.com/pelletier/go-toml/v2"
	"golang.org/x/text/language"

	// html/template worked okay but
	// jet doesn't exclude comments and
	// is a lil bit more efficient

	"github.com/nicksnyder/go-i18n/v2/i18n"

	// compresses static assets but not dynamic pages
	"codeberg.org/meta/gzipped/v2"

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
)

var (
	translations              *i18n.Bundle
	defaultLocalizer          *i18n.Localizer

	languageStrings           []string
	languageStringsUnderscore []string
)

func loadLocaleFiles(dir string) error {
	// TODO: you may want to set this to the computer's language
	bundle := i18n.NewBundle(language.AmericanEnglish)
	bundle.RegisterUnmarshalFunc("toml", toml.Unmarshal)
	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() || filepath.Ext(path) != ".toml" {
			return nil
		}
		_, err = bundle.LoadMessageFile(path)
		return err
	})
	if err != nil {
		return err
	}

	translations = bundle
	// return prematurely if language strings is populated already
	if len(languageStrings) > 0 {
		return nil
	}
	for _, value := range translations.LanguageTags() {
		str := value.String()
		languageStrings = append(languageStrings, str)
		// Replace dashes with underscores
		languageStringsUnderscore = append(languageStringsUnderscore, strings.ReplaceAll(str, "-", "_"))
	}
	return nil
}

func translateFunc(localizer *i18n.Localizer) func(string) string {
	return func(id string/*, args ...interface{}*/) string {
		/*var data map[string]interface{}
		if len(args) > 0 {
			data = make(map[string]interface{}, len(args))
			for n, iface := range args {
				data["v"+strconv.Itoa(n)] = iface
			}
		}*/
		str, _, err := localizer.LocalizeWithTag(&i18n.LocalizeConfig{
			MessageID:    id,
			//TemplateData: data,
		})
		if str == "" && err != nil {
			log.Println("translateFunc failed:", err)
			return "[translateFunc failed: " + err.Error() + "]"
		}
		return str
	}
}

// createLocaleFunction creates a personalized localized translation function.
func createLocaleFunction(r *http.Request) (func(a jet.Arguments) reflect.Value, error) {
	query := r.URL.Query()
	//cookieLang := r.Cookie("lang")
	cookieLang := query.Get("locale.lang")
	// this is the language that opengraph clients
	// will request for other languages, i think
	ogLang := query.Get("fb_locale")
	// Determine the language from the "Accept-Language" header.
	acceptLang := r.Header.Get("Accept-Language")

	localizer := i18n.NewLocalizer(translations, ogLang, cookieLang, acceptLang)

	Tfunc := translateFunc(localizer)

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

// will be used later
func placeholderTranslate(key string) string {
	return key
}
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

const localesDir = "locales"

var handler http.Handler = http.DefaultServeMux


var gtmContainerID, sentryDSN string
var sentryInitialized, isDevelopment bool
func main() {
	var port, certFile, keyFile, hostnamesSniAllowArg string
	var sentryEnableTracing bool
	//var isDevelopment bool
	flag.StringVar(&port, "port", ":8080", "http port to listen to, OR https if you specify cert and key")
	flag.StringVar(&certFile, "cert", "", "TLS certificate file")
	flag.StringVar(&keyFile, "key", "", "TLS key file")
	flag.StringVar(&hostnamesSniAllowArg, "hostnames", "", "Allowlist of hostnames for TLS SNI")
	flag.BoolVar(&isDevelopment, "live-reloading", false, "Live reload locales and HTML")

	// analytics
	flag.StringVar(&gtmContainerID, "gtm-container-id", "", "Google Tag Manager container ID - passing this will enable it")
	flag.StringVar(&sentryDSN, "sentry-dsn", "", "Sentry (or other compatible platform) DSN")
	flag.BoolVar(&sentryEnableTracing, "sentry-enable-tracing", false, "Enable performance tracing for Sentry")

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
		log.Println("Live reloading enabled.")
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
	http.HandleFunc("/mii_data/", miiHandler)
	http.HandleFunc("/mii_data_random", randomMiiHandler)


	http.HandleFunc("/error_reporting", sseErrorHandler)

	if sentryInitialized {
		http.HandleFunc("/miis/image.png", logRequest(sentryHandler.HandleFunc(renderImage)).ServeHTTP)
	} else {
		http.HandleFunc("/miis/image.png", logRequest(http.HandlerFunc(renderImage)).ServeHTTP)
	}


	http.HandleFunc("/render.png", miisImagePngRedirectHandler)

	// add frontend
	http.Handle("/assets/", http.StripPrefix("/assets/", gzipped.FileServer(gzipped.Dir("assets"))))

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
			Handler:   handler,
		}
		err = server.ListenAndServeTLS(certFile, keyFile)
	} else {
		// no handler because we defined HandleFunc
		err = http.ListenAndServe(port, handler)
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

// TODO REMOVE THIS
var shaderTypeReleaseDate = time.Date(2024, 8, 25, 0, 0, 0, 0, time.UTC)
var oneMonthLater = shaderTypeReleaseDate.AddDate(0, 1, 0)

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

	// TODO: REMOVE THIS
	isNew := time.Now().Before(oneMonthLater)

	// default group that is enabled, controlled by cookie
	groupEnabled := getSelectedInputTypeCookie(r, "nnid")
	data := map[string]interface{}{
		// analytics, optional
		"GTMContainerID": gtmContainerID,
		"SentryDSN": sentryDSN,

		"IsntAMonthFromShaderAndLightingTypeBeingNew": isNew,
		"GroupEnabled": groupEnabled,
		"LanguageStrings": languageStrings,
		"LanguageStringsUnderscore": languageStringsUnderscore,
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
