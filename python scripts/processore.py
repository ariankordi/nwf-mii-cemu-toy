import sys
import os
import time
import threading
import subprocess
from PIL import Image, UnidentifiedImageError
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

TARGET_COLOR = (168, 50, 88)

def process_image(image, image_path):
    start_time = time.time()
    #print(f"Opening image: {image_path}")
    #image = Image.open(image_path).convert("RGBA")  # Ensure image is in RGBA for transparency processing
    pixels = image.load()
    width, height = image.size
    processed_images = 0

    for x in range(width):
        for y in range(height):
            if pixels[x, y][:3] == TARGET_COLOR:  # Checking only RGB, ignoring alpha
                right, down = x, y
                # Find width
                while right < width and pixels[right, y][:3] == TARGET_COLOR:
                    right += 1
                # Find height
                while down < height and pixels[x, down][:3] == TARGET_COLOR:
                    down += 1
                square_width = right - x
                square_height = down - y
                print(f"Found square. Width: {square_width}, Height: {square_height}")
                threading.Thread(target=process_square, args=(image, x, y, square_width, square_height)).start()
                processed_images += 1
                return  # Assuming one square per image for now

    print(f"Uh-oh!" if processed_images == 0 else f"Processed {processed_images} images.")
    end_time = time.time()
    print(f"Runtime: {(end_time - start_time) * 1000:.2f} ms")
    print("Goodbye! (≧◡≦)")

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
    thread_end_time = time.time()
    print(f"Saved processed square to {output_path}. Thread runtime: {(thread_end_time - thread_start_time) * 1000:.2f} ms")
    subprocess.run(['xdg-open', output_path])


def open_image_with_retry(image_path, max_attempts=5, delay_between_attempts=0.5):
    """
    Attempt to open an image file multiple times with delays between attempts.
    This is to handle the case where the file is detected before it has been fully written.
    """
    attempt = 0
    while attempt < max_attempts:
        try:
            with Image.open(image_path) as img:
                #return img.copy()  # Copy the image data to ensure the file is not locked
                return img.convert("RGBA")
        except (IOError, OSError, UnidentifiedImageError) as e:
            print(f"Attempt {attempt+1}: Unable to open image. Retrying after delay...")
            time.sleep(delay_between_attempts)
            attempt += 1
    raise IOError(f"Failed to open image after {max_attempts} attempts.")


class ImageHandler(FileSystemEventHandler):
    @staticmethod
    def on_created(event):
        if event.is_directory:
            return None

        elif event.event_type == 'created':
            # Take any action here when a file is created.
            print(f"New image detected: {event.src_path}")
            try:
                img = open_image_with_retry(event.src_path)
                process_image(img, event.src_path)  # Adjust the process_image function to accept an opened image
            except IOError as e:
                print(e)

def watch_directory(directory_path):
    event_handler = ImageHandler()
    observer = Observer()
    observer.schedule(event_handler, directory_path, recursive=False)
    observer.start()
    print(f"Started watching {directory_path} for new images.")
    try:
        while True:
            time.sleep(0.2)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()

if __name__ == "__main__":
    path = sys.argv[1]
    if os.path.isdir(path):
        watch_directory(path)
    elif os.path.isfile(path):
        process_image(path)
    else:
        print("The specified path is not valid. Please provide a valid file or directory path.")

