import asyncio
import anyio
import pickle
import os
import logging
from nintendo.nex import backend, friends, settings
from nintendo import nnas
# ^^ FOR DEV: change to "nintendodev"

logging.basicConfig(level=logging.INFO)

# Constants and Credentials (some details redacted)
"""
DEVICE_ID = 0
SERIAL_NUMBER = ""
SYSTEM_VERSION = 0x3000
REGION = 2
COUNTRY = "US"
LANGUAGE = "en"
USERNAME = "PokeFan2KG"
PASSWORD = ""
TITLE_ID = 0x10001C00
TITLE_VERSION = 0
GAME_SERVER_ID = 0x3200
"""
# believe that the above are ONLY used for nnas authentication
# which, this script DOES NOT DO!!!!! it uses a NEX token you provide

ACCESS_KEY = "ridfebb9"
NEX_VERSION = 20000
PID_START = 1799999999
PID_END = 1735099999
PID_FILE = 'current_pid.txt'
DATA_FILE_PREFIX = 'nnid_data_'
MAX_PIDS_PER_REQUEST = 60000

# Setup and Login
async def setup_and_login():
    """
    nas = nnas.NNASClient()
    nas.set_device(DEVICE_ID, SERIAL_NUMBER, SYSTEM_VERSION, ENTER_YOUR_DEVICE_CERT_IN_QUOTES_IN_PLACE_OF_THIS_VARIABLE)
    nas.set_title(TITLE_ID, TITLE_VERSION)
    nas.set_locale(REGION, COUNTRY, LANGUAGE)
    """

    nex_token = nnas.NexToken()
    nex_token.host = '34.211.235.135'
    nex_token.port = 60000
    nex_token.pid = 1753168337
    nex_token.password = ''
    nex_token.token = ''

    s = settings.load("friends")
    s.configure(ACCESS_KEY, NEX_VERSION)

    #return await backend.connect(s, nex_token.host, nex_token.port), nas
    return s, nex_token#, nas

# Save progress and data
def save_progress(pid):
    with open(PID_FILE, 'w') as f:
        f.write(str(pid))

def save_data(data, index):
    with open(f"{DATA_FILE_PREFIX}{index}.pickle", 'wb') as f:
        pickle.dump(data, f)

def find_next_data_file_index(prefix):
		"""
		Find the next available file index to avoid overwriting existing files.
		"""
		index = 0
		while os.path.exists(f"{prefix}{index}.pickle"):
				index += 1
		return index

# Main logic to iterate through PIDs and fetch data
async def fetch_nnids():
    settings, nex_token = await setup_and_login()
    
    current_pid = PID_START
    # Use find_next_data_file_index to avoid overwriting existing files
    index = find_next_data_file_index(DATA_FILE_PREFIX)

    # Load the last PID if available
    if os.path.exists(PID_FILE):
        with open(PID_FILE, 'r') as f:
            current_pid = int(f.read().strip())

    # Establish connection within the async context manager
    async with backend.connect(settings, nex_token.host, nex_token.port) as be:
        async with be.login(str(nex_token.pid), nex_token.password) as client:
            friends_client = friends.FriendsClientV2(client)
            while current_pid >= PID_END:
                try:
                    pid_range = list(range(current_pid, max(current_pid - MAX_PIDS_PER_REQUEST, PID_END - 1), -1))
                    basic_info = await friends_client.get_basic_info(pid_range)
                    if basic_info:
                        save_data(basic_info, index)
                        index += 1  # Increment index after saving to ensure the next file is unique
                        current_pid = pid_range[-1] - 1  # Prepare the next PID
                        save_progress(current_pid)
                    else:
                        logging.info("Empty list returned, stopping.")
                        break
                except Exception as e:
                    logging.error(f"An error occurred: {e}")
                    await asyncio.sleep(60)  # Wait a minute before retrying
                    continue

# Run the fetch process
if __name__ == "__main__":
    asyncio.run(fetch_nnids())

