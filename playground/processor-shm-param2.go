package main

/*
#include <stdlib.h>

#define IPC_IMPLEMENTATION
#include "ipc.h"
*/
import "C"
import (
	"fmt"
	"log"
	"image"
	"image/color"
	"image/png"
	"os"
	"os/exec"
	"sync"
	"time"
	"unsafe"
	"bytes"
	"encoding/binary"
)

const (
	shmName  = "CemuSharedMemory12345"
	semName  = "CemuSemaphore12345"
	shmSize  = 4 * 1920 * 1080 // RGBA format
	targetR  = 0
	targetG  = 255
	targetB  = 0
	targetA  = 255
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
	MiiDataHash     uint32
	Resolution      uint16
	Mode            uint8
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


func processImage(buf []byte) {
	img := image.NewNRGBA(image.Rect(0, 0, 1920, 1080))
	copy(img.Pix, buf)

	var wg sync.WaitGroup

	// NOTE: This may take a while, it may be worth it to just copy the marker instead of locking it
	// go through each coordinate plane
	for x := 0; x < img.Bounds().Dx(); x++ {
		for y := 0; y < img.Bounds().Dy(); y++ {
			// try to read out a marker from each section of the image
			marker, found := extractMarker(img, x, y)
			if !found {
				// skip if uh, not found?
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
				go extractAndSaveSquare(img, x, y, int(marker.Resolution/uint16(marker.Scale)))
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
				break // Found a known marker, no need to check the rest
			//}
			markersMutex.Unlock() // Unlock the mutex after iterating
		}
	}

	wg.Wait()
	//processFinishChannel <- struct{}{}
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


// TODO: probably remove RenderParameters when you get this to send back
func extractAndSaveSquare(img *image.NRGBA, x, y, resolution int) {
	rect := image.Rect(x, y, x+resolution, y+resolution)
	square := image.NewNRGBA(rect)
	green := color.NRGBA{R: targetR, G: targetG, B: targetB, A: 255} // Define the green color to be removed
	transparent := color.NRGBA{R: 0, G: 0, B: 0, A: 0}               // Define transparent color

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
		buf := (*[1 << 30]byte)(unsafe.Pointer(addr))[:shmSize:shmSize]
		processImage(buf)
	}
}

