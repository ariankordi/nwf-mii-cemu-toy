package main

/*
#include <stdlib.h>

#define IPC_IMPLEMENTATION
#include "ipc.h"

#include "fpng_wrapper.h"
#include <stdlib.h>
#cgo LDFLAGS: fpng_wrapper.o fpng.o -lstdc++ -lm
*/
import "C"
import (
	"bytes"
	"encoding/binary"
	"fmt"
	/*"image"
	"image/color"
	"image/png"
	*/"log"
	"os"
	"os/exec"
	"sync"
	"time"
	"unsafe"
)

const (
	shmName = "CemuSharedMemory12345"
	semName = "CemuSemaphore12345"
	shmSize = 4 * 1920 * 1080 // RGBA format
	targetR = 0
	targetG = 255
	targetB = 0
	targetA = 255
)

var shm C.ipc_sharedmemory
var sem C.ipc_sharedsemaphore

var (
	markersMutex sync.Mutex

	//markers = make(map[uint32]*RenderParameters)
	renderRequests []renderRequest
)

type renderRequest struct {
	parameters RenderParameters
	//channel    chan renderResponse
}

type RenderParameters struct {
	// This "hash" is a CRC32 for now, which I know isn't a hash.
	// It can be used as a marker pattern for the start of the data
	MiiDataHash uint32
	Resolution  uint16
	Mode        uint8
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

func processImage(addr unsafe.Pointer, size int) {
	// Cast the shared memory address to a byte slice
	buf := (*[1 << 30]byte)(addr)[:size:size]

	// Image dimensions
	width, height := 1920, 1080 // Assuming fixed dimensions, adjust as necessary

	var wg sync.WaitGroup

	// NOTE: This may take a while, it may be worth it to just copy the marker instead of locking it
	// go through each coordinate plane
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			// Calculate the index in the buffer for the current pixel
			// Each pixel is 4 bytes (RGBA), hence the *4
			idx := (y*width + x) * 4

			// Extract marker directly from the buffer, if present
			marker, found := extractMarker(buf, idx, width)
			if !found {
				continue
			}
			markersMutex.Lock() // Lock the mutex before reading the markers slice
			// iterate through all markers to see if this one is a match
			//for i, _ := range renderRequests {
			// compare if we are even dealing with the same mii
			/*if marker.MiiDataHash != request.parameters.MiiDataHash {
				//log.Println("mii data hash doesn't match:", marker.MiiDataHash, request.parameters.MiiDataHash)
				continue
			}*/
			if marker.Resolution != 1024 {
				continue
			}
			log.Println("found mii hash inside this marker: ", marker)
			// then compare ENTIRE STRUCT
			/*if !cmp.Equal(marker, request.parameters) {
				// skip if this is not an identical request
				log.Println("markers don't match:", marker, request.parameters)
				continue
			}*/
			fmt.Printf("Found marker at (%d, %d) with resolution %d\n", x, y, marker.Resolution)
			//fmt.Printf("Found new marker: %+v at (%d, %d)\n", *matchedMarker, x, y)
			// if scale is zero...
			if marker.Scale == 0 {
				log.Println("WARNING: SCALE IS ZERO???? NO!!!!!!")
				marker.Scale = 1
			}
			go extractAndSaveSquare(buf, x, y, int(marker.Resolution/uint16(marker.Scale)), width)
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
			//renderRequests = append(renderRequests[:i], renderRequests[i+1:]...)
			markersMutex.Unlock() // Unlock the mutex after iterating
			break // Found a known marker, no need to check the rest
			//}
		}
	}

	wg.Wait()
	//processFinishChannel <- struct{}{}
	log.Println("Processing complete.")
}

func extractMarker(buf []byte, idx int, width int) (RenderParameters, bool) {
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

	// TODO: WHY IS THIS NEEDED AGAIN?
	//colors[13] = 0

	reader := bytes.NewReader(colors)
	if err := binary.Read(reader, binary.BigEndian, &params); err != nil {
		return RenderParameters{}, false
	}

	return params, true
}

