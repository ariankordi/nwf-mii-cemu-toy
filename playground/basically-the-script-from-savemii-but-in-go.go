package main

import (
	"bytes"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
)

func main() {
	if len(os.Args) < 3 {
		fmt.Println("Please provide the file paths for dummyAmiiboData and base64MiiData as arguments.")
		return
	}

	// Read dummy Amiibo data from file
	dummyAmiiboData, err := ioutil.ReadFile(os.Args[1])
	if err != nil {
		fmt.Printf("Error reading dummy Amiibo data file: %v\n", err)
		return
	}

	// Read the Mii data and replace it in the amiibo data array
	decodedMiiData, err := ioutil.ReadFile(os.Args[2])
	if err != nil {
		fmt.Printf("Error reading Mii data file: %v\n", err)
		return
	}
	copy(dummyAmiiboData[0x4C:], decodedMiiData)

	// Prepare and send the POST request with the modified amiibo data
	resp, err := http.Post("http://127.0.0.1:12345", "application/octet-stream", bytes.NewReader(dummyAmiiboData))
	if err != nil {
		fmt.Printf("Error sending POST request: %v\n", err)
		return
	}
	defer resp.Body.Close()

	fmt.Println("POST request sent successfully. Status Code:", resp.StatusCode)

	// To send the request asynchronously and log an error if the response is bad, you could do something like this:
	/*
		go func() {
			resp, err := http.Post("http://127.0.0.1:12345", "application/octet-stream", bytes.NewReader(decodedAmiiboData))
			if err != nil {
				log.Printf("Error sending POST request: %v\n", err)
				return
			}
			defer resp.Body.Close()

			if resp.StatusCode >= 400 {
				log.Println("Received bad response from server. Status Code:", resp.StatusCode)
			}
		}()
	*/
}

