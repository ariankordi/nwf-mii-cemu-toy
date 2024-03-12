package main

/*
#include <stdlib.h>

#define IPC_IMPLEMENTATION
#include "ipc.h"
*/
import "C"
import (
	"fmt"
	"os"
	"time"
	"unsafe"
)

func main() {
	const shmName = "CemuSharedMemory12345"
	const shmSize = 4 * 1920 * 1080 // Example size, adjust as needed
	const semName = "CemuSemaphore12345"

	var shm C.ipc_sharedmemory
	var sem C.ipc_sharedsemaphore

	// Initialize shared memory and semaphore
	C.ipc_mem_init(&shm, C.CString(shmName), C.size_t(shmSize))
	C.ipc_sem_init(&sem, C.CString(semName))

	// Try to open or create shared memory and semaphore
	if C.ipc_mem_open_existing(&shm) != 0 {
		panic("Failed to open or create shared memory")
	}
	defer C.ipc_mem_close(&shm)

	if C.ipc_sem_create(&sem, 0) != 0 {
		panic("Failed to open or create semaphore")
	}
	defer C.ipc_sem_close(&sem)

	for {
		// Wait on semaphore
		C.ipc_sem_decrement(&sem)

		// Access the shared memory
		addr := unsafe.Pointer(C.ipc_mem_access(&shm))

		// Create and write to file
		fileName := fmt.Sprintf("%d.raw", time.Now().UnixNano())
		file, err := os.Create(fileName)
		if err != nil {
			panic(fmt.Sprintf("Failed to create file: %v", err))
		}

		dataSlice := (*[1 << 30]byte)(addr)[:shmSize:shmSize]
		if _, err := file.Write(dataSlice); err != nil {
			panic(fmt.Sprintf("Failed to write data to file: %v", err))
		}
		file.Close()

		fmt.Printf("Data dumped to %s\n", fileName)
	}
}

