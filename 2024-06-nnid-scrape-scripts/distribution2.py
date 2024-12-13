import sys
from collections import Counter

def main():
    # Check if the file path is provided
    if len(sys.argv) < 2:
        print("Usage: python script.py <filepath>")
        sys.exit(1)

    file_path = sys.argv[1]
    counter = Counter()

    # Process the file
    try:
        with open(file_path, 'r') as file:
            for line in file:
                if line:
                    # Increment the counter for the first character of the line
                    counter[line[0].lower()] += 1
    except Exception as e:
        print(f"Error reading file: {e}")
        sys.exit(1)

    # Output results
    total = sum(counter.values())
    print("Character,Count,Percentage")
    for char, count in sorted(counter.items()):
        print(f"{char},{count},{(count / total * 100):.2f}%")

    # Optionally, output to a file (uncomment if needed)
    # with open("output.csv", "w") as out_file:
    #     out_file.write("Character,Count,Percentage\n")
    #     for char, count in sorted(counter.items()):
    #         out_file.write(f"{char},{count},{(count / total * 100):.2f}%\n")

if __name__ == "__main__":
    main()

