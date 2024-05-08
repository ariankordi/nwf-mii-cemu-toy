package main

import (
	"image"
	"image/color"

	"bytes"
	"encoding/binary"

	// for comparing RenderParameters structs
	"github.com/google/go-cmp/cmp"

	"log"
)

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
			marker, found := extractMarker(buf, idx)
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

func extractMarker(buf []byte, idx int) (RenderParameters, bool) {
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
