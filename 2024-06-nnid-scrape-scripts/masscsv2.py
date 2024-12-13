import asyncio
import aiofiles
import glob
import pickle
import base64
import logging
import os

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

BATCH_LOG_FILE = "batch_progress.log"

async def process_file(file_path):
    logging.info(f"Processing file: {file_path}")
    async with aiofiles.open(file_path, 'rb') as f:
        data = await f.read()
    nnids = pickle.loads(data)
    csv_file_path = f"{file_path}.csv"
    async with aiofiles.open(csv_file_path, 'wb') as csvfile:
        for nnid in nnids:
            mii_data_encoded = base64.b64encode(nnid.mii.data).decode('utf-8')
            csv_line = f"{nnid.pid},{nnid.nnid},{nnid.mii.name},{mii_data_encoded},{nnid.mii.datetime}\n"
            await csvfile.write(csv_line.encode('utf-8'))
    logging.info(f"Finished writing CSV: {csv_file_path}")

async def process_files_in_batches(files, batch_size=10):
    start_batch = 0
    # Check if there's a batch to resume from
    if os.path.exists(BATCH_LOG_FILE):
        with open(BATCH_LOG_FILE, 'r') as f:
            start_batch = int(f.read().strip())
            logging.info(f"Resuming from batch {start_batch}")

    for i in range(start_batch * batch_size, len(files), batch_size):
        batch = files[i:i+batch_size]
        batch_index = i // batch_size
        logging.info(f"Processing batch {batch_index + 1}/{(len(files) - 1)//batch_size + 1}")
        await asyncio.gather(*(process_file(file) for file in batch))
        # Log current batch
        with open(BATCH_LOG_FILE, 'w') as f:
            f.write(str(batch_index + 1))
    # Cleanup after completion
    if os.path.exists(BATCH_LOG_FILE):
        os.remove(BATCH_LOG_FILE)

def main():
    logging.info("Starting processing of pickle files to CSV")
    files = sorted(glob.glob('nnid_data_*.pickle'))  # Ensure files are processed in order
    if not files:
        logging.warning("No pickle files found. Exiting.")
        return
    
    asyncio.run(process_files_in_batches(files))
    logging.info("All files processed.")

if __name__ == "__main__":
    main()

