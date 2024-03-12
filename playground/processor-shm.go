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
	"image/draw"
	"image/color"
	"image/png"
	"os"
	"os/exec"
	"sync"
	"time"
	"unsafe"
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

type Point struct {
	X, Y int
}

// processImage processes the image buffer and extracts squares with the target color.
func processImage(buf []byte) {
	start := time.Now()
	img := image.NewRGBA(image.Rect(0, 0, 1920, 1080))
	copy(img.Pix, buf)

	var wg sync.WaitGroup
	processedImages := 0

	var processedPoints map[Point]bool = make(map[Point]bool)

	for x := 0; x < img.Bounds().Dx(); x++ {
		for y := 0; y < img.Bounds().Dy(); y++ {
			if _, processed := processedPoints[Point{x, y}]; processed {
				continue
			}

			if img.PixOffset(x, y) < len(img.Pix) {
				r, g, b, a := img.At(x, y).RGBA()
				if r>>8 == targetR && g>>8 == targetG && b>>8 == targetB && a>>8 == targetA {
					right, down := x, y
					for ; right < img.Bounds().Dx() && matchTargetColor(img.At(right, y)); right++ {
					}
					for ; down < img.Bounds().Dy() && matchTargetColor(img.At(x, down)); down++ {
					}
					width, height := right-x, down-y
					if width != height {
						continue // Skip non-square shapes
					}

					// Add points to the processedPoints list
					for i := x; i < right; i++ {
						for j := y; j < down; j++ {
							processedPoints[Point{i, j}] = true
						}
					}

					wg.Add(1)
					go func(x, y, width, height int) {
						defer wg.Done()
						processSquare(img, x, y, width, height)
					}(x, y, width, height)
					processedImages++
				}
			}
		}
	}

	wg.Wait()
	if processedImages == 0 {
		fmt.Println("Uh-oh! No target squares found.")
	} else {
		fmt.Printf("Processed %d images.\n", processedImages)
	}
	fmt.Printf("Total processing time: %v\n", time.Since(start))
	//fmt.Println("Goodbye! (≧◡≦)")
}

// matchTargetColor checks if the given color matches the target color.
func matchTargetColor(c color.Color) bool {
	r, g, b, a := c.RGBA()
	return r>>8 == targetR && g>>8 == targetG && b>>8 == targetB && a>>8 == targetA
}

// processSquare processes a single square by removing the target color and saving the result.
func processSquare(img *image.RGBA, x, y, width, height int) {
	start := time.Now()
	rect := image.Rect(x, y, x+width, y+height)
	square := image.NewRGBA(rect)
	draw.Draw(square, rect, img, rect.Min, draw.Src)

	// Make the target color transparent
	for i := square.Bounds().Min.X; i < square.Bounds().Max.X; i++ {
		for j := square.Bounds().Min.Y; j < square.Bounds().Max.Y; j++ {
			if matchTargetColor(square.At(i, j)) {
				square.Set(i, j, color.RGBA{255, 255, 255, 0})
			}
		}
	}

	fileName := fmt.Sprintf("/dev/shm/%d-%d-cutout.png", time.Now().UnixNano(), height)
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

	// Open the image with xdg-open
	cmd := exec.Command("xdg-open", fileName)
	if err := cmd.Start(); err != nil {
		fmt.Printf("Failed to open image: %v\n", err)
	}

	fmt.Printf("Processed square saved to %s. Processing time: %v\n", fileName, time.Since(start))
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

