from PIL import Image

def decode_image_to_parameters(image_path):
    img = Image.open(image_path)
    pixels = img.load()

    # Initialize an empty bytes array to hold our decoded bytes
    decoded_bytes = bytearray()

    # Extract the R and G components of each pixel in the first row
    for x in range(img.width):
        r, g, b, a = pixels[x, 0]  # Assuming the image has an alpha channel
        decoded_bytes.append(r)
        decoded_bytes.append(g)

    # Since the original struct uses big-endian byte order, we'll unpack the bytes accordingly
    params = {
        'MiiDataHash': int.from_bytes(decoded_bytes[0:4], 'big'),
        'Resolution': int.from_bytes(decoded_bytes[4:6], 'big'),
        'Mode': decoded_bytes[6],
        'Expression': decoded_bytes[7],
        'BackgroundR': decoded_bytes[8],
        'BackgroundG': decoded_bytes[9],
        'BackgroundB': decoded_bytes[10],
        'Scale': decoded_bytes[11],
        'HorizontalTotal': decoded_bytes[12],
        'HorizontalChunk': decoded_bytes[13],
    }

    print(params)

# Assuming the modified image is saved at './a.png'
decode_image_to_parameters('./a.png')

