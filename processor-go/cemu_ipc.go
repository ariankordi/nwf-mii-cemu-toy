package main

/*
#include <stdlib.h>

#define IPC_IMPLEMENTATION
#include "ipc.h"
*/
import "C"
import (
	"errors"

	// to make a direct pointer to shm data
	"unsafe"

	// just references to error codes
	"syscall"

	"time"

	"net"
	//"net/http"

	"log"
)

var (
	// TODO: this should be customizable
	cemuPort = "12345"
	// usually runs locally, this is not supposed
	// to be remote, sockets are just IPC
	cemuSocketHost = "127.0.0.1:" + cemuPort
	// TODO: these probably need more specific names.
	// this is for screenshot shm and signal
	shmName = "CemuSharedMemory" + cemuPort
	semName = "CemuSemaphore" + cemuPort
	// TODO ALL OF THESE NEED BRAND NEW NAMES FOR SEM/SHM
	shmSize = 4 * 1920 * 1080 // RGBA format

	shm C.ipc_sharedmemory
	sem C.ipc_sharedsemaphore
	// for nfp is lower
)

func processImageOnSemNotifyThread() {
	// Initialize shared memory and semaphore
	C.ipc_mem_init(&shm, C.CString(shmName), C.size_t(shmSize))
	if C.ipc_mem_open_existing(&shm) != 0 {
		log.Println("Opening existing memory failed, maybe we're first?")
		if C.ipc_mem_create(&shm) != 0 {
			panic("Creating memory failed.")
		}
		// Initialize memory if we're the first
		// Note: Direct memory initialization not shown; handle as needed
		log.Println("Initialized new shared memory.")
	} else {
		log.Println("Attached to existing shared memory.")
	}
	defer C.ipc_mem_close(&shm)

	C.ipc_sem_init(&sem, C.CString(semName))
	if C.ipc_sem_create(&sem, 1) != 0 { // Using '1' to ensure it's unlocked initially
		panic("Failed to create or open existing semaphore.")
	}
	defer C.ipc_mem_close(&shm)

	// put a warning if the thread exits which, it should not
	for {
		// Wait on semaphore
		// TODO: will ipc_sem_try_decrement work better??? maybe you reopen the sem when that fails? try it?
		C.ipc_sem_decrement(&sem)
		log.Println("screenshot recv thread: screenshot data is ready, processing is beginning")

		// Access the shared memory
		addr := unsafe.Pointer(C.ipc_mem_access(&shm))
		// TODO: not sure what this code does, specifically the bitshift
		// it would probably be wise to check if we do not have to use unsafe
		buf := (*[1 << 30]byte)(unsafe.Pointer(addr))[:shmSize:shmSize]
		// blocks the thread, however, that's fine
		// as we shouldn't be able to process more anyway until next cycle
		processImage(buf)
	}
}

// 3 frames duration (1 frame = 16.6 ms)
// wait to make sure this many frames has passed since last run
//const minMsWaitDuration = 15 * 16.6 * time.Millisecond

// delay this function will wait when there is a connection error, before retrying
const retryDelay = 2 * time.Second

func watchRequestsAndSignalScreenshot() {
	for {
		if len(renderRequests) < 1 {
			// if there is nothing in the queue
			// then go ahead and wait for the next message
			log.Println("no more renderRequests, waiting for new one to arrive")
			<-newRequestChannel
		}

		// below here there is a new request...
		// TODO: i wanted to move this to a semaphore but, should it be?
		connection, err := net.Dial("tcp", cemuSocketHost)
		if err != nil {
			log.Println("error connecting to cemu host to submit screenshot request:", err)
			// signal that cemu is down...
			if errors.Is(err, syscall.ECONNREFUSED) ||
				// WSAECONNREFUSED on windows
				errors.Is(err, syscall.Errno(10061)) {
				//log.Println("COULD NOT CONNECT TO CEMU!!!")
				log.Println("OH NO!, screenshot request yielded connection refused, cemu is probably not running. propagating to requests")
				markersMutex.RLock()
				for _, req := range renderRequests {
					select {
					case req.connErrChan <- struct{}{}:
						// Error sent successfully
					default:
						// This prevents blocking if the error channel is not being listened to,
						// but consider if this is the behavior you want, or if logging is needed
					}
				}
				markersMutex.RUnlock()
			}
			// wait before going back into the loop
			time.Sleep(retryDelay)
			log.Println("finished sleeping after failure, retrying screenshot signaling thread")
			continue
		}
		// close the connection but only if there is no error
		defer connection.Close()

		// hacky ass screenshot request http request, thing???
		if _, err = connection.Write([]byte("SCREENS ")); err != nil {
			log.Println("screenshot request write error?:", err)
			// you can probably continue without delay here
			// try again without waiting for image to signal, potentially triggering another shot
			continue
		}
		log.Println("sent screenshot request...")

		select {
		// use a select to enable a timeout for this so it does not hang FOREVERER
		case <-processFinishChannel:
			// just continue...
		case <-time.After(timeout):
			// 7 seconds between screenshot and processing is probably ample time
			log.Println("screenshot signaling thread timed out on image processing...")
		}
		// this will basically just not loop over until it sees that processImage was called
		// that will only happen when the program responds to the semaphore and takes a screenshot
		//time.Sleep(minMsWaitDuration)
	}
}

var (
	nfpShm C.ipc_sharedmemory
	nfpSem C.ipc_sharedsemaphore

	nfpShmName = "NfpShmName" + cemuPort
	nfpSemName = "NfpSemName" + cemuPort
	// TODO ALL OF THESE NEED BRAND NEW NAMES FOR SEM/SHM
	nfpShmSize = 540 // size of amiibo

	// channel we will submit nfp data to!!!!
	nfpChannel = make(chan []byte, nfpShmSize)
)

func nfpSubmitSemThread() {
	C.ipc_mem_init(&nfpShm, C.CString(nfpShmName), C.size_t(nfpShmSize))
	if C.ipc_mem_open_existing(&nfpShm) != 0 {
		log.Println("NFP: Opening existing memory failed, maybe we're first?")
		if C.ipc_mem_create(&nfpShm) != 0 {
			panic("NFP: Creating memory failed.")
		}
		// Initialize memory if we're the first
		// Note: Direct memory initialization not shown; handle as needed
		log.Println("NFP: Initialized new shared memory.")
	} else {
		log.Println("NFP: Attached to existing shared memory.")
	}
	defer C.ipc_mem_close(&nfpShm)

	C.ipc_sem_init(&nfpSem, C.CString(nfpSemName))
	if C.ipc_sem_create(&nfpSem, 1) != 0 { // Using '1' to ensure it's unlocked initially
		panic("NFP: Failed to create or open existing semaphore.")
	}

	defer C.ipc_sem_close(&nfpSem)
	for {
		// wait for anyone to command us
		data := <-nfpChannel
		log.Println("submitting amiibo to semaphore...")
		// Ensure the data size does not exceed the allocated shared memory size.
		if len(data) > int(nfpShmSize) {
			panic("Data size exceeds allocated shared memory size.")
		}

		// Write data to shared memory.
		addr := unsafe.Pointer(C.ipc_mem_access(&nfpShm))
		copy((*[1 << 30]byte)(addr)[:len(data)], data)

		// Signal the semaphore to notify the consumer.
		C.ipc_sem_increment(&nfpSem)
		// TODO: THIS WILL HANG IF PROCESS ON THE OTHER SIDE DOES NOT DECREMENT. ADD TIMEOUT???
	}
}
