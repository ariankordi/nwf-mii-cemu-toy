package main

/*
#include <stdlib.h>

#define IPC_IMPLEMENTATION
#include "ipc.h"
*/
import "C"
import (
	"fmt"
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


var markers = map[uint32]bool{
	0xCAFEBEEF: true,
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
	img := image.NewRGBA(image.Rect(0, 0, 1920, 1080))
	copy(img.Pix, buf)

	var wg sync.WaitGroup

	for x := 0; x < img.Bounds().Dx(); x++ {
		for y := 0; y < img.Bounds().Dy(); y++ {
			if marker, found := extractMarker(img, x, y); found {
				if _, exists := markers[marker.MiiDataHash]; exists {
					fmt.Printf("Found marker at (%d, %d) with resolution %d\n", x, y, marker.Resolution)
					wg.Add(1)
					fmt.Println(marker)
					go func(x, y int, resolution uint16) {
						defer wg.Done()
						extractAndSaveSquare(img, x, y, int(resolution))
					}(x, y, (marker.Resolution / uint16(marker.Scale)))
				}
			}
		}
	}

	wg.Wait()
	fmt.Println("Processing complete.")
}

func extractMarker(img *image.RGBA, x, y int) (RenderParameters, bool) {
	if x+1 >= img.Bounds().Dx() || y+1 >= img.Bounds().Dy() {
		return RenderParameters{}, false
	}

	var params RenderParameters
	colors := make([]byte, 14) // 6 bytes: R&G for three pixels to read MiiDataHash (uint32) and Resolution (uint16)

	// read about as many pixels as colors we set above
	var pixelsToRead = len(colors) / 2

	for i := 0; i < pixelsToRead; i++ {
		r, g, _, _ := img.At(x+i, y).RGBA()
		colors[2*i], colors[2*i+1] = byte(r>>8), byte(g>>8)
	}

	reader := bytes.NewReader(colors)
	if err := binary.Read(reader, binary.BigEndian, &params); err != nil {
		return RenderParameters{}, false
	}

	return params, true
}

func extractAndSaveSquare(img *image.RGBA, x, y, resolution int) {
	rect := image.Rect(x, y, x+resolution, y+resolution)
	square := image.NewRGBA(rect)
	green := color.RGBA{R: 0, G: 255, B: 0, A: 255} // Define the green color to be removed
	transparent := color.RGBA{R: 0, G: 0, B: 0, A: 0} // Define transparent color

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

