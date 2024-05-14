import sys
import os
import time
import threading
from PIL import Image, UnidentifiedImageError
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import subprocess

#TARGET_COLOR = (168, 50, 88)
TARGET_COLOR = (0, 255, 0)
RETRY_DELAY = 0.1  # Seconds to wait before retrying to open a file
MAX_RETRIES = 20  # Max number of retries

def open_image_with_retry(image_path):
    retry_count = 0
    while retry_count < MAX_RETRIES:
        try:
            image = Image.open(image_path)
            image = image.convert('RGBA')  # Convert to RGBA
            return image, True
        except (UnidentifiedImageError, FileNotFoundError, OSError) as e:
            print(f"Error opening image: {e}. Retrying in {RETRY_DELAY} seconds...")
            time.sleep(RETRY_DELAY)
            retry_count += 1
    return None, False

def process_square(image, x, y, width, height):
    thread_start_time = time.time()
    print(f"Processing square at ({x}, {y}) with size {width}x{height}")
    square = image.crop((x, y, x + width, y + height))
    square_data = square.getdata()

    new_square_data = []
    for item in square_data:
        if item[:3] == TARGET_COLOR:
            new_square_data.append((255, 255, 255, 0))  # Making the target color transparent
        else:
            new_square_data.append(item)

    square.putdata(new_square_data)
    output_path = f"/dev/shm/{int(time.time() * 1000)}-{height}-cutout.png"
    square.save(output_path, "PNG")
    subprocess.run(['xdg-open', output_path])  # Open the image
    thread_end_time = time.time()
    print(f"Saved processed square to {output_path}. Thread runtime: {(thread_end_time - thread_start_time) * 1000:.2f} ms")

def process_image(image_path):
    start_time = time.time()
    print(f"Attempting to open image: {image_path}")
    image, opened = open_image_with_retry(image_path)
    if not opened:
        print(f"Failed to open image after {MAX_RETRIES} retries: {image_path}")
        return

    pixels = image.load()
    width, height = image.size
    processed_images = 0
    found_squares = set()

    for x in range(width):
        for y in range(height):
            if pixels[x, y][:3] == TARGET_COLOR and (x, y) not in found_squares:  # Checking only RGB, ignoring alpha
                right, down = x, y
                # Find width
                while right < width and pixels[right, y][:3] == TARGET_COLOR:
                    right += 1
                # Find height
                while down < height and pixels[x, down][:3] == TARGET_COLOR:
                    down += 1
                square_width = right - x
                square_height = down - y
                print(f"Found {square_width}x{square_height} square after {(time.time() - start_time) * 1000:.2f} ms")

                # Mark pixels as found to avoid re-processing
                for found_x in range(x, right):
                    for found_y in range(y, down):
                        found_squares.add((found_x, found_y))

                threading.Thread(target=process_square, args=(image, x, y, square_width, square_height)).start()
                processed_images += 1

    if processed_images == 0:
        print("Uh-oh! No target squares found.")
    else:
        print(f"Processed {processed_images} images.")
    
    end_time = time.time()
    print(f"Runtime: {(end_time - start_time) * 1000:.2f} ms")
    if not is_watching:
        print("Goodbye! (≧◡≦)")

class ImageHandler(FileSystemEventHandler):
    def on_created(self, event):
        if not event.is_directory:
            process_image(event.src_path)

def watch_directory(directory_path):
    event_handler = ImageHandler()
    observer = Observer()
    observer.schedule(event_handler, directory_path, recursive=False)
    observer.start()
    print(f"Started watching {directory_path} for new images.")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()

is_watching = False

if __name__ == "__main__":
    path = sys.argv[1]
    if os.path.isdir(path):
        is_watching = True
        watch_directory(path)
    elif os.path.isfile(path):
        process_image(path)
    else:
        print("The specified path is not valid. Please provide a valid file or directory path.")

