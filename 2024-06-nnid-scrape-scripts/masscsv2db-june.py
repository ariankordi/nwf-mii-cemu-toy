import asyncio
import aiofiles  # install this first
import glob
import pickle
import base64
import logging
import os
import shutil

# install aiofiles, then sqlalchemy and pymysql, i think

def check_disk_space(min_free_space_gb):
    total, used, free = shutil.disk_usage("/")
    free_gb = free / (1024 ** 3)  # Convert from bytes to gigabytes
    if free_gb < min_free_space_gb:
        return False
    return True
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from datetime import datetime

# SQLAlchemy Model Definition
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, String, LargeBinary, DateTime, Integer, Index

Base = declarative_base()

class NnidToMiiDataMap(Base):
    __tablename__ = 'nnid_to_mii_data_map'
    # NOTE: is int(11) here, bigint(20) unsigned in go
    pid = Column(Integer, primary_key=True)
    normalized_nnid = Column(String(16), index=True)
    nnid = Column(String(16))
    data = Column(LargeBinary(96))
    last_modified = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index('ix_normalized_nnid', 'normalized_nnid'),
    )

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

BATCH_LOG_FILE = "batch_progress.log"

# Environment variables with defaults
DATABASE_URL = os.getenv('DATABASE_URL', 'mysql+pymysql://miis:miis@localhost/miis')
BATCH_SIZE = int(os.getenv('BATCH_SIZE', '1000'))
USE_INSERT_IGNORE = os.getenv('USE_INSERT_IGNORE', 'False').lower() in ('true', '1', 't')


# Set up database engine and session factory
engine = create_engine(DATABASE_URL)
Base.metadata.create_all(engine)  # Ensure tables are created
Session = sessionmaker(bind=engine)

def normalize_nnid(nnid):
    return nnid.lower().translate(str.maketrans('', '', '-_.'))


async def process_file(file_path, session):
    logging.info(f"Processing file: {file_path}")
    try:
        async with aiofiles.open(file_path, 'rb') as f:
            data = await f.read()
        nnids = pickle.loads(data)
        batch = []
        for nnid in nnids:
            normalized_nnid = normalize_nnid(nnid.nnid)
            if USE_INSERT_IGNORE:
                # NOTE: now upsert instead of insert ignore
                sql = text("""
                    INSERT INTO nnid_to_mii_data_map (pid, normalized_nnid, nnid, data, last_modified)
                    VALUES (:pid, :normalized_nnid, :nnid, :data, :last_modified)
                    ON DUPLICATE KEY UPDATE
                    normalized_nnid = VALUES(normalized_nnid),
                    nnid = VALUES(nnid),
                    data = VALUES(data),
                    last_modified = VALUES(last_modified)
                """)
                batch.append({
                    'pid': nnid.pid,
                    'normalized_nnid': normalized_nnid,
                    'nnid': nnid.nnid,
                    'data': nnid.mii.data,
                    'last_modified': nnid.mii.datetime.standard_datetime()
                })
                if len(batch) >= BATCH_SIZE:
                    session.execute(sql, batch)
                    session.commit()
                    batch = []
            else:
                mii_data_map = NnidToMiiDataMap(
                    pid=nnid.pid,
                    normalized_nnid=normalized_nnid,
                    nnid=nnid.nnid,
                    data=nnid.mii.data,
                    last_modified=nnid.mii.datetime.standard_datetime()
                )
                batch.append(mii_data_map)
                if len(batch) >= BATCH_SIZE:
                    session.add_all(batch)
                    session.commit()
                    batch = []
        if batch:
            if USE_INSERT_IGNORE:
                session.execute(sql, batch)
            else:
                session.add_all(batch)
            session.commit()
    except Exception as e:
        logging.error(f"Failed to process file {file_path}: {e}")
        session.rollback()
    finally:
        logging.info(f"Finished processing file: {file_path}")


async def process_files_in_batches(files, batch_size=10, min_free_space_gb=1):
    start_batch = 0
    # Check if there's a batch to resume from
    if os.path.exists(BATCH_LOG_FILE):
        with open(BATCH_LOG_FILE, 'r') as f:
            start_batch = int(f.read().strip())
            logging.info(f"Resuming from batch {start_batch}")

    for i in range(start_batch * batch_size, len(files), batch_size):
        #if not check_disk_space(min_free_space_gb):
        #    logging.error("Not enough disk space to continue processing. Exiting.")
        #    break  # Exit the loop if not enough disk space
        batch = files[i:i+batch_size]
        batch_index = i // batch_size
        logging.info(f"Processing batch {batch_index + 1}/{(len(files) - 1)//batch_size + 1}")
        session = Session()
        try:
            await asyncio.gather(*(process_file(file, session) for file in batch))
        finally:
            session.close()
        # Log current batch
        with open(BATCH_LOG_FILE, 'w') as f:
            f.write(str(batch_index + 1))
    # Cleanup after completion
    if os.path.exists(BATCH_LOG_FILE):
        os.remove(BATCH_LOG_FILE)

def main():
    logging.info("Starting processing of pickle files to insert into MySQL")
    # NOTE: importing the pickles REQUIRES NintendoClients alongside everything else installed
    # install "nintendo", pycryptodome, anynet
    files = sorted(glob.glob('nnid_data_*.pickle'))  # Ensure files are processed in order
    if not files:
        logging.warning("No pickle files found. Exiting.")
        return
    
    asyncio.run(process_files_in_batches(files))
    
    logging.info("All files processed.")

if __name__ == "__main__":
    main()

"""
CREATE TABLE nnid_to_mii_data_map (
    pid INT PRIMARY KEY,
    normalized_nnid VARCHAR(16),
    nnid VARCHAR(16),
    data VARBINARY(96),
    last_modified DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX ix_normalized_nnid (normalized_nnid)
) ENGINE=Aria
PARTITION BY RANGE (pid) (
    PARTITION p0 VALUES LESS THAN (1738000000),
    PARTITION p1 VALUES LESS THAN (1744000000),
    PARTITION p2 VALUES LESS THAN (1750000000),
    PARTITION p3 VALUES LESS THAN (1756000000),
    PARTITION p4 VALUES LESS THAN (1762000000),
    PARTITION p5 VALUES LESS THAN (1768000000),
    PARTITION p6 VALUES LESS THAN (1774000000),
    PARTITION p7 VALUES LESS THAN (1780000000),
    PARTITION p8 VALUES LESS THAN (1786000000),
    PARTITION p9 VALUES LESS THAN (1792000000),
    PARTITION p10 VALUES LESS THAN (1798000000),
    PARTITION p11 VALUES LESS THAN (1800000001)
);
"""
