from collections import defaultdict
import string
import sys

def count_first_letters(filename):
    # Create a dictionary to store counts for each starting letter
    counts = defaultdict(int)
    # We're only interested in lowercase letters since usernames are lowercase alphanumeric
    allowed_chars = set(string.ascii_lowercase)

    # Open the file and process each line
    with open(filename, 'r', encoding='utf-8') as file:
        for line in file:
            first_char = line.strip()[0]
            if first_char in allowed_chars:
                counts[first_char] += 1

    # Convert counts to a sorted list of tuples for easier analysis
    sorted_counts = sorted(counts.items())
    return sorted_counts

result = count_first_letters(sys.argv[1])
print(result)
import json
print(json.dumps(result))

# Example usage:
# result = count_first_letters('path_to_your_username_file.txt')
# print(result)
