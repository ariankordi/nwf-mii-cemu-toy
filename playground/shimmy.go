package main

import (
	"fmt"
	"os"
	"syscall"
	"unsafe"
)

func main() {
	// Shared memory name, matching the name used in the C++ code
	const shmName = "cemu_shared_memory"
	// Size of the shared memory segment; adjust as needed
	const shmSize = 4 * 1920 * 1080 // Example for a 1920x1080 image at 4 bytes per pixel

	// Open the shared memory object
	fd, err := syscall.Open("/dev/shm/"+shmName, syscall.O_RDWR, 0)
	if err != nil {
		panic(fmt.Sprintf("Error opening shared memory: %v", err))
	}
	defer syscall.Close(fd)

	// Memory-map the shared memory object
	addr, _, errno := syscall.Syscall6(syscall.SYS_MMAP, 0, shmSize, syscall.PROT_READ, syscall.MAP_SHARED, uintptr(fd), 0)
	if errno != 0 {
		panic(fmt.Sprintf("mmap failed: %v", errno))
	}
	defer syscall.Syscall(syscall.SYS_MUNMAP, addr, shmSize, 0)

	// Create a slice backed by the shared memory (this is where unsafe comes in)
	data := (*[1 << 30]byte)(unsafe.Pointer(addr))[:shmSize:shmSize]

	// Write the data to a file
	fileName := fmt.Sprintf("%d.raw", syscall.Getpid()) // Using PID for uniqueness; consider using a timestamp
	file, err := os.Create(fileName)
	if err != nil {
		panic(fmt.Sprintf("Error creating file: %v", err))
	}
	defer file.Close()

	_, err = file.Write(data)
	if err != nil {
		panic(fmt.Sprintf("Error writing to file: %v", err))
	}

	fmt.Printf("Data dumped to %s\n", fileName)
}

