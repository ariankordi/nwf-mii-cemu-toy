import asyncio
import aiofiles
import glob
import pickle
import logging
import os
import sys
from concurrent.futures import ThreadPoolExecutor
from functools import partial

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Normalization function
def normalize_nnid(nnid):
    return nnid.lower().translate(str.maketrans('', '', '-_.'))

# Asynchronous function to read and process NNIDs from a file
async def process_file(file_path):
    logging.info(f"Processing file: {file_path}")
    async with aiofiles.open(file_path, 'rb') as f:
        data = await f.read()
    nnids = pickle.loads(data)
    return [normalize_nnid(nnid.nnid) for nnid in nnids]

# Function to process NNIDs in batches and write to the output file
async def process_and_write(files, batch_size, bulk_size, output_file):
    total_processed = 0
    with ThreadPoolExecutor() as executor:
        for i in range(0, len(files), batch_size):
            batch = files[i:i+batch_size]
            logging.info(f"Processing batch {i//batch_size + 1}/{(len(files) - 1)//batch_size + 1}")
            loop = asyncio.get_event_loop()
            tasks = [loop.run_in_executor(executor, partial(asyncio.run, process_file(file))) for file in batch]
            results = await asyncio.gather(*tasks)

            # Flatten the list of lists
            all_nnids = [nnid for sublist in results for nnid in sublist]

            # Process in bulks
            for j in range(0, len(all_nnids), bulk_size):
                bulk = all_nnids[j:j+bulk_size]
                async with aiofiles.open(output_file, 'a') as f:
                    await f.write('\n'.join(bulk) + '\n')
                total_processed += len(bulk)
                logging.info(f"Processed {total_processed} NNIDs so far.")

    return total_processed

def main():
    logging.info("Starting NNID normalization process")

    # Get batch size and bulk size from environment variables
    batch_size = int(os.getenv('BATCH_SIZE', 10))
    bulk_size = int(os.getenv('BULK_SIZE', 1000))
    output_file = sys.argv[1]

    files = glob.glob('nnid_data_*.pickle')
    if not files:
        logging.warning("No files found. Exiting.")
        return

    logging.info(f"Found {len(files)} files to process.")
    total_processed = asyncio.run(process_and_write(files, batch_size, bulk_size, output_file))
    logging.info(f"Total NNIDs processed and written: {total_processed}")

if __name__ == "__main__":
    main()

