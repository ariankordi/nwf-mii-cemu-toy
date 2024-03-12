import mmap
import posix_ipc
import threading
from PIL import Image
import numpy as np
import subprocess
import time

TARGET_COLOR = (0, 255, 0, 255)  # Assuming the target color includes the alpha value

def process_image_from_buffer(buffer):
    start_time = time.time()
    image = Image.frombytes('RGBA', (1920, 1080), buffer)
    pixels = image.load()
    width, height = image.size
    processed_images = 0
    found_squares = set()

    for x in range(width):
        for y in range(height):
            if pixels[x, y] == TARGET_COLOR and (x, y) not in found_squares:
                right, down = x, y
                while right < width and pixels[right, y] == TARGET_COLOR:
                    right += 1
                while down < height and pixels[x, down] == TARGET_COLOR:
                    down += 1
                square_width = right - x
                square_height = down - y
                print(f"Found square. Width: {square_width}, Height: {square_height}")

                for found_x in range(x, right):
                    for found_y in range(y, down):
                        found_squares.add((found_x, found_y))

                # are not equal, is not a square
                if square_width != square_height:
                    print(f"Skipping {square_width}x{square_height} rectangle.")
                    #continue

                threading.Thread(target=process_square, args=(image, x, y, square_width, square_height)).start()
                processed_images += 1

    if processed_images == 0:
        print("Uh-oh! No target squares found.")
    else:
        print(f"Processed {processed_images} images.")

    end_time = time.time()
    print(f"Runtime: {(end_time - start_time) * 1000:.2f} ms")

def process_square(image, x, y, width, height):
    thread_start_time = time.time()
    square = image.crop((x, y, x + width, y + height))
    square_data = np.array(square)
    
    # Replace target color with transparency
    square_data[(square_data[:, :, :3] == TARGET_COLOR[:3]).all(axis=2)] = [255, 255, 255, 0]
    new_image = Image.fromarray(square_data, 'RGBA')

    output_path = f"/dev/shm/{int(time.time() * 1000)}-{height}-cutout.tga"
    new_image.save(output_path)
    print(f"Saved processed square to {output_path}.")
    subprocess.run(['xdg-open', output_path])  # Open the image
    thread_end_time = time.time()
    print(f"Thread runtime: {(thread_end_time - thread_start_time) * 1000:.2f} ms")

# Shared memory and semaphore names
shm_name = "/cemu_shared_memory"
sem_name = "/cemu_semaphore"

# Open the existing shared memory object and semaphore
shm = posix_ipc.SharedMemory(shm_name)
sem = posix_ipc.Semaphore(sem_name)

# Map the shared memory into memory
mm = mmap.mmap(shm.fd, shm.size)
shm.close_fd()

# Main loop
while True:
    sem.acquire()  # Wait for the semaphore indicating new data is available
    mm.seek(0)  # Go to the beginning of the shared memory
    buffer = mm.read()  # Read the image data
    process_image_from_buffer(buffer)

