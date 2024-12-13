import asyncio
import aiofiles
import glob
import pickle
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

async def count_nnids_in_file(file_path):
    logging.info(f"Processing file: {file_path}")
    async with aiofiles.open(file_path, 'rb') as f:
        data = await f.read()
    nnids = pickle.loads(data)
    count = len(nnids)
    logging.info(f"Found {count} NNIDs in {file_path}")
    return count

async def count_nnids_parallel(files, batch_size=20):
    total_count = 0
    for i in range(0, len(files), batch_size):
        batch = files[i:i+batch_size]
        logging.info(f"Processing batch {i//batch_size + 1}/{(len(files) - 1)//batch_size + 1}")
        count_tasks = [count_nnids_in_file(file) for file in batch]
        results = await asyncio.gather(*count_tasks)
        batch_total = sum(results)
        total_count += batch_total
        logging.info(f"Batch total: {batch_total}, Running total: {total_count}")
    return total_count

def main():
    logging.info("Starting NNID count process")
    files = glob.glob('nnid_data_*.pickle')
    if not files:
        logging.warning("No files found. Exiting.")
        return
    logging.info(f"Found {len(files)} files to process.")
    total_count = asyncio.run(count_nnids_parallel(files))
    logging.info(f"Total NNIDs archived: {total_count}")

if __name__ == "__main__":
    main()
