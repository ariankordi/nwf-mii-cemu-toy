import os
import time
import threading
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import socket
import sys

class ResponseHandler(FileSystemEventHandler):
    def __init__(self, last_request_time, directory):
        self.last_request_time = last_request_time
        self.directory = directory
        self.seen_files = set()  # Keep track of files we've seen but not read successfully

    def on_created(self, event):
        if not event.is_directory and 'response' in event.src_path:
            self.handle_event(event.src_path)
        elif 'render-finish' in event.src_path:
            print('render-finish seen, signaling to cemu...')
            time.sleep(0.5)
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.connect(('127.0.0.1', 12345))
            sock.sendall(b'SCREENS ')
            sock.close()

    def on_modified(self, event):
        if not event.is_directory and event.src_path in self.seen_files:
            self.handle_event(event.src_path, modified=True)

    def handle_event(self, src_path, modified=False):
        file_timestamp = int(os.path.basename(src_path).split('-')[0])
        if file_timestamp >= self.last_request_time:
            if 'response' not in src_path:
                return
            try:
                with open(src_path, 'r') as f:
                    content = f.read()
                    if content:
                        print(content)
                        if modified:
                            self.seen_files.remove(src_path)  # Remove from seen if successfully read
                    else:
                        self.seen_files.add(src_path)  # Add to seen if empty, to retry on modify
            except IOError as e:
                print(f"Error reading {src_path}: {e}")
                if not modified:
                    self.seen_files.add(src_path)  # Add to seen if error occurred

def watch_directory(directory, last_request_time):
    event_handler = ResponseHandler(last_request_time, directory)
    observer = Observer()
    observer.schedule(event_handler, directory, recursive=False)
    observer.start()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()

def create_request_file(directory, command):
    timestamp = int(time.time())
    filename = f"{timestamp}-request.txt"
    filepath = os.path.join(directory, filename)
    with open(filepath, 'w') as f:
        f.write(command)
    return timestamp

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python script.py <directory>")
        sys.exit(1)

    directory = sys.argv[1]
    if not os.path.exists(directory):
        print(f"Directory {directory} does not exist.")
        sys.exit(1)

    last_request_time = int(time.time())

    # Start watching the directory in a separate thread
    watcher_thread = threading.Thread(target=watch_directory, args=(directory, last_request_time), daemon=True)
    watcher_thread.start()

    print("Type your command and press enter. Type 'exit' to quit.")
    while True:
        command = sys.stdin.read()
        if command.lower() == 'exit':
            break
        last_request_time = create_request_file(directory, command)
