import os
import pickle
import glob

def count_nnids_in_pickles(data_file_prefix):
    total_nnids = 0
    # Use glob to find all files matching the pattern
    for filename in glob.glob(f'{data_file_prefix}*.pickle'):
        with open(filename, 'rb') as f:
            # Load the list stored in the pickle file
            nnid_list = pickle.load(f)
            # Add the number of NNIDs in the current file to the total count
            total_nnids += len(nnid_list)
            print(f"Processed {len(nnid_list)} NNIDs from {filename}")

    return total_nnids

# Example usage
if __name__ == "__main__":
    data_file_prefix = 'nnid_data_'
    total_nnids = count_nnids_in_pickles(data_file_prefix)
    print(f"Total NNIDs archived: {total_nnids}")
