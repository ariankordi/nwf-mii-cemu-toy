import sys
import os
import time
import threading
from PIL import Image
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

TARGET_COLOR = (168, 50, 88)  # RGB format

def process_image(path):
    start_time = time.time()
    image = Image.open(path).convert("RGBA")  # Ensure image is in RGBA for transparency processing
    pixels = image.load()
    width, height = image.size
    processed_squares = []

    def process_square(x, y):
        nonlocal processed_squares
        square_start_time = time.time()
        if (x, y) in processed_squares:  # Skip if already processed
            return
        square_width = 0
        square_height = 0

        # Find square width
        for w in range(x, width):
            if pixels[w, y][:3] == TARGET_COLOR:
                square_width += 1
            else:
                break

        # Find square height
        for h in range(y, height):
            if pixels[x, h][:3] == TARGET_COLOR:
                square_height += 1
            else:
                break

        # Mark as processed
        for i in range(x, x + square_width):
            for j in range(y, y + square_height):
                processed_squares.append((i, j))

        # Copy and modify the image
        new_image = image.crop((x, y, x + square_width, y + square_height))
        new_pixels = new_image.load()

        for i in range(square_width):
            for j in range(square_height):
                if new_pixels[i, j][:3] == TARGET_COLOR:
                    new_pixels[i, j] = (255, 255, 255, 0)  # Making it transparent

        timestamp = int(time.time() * 1000)
        new_image_path = f'/dev/shm/{timestamp}-{square_width}-cutout.png'
        new_image.save(new_image_path, "PNG")
        print(f"Processed square @{x},{y} to {x + square_width},{y + square_height} in {(time.time() - square_start_time) * 1000:.2f}ms, saved to {new_image_path}")
        os.system('xdg-open ' + new_image_path)

    for x in range(width):
        for y in range(height):
            if pixels[x, y][:3] == TARGET_COLOR and (x, y) not in processed_squares:
                thread = threading.Thread(target=process_square, args=(x, y))
                thread.start()
                print(f"Thread started after {(time.time() - start_time) * 1000:.2f}ms")
                return
                #thread.join()  # Wait for the thread to finish to get accurate timing

    print(f"Total image processing time: {(time.time() - start_time) * 1000:.2f}ms")

class WatchFolder(FileSystemEventHandler):
    def on_created(self, event):
        if not event.is_directory and event.src_path.endswith('.png'):
            print(f"New image detected: {event.src_path}")
            time.sleep(0.9)
            try:
                process_image(event.src_path)
            except OSError as e:
                print('file truncated, trying again after a sec')
                time.sleep(1)
                process_image(event.src_path)

def main():
    if len(sys.argv) > 1:
        target = sys.argv[1]
        if os.path.isdir(target):
            observer = Observer()
            event_handler = WatchFolder()
            observer.schedule(event_handler, target, recursive=False)
            observer.start()
            print("Monitoring folder for new images...")
            try:
                while True:
                    time.sleep(1)
            except KeyboardInterrupt:
                observer.stop()
            observer.join()
        elif os.path.isfile(target):
            print("Processing provided image...")
            process_image(target)
        else:
            print("Specified path does not exist.")
    else:
        print("No file or folder specified.")

if __name__ == "__main__":
    main()