// TODO: probably remove RenderParameters when you get this to send back
func extractAndSaveSquare(buf []byte, x, y, resolution, width int) {
	// Calculate starting index in buffer
	// NOTE: 4 bytes for rgba again
	startIdx := (y*width + x) * 4
	// Create a new image to hold the extracted square
	/*square := image.NewRGBA(image.Rect(0, 0, resolution, resolution))

	// Pre-define target green (key) color and transparent color
	targetKey := color.RGBA{R: targetR, G: targetG, B: targetB, A: 255}
	transparent := color.RGBA{R: 0, G: 0, B: 0, A: 0}

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
			pixel := color.RGBA{R: r, G: g, B: b, A: a}
			if pixel == targetKey {
				square.Set(sx, sy, transparent)
			} else {
				square.Set(sx, sy, pixel)
			}
		}
	}*/
	squareSize := resolution * resolution * 4 // Assuming RGBA
	square := make([]byte, squareSize)

	// Copy buffer to square byte slice
	for sy := 0; sy < resolution; sy++ {
		for sx := 0; sx < resolution; sx++ {
			idx := startIdx + (sy*width+sx)*4
			if idx >= len(buf)-4 {
				continue
			}
			copyIdx := (sy*resolution + sx) * 4
			copy(square[copyIdx:copyIdx+4], buf[idx:idx+4])
		}
	}

	// Initialize fpng
	C.fpng_init_wrapper()

	// Prepare the output buffer
	outBuf := make([]byte, squareSize) // This might need to be larger, depending on compression
	outSize := C.uint32_t(len(outBuf))

	// Call the wrapper function
	success := C.fpng_encode_image_to_memory_wrapper(unsafe.Pointer(&square[0]), C.uint32_t(resolution), C.uint32_t(resolution), 4, unsafe.Pointer(&outBuf[0]), &outSize, 0)
	if !success {
		fmt.Println("Failed to encode image with fpng")
		return
	}
	outBuf = outBuf[:outSize] // Adjust slice to actual output size

	fileName := fmt.Sprintf("/dev/shm/%d-%d-square.png", time.Now().UnixNano(), resolution)
	file, err := os.Create(fileName)
	if err != nil {
		fmt.Printf("Failed to create file: %v\n", err)
		return
	}
	defer file.Close()

	/*if err := png.Encode(file, square); err != nil {
		fmt.Printf("Failed to encode image: %v\n", err)
		return
	}*/
	// Write the encoded data to file
	if _, err := file.Write(outBuf); err != nil {
		fmt.Printf("Failed to write encoded image to file: %v\n", err)
		return
	}

	fmt.Printf("Extracted square saved to %s\n", fileName)

	// Optionally open the image with xdg-open
	cmd := exec.Command("xdg-open", fileName)
	if err := cmd.Start(); err != nil {
		fmt.Printf("Failed to open image: %v\n", err)
	}

}


/*
func extractAndSaveSquare(buf []byte, x, y, resolution int, width int) {
	// Calculate starting index in buffer
	startIdx := (y*width + x) * 4
	// Create a new image to hold the extracted square
	square := image.NewRGBA(image.Rect(0, 0, resolution, resolution))

	// Process buffer to create square image
	for sy := 0; sy < resolution; sy++ {
		for sx := 0; sx < resolution; sx++ {
			// Calculate index for source pixel
			idx := startIdx + (sy*width+sx)*4
			// Extract RGBA values
			r, g, b, a := buf[idx], buf[idx+1], buf[idx+2], buf[idx+3]
			// Set pixel in square
			square.Set(sx, sy, color.RGBA{R: r, G: g, B: b, A: a})
		}
	}

	fileName := fmt.Sprintf("/dev/shm/%d-%d-square.png", time.Now().UnixNano(), resolution)
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
	}
}
*/
func main() {
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

	/*_ = append(renderRequests, renderRequest{parameters: RenderParameters{
		MiiDataHash:     0xCAFEBEEF,
		Resolution:      1024,
		Mode:            0,
		Expression:      4,
		BackgroundR:     0,
		BackgroundG:     255,
		BackgroundB:     0,
		Scale:           1,
		HorizontalTotal: 0,
		HorizontalChunk: 0,
	}, })*/

	for {
		// Wait on semaphore
		C.ipc_sem_decrement(&sem)

		// Access the shared memory
		addr := unsafe.Pointer(C.ipc_mem_access(&shm))

		// Process the image data
		//buf := (*[1 << 30]byte)(unsafe.Pointer(addr))[:shmSize:shmSize]
		processImage(unsafe.Pointer(addr), shmSize)
	}
}
