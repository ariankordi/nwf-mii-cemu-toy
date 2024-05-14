import mmap
import posix_ipc
import time

# Shared memory and semaphore names (must match the C++ names)
shm_name = "CemuSharedMemory12345"
sem_name = "CemuSemaphore12345"

# Open the existing shared memory object and semaphore
shm = posix_ipc.SharedMemory(shm_name)
sem = posix_ipc.Semaphore(sem_name)

# Map the shared memory into memory
mm = mmap.mmap(shm.fd, shm.size)
shm.close_fd()

# Loop to wait for the semaphore, read the shared memory, and dump it to a file
while True:
    # Wait for the semaphore (new data available)
    sem.acquire()
    
    # Read from shared memory
    mm.seek(0)
    data = mm.read(mm.size())  # Adjust this as needed based on the actual data size

    # Dump data to a file
    file_name = time.strftime("%Y%m%d-%H%M%S") + ".raw"
    with open(file_name, "wb") as f:
        f.write(data)
    
    print(f"Data dumped to {file_name}")

