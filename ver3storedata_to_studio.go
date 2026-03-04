package main

import "encoding/hex"

// Ported from: https://gist.github.com/ariankordi/e6e66b8b03b1424d6e4e489fd9dd83bf#file-simple-ver3storedata-studio-from-c-js
// https://github.com/ariankordi/mii-fusion-experiments/blob/main/MiiToStudio/MiiToStudio.fu

const SizeStudioRawData = 46
const SizeStudioURLData = 47

// ver3StoreDataToCharInfoStudio converts 3DS/Wii U
// format Mii data (Ver3StoreData/FFLStoreData) to
// struct format used on studio.mii.nintendo.com before obfuscation.
func ver3StoreDataToCharInfoStudio(dst []byte, src []byte) {
	// Color indices need to be converted using Ver3 tables: https://github.com/Genwald/MiiPort/blob/4ee38bbb8aa68a2365e9c48d59d7709f760f9b5d/include/convert_mii.h#L8
	// A shortcut that is equivalent to the tables is used in this snippet.

	dst[0] = src[0x42] >> 3 & 7
	dst[1] = src[0x42] & 7
	dst[2] = src[0x2f]
	dst[3] = src[0x35] >> 5
	dst[4] = ((src[0x35] & 1) << 2) | src[0x34]>>6
	dst[5] = src[0x36] & 0x1f
	dst[6] = src[0x35] >> 1 & 0xf
	dst[7] = src[0x34] & 0x3f
	dst[8] = ((src[0x37] & 1) << 3) | src[0x36]>>5
	dst[9] = src[0x37] >> 1 & 0x1f
	dst[10] = src[0x39] >> 4 & 7
	dst[0xb] = src[0x38] >> 5
	dst[0xc] = src[0x3a] & 0x1f
	dst[0xd] = src[0x39] & 0xf
	dst[0xe] = src[0x38] & 0x1f
	dst[0xf] = ((src[0x3b] & 1) << 3) | src[0x3a]>>5
	dst[0x10] = src[0x3b] >> 1 & 0x1f
	dst[0x11] = src[0x30] >> 5
	dst[0x12] = src[0x31] >> 4
	dst[0x13] = src[0x30] >> 1 & 0xf
	dst[0x14] = src[0x31] & 0xf
	dst[0x15] = src[0x19] >> 2 & 0xf
	dst[0x16] = src[0x18] & 1
	dst[0x17] = src[0x44] >> 4 & 7
	dst[0x18] = (src[0x45]&7)*2 | src[0x44]>>7
	dst[0x19] = src[0x44] & 0xf
	dst[0x1a] = src[0x45] >> 3
	dst[0x1b] = src[0x33] & 7
	dst[0x1c] = src[0x33] >> 3 & 1
	dst[0x1d] = src[0x32]
	dst[0x1e] = src[0x2e]
	dst[0x1f] = src[0x46] >> 1 & 0xf
	dst[0x20] = src[0x46] & 1
	dst[0x21] = ((src[0x47] & 3) << 3) | src[0x46]>>5
	dst[0x22] = src[0x47] >> 2 & 0x1f
	dst[0x23] = src[0x3f] >> 5
	dst[0x24] = ((src[0x3f] & 1) << 2) | src[0x3e]>>6
	dst[0x25] = src[0x3f] >> 1 & 0xf
	dst[0x26] = src[0x3e] & 0x3f
	dst[0x27] = src[0x40] & 0x1f
	dst[0x28] = ((src[0x43] & 3) << 2) | src[0x42]>>6
	dst[0x29] = src[0x40] >> 5
	dst[0x2a] = src[0x43] >> 2 & 0x1f
	dst[0x2b] = ((src[0x3d] & 1) << 3) | src[0x3c]>>5
	dst[0x2c] = src[0x3c] & 0x1f
	dst[0x2d] = src[0x3d] >> 1 & 0x1f

	// Convert Ver3 colors to common colors.
	if dst[0x1b] == 0 {
		dst[0x1b] = 8 // Map hair color 0 to 8.
	}
	// Beard and eyebrow color are treated like hair color.
	if dst[0] == 0 {
		dst[0] = 8
	}
	if dst[0xb] == 0 {
		dst[0xb] = 8
	}

	dst[0x24] += 19 // Offset mouth color by 19.
	dst[4] += 8     // Offset eye color by 8.

	// Convert glass color.
	if dst[0x17] == 0 {
		dst[0x17] = 8
	} else if dst[0x17] < 6 {
		dst[0x17] += 13
	}

	// Clamp build and height from Ver3 maximum of 128.
	if 0x7f < dst[2] {
		dst[2] = 127
	}
	if 0x7f < dst[0x1e] {
		dst[0x1e] = 127
	}
}

// obfuscateForStudioURL obfuscates Studio data to be used in the URL.
// seed is best left as 0.
func obfuscateForStudioURL(dst []byte, src [SizeStudioRawData]byte, seed byte) {
	// Obfuscation code from editor.pc.js, search ".prototype.encode".
	// https://web.archive.org/web/20230725172634id_/https://mii-studio.akamaized.net/static/js/editor.pc.46056ea432a4ef3974af.js
	dst[0] = seed // Store the seed at the first byte.
	// Loop over the source array.
	for i := range SizeStudioRawData {
		// Take the source byte and XOR with previous destination byte.
		val := src[i] ^ dst[i]
		// Add 7 to the current value, then take modulo 256.
		dst[i+1] = (7 + val) % 0xff
	}
}

// Ver3StoreDataToStudioURLHex converts 3DS/Wii U Mii data as bytes
// to the format in hex required by the studio.mii.nintendo.com API.
func Ver3StoreDataToStudioURLHex(src []byte) string {
	var studioRaw [SizeStudioRawData]byte
	var studioURL [SizeStudioURLData]byte

	// Convert to raw data.
	ver3StoreDataToCharInfoStudio(studioRaw[:], src)
	// Add obfuscation.
	const seed = 0
	obfuscateForStudioURL(studioURL[:], studioRaw, seed)

	// Convert the byte slice to a hex string.
	return hex.EncodeToString(studioURL[:])
}
