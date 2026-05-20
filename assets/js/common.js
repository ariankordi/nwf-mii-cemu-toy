// #region Utility: Base64 -> U8, Hex -> U8, U8 -> Hex
// // ---------------------------------------------------------------------
// //  Utility: Base64 -> U8, Hex -> U8, U8 -> Hex
// // ---------------------------------------------------------------------
// Merge to class: CodecUtility, TextCodingUtil, TextCodec

/**
 * Base64 -> U8 / https://stackoverflow.com/a/41106346
 * @param {string} base64 - Input Base64 data to decode.
 * @returns {Uint8Array} Decoded input data.
 */
const base64ToBytesCore = base64 => Uint8Array.from(atob(base64), c => c.charCodeAt(0));
/**
 * Hex -> U8
 * @param {string} hex - Input hex data to decode.
 * @returns {Uint8Array} Decoded input data.
 */
const hexToBytes = hex => Uint8Array.from({ length: hex.length >>> 1 }, (_, i) =>
  Number.parseInt(hex.slice(i << 1, (i << 1) + 2), 16));

/**
 * U8 -> Hex / https://www.xaymar.com/articles/2020/12/08/fastest-uint8array-to-hex-string-conversion-in-javascript/
 * @param {Array<number>|Uint8Array} bytes - Input data to encode.
 * @returns {string} Hexadecimal representation of `buffer`.
 */
const bytesToHex = bytes => Array.prototype.map.call(bytes,
  (/** @type {{ toString: (arg0: number) => string; }} */ x) =>
    x.toString(16).padStart(2, '0')).join(''); // padStart: ES2017

/**
 * U8 -> Base64
 * @param {Array<number>|Uint8Array} bytes - Input data to encode.
 * @returns {string} Base64 representation of `buffer`.
 */
const bytesToBase64 = bytes =>
// fromCharCode should be compatible with Uint8Array, but its param type is number[].
  btoa(String.fromCharCode.apply(null, /** @type {Array<number>} */ (bytes)));

/**
 * Base64 -> U8 function that also supports Base64URL
 * encoding, and adds padding if it is missing.
 * @param {string} base64 - Input Base64 or Base64URL data to decode.
 * @returns {Uint8Array} Decoded input data.
 */
function base64ToBytes(base64) {
  // Replace URL-safe characters with regular Base64 equivalents.
  base64 = base64.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding to the Base64 string if it is missing.
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return base64ToBytesCore(base64);
}

// #endregion

const stripSpaces = str => str.replace(/\s+/g, '');

const parseHexOrB64ToBytes = (text) => {
  // decode it to a uint8array whether it's hex or base64
  const textData = stripSpaces(text);
  // check if it's base 16 exclusively, otherwise assume base64
  return /^[0-9a-fA-F]+$/.test(textData) ? hexToBytes(textData) : base64ToBytesCore(textData);
};

/**
 * @param {Uint8Array|Array<number>} data
 * @param {number} [startOffset]
 * @param {boolean} [isBigEndian]
 * @param {number} [nameLength]
 * @returns {string}
 */
function extractUTF16Text(data, startOffset, isBigEndian = false, nameLength = 10) {
  // Default to 10 characters (20 bytes) if nameLength is not provided
  const length = nameLength * 2;
  let endPosition = startOffset;

  // Determine the byte order based on the isBigEndian flag
  // NOTE: TextDecoder only works on newish browsers
  // despite the rest of this script using pre-ES6 syntax
  // TODO: TEST ON OLDER BROWSERS!!!!!!!!!!
  const decoder = new TextDecoder(isBigEndian ? 'utf-16be' : 'utf-16le');

  // Find the position of the null terminator (0x00 0x00)
  while (endPosition < startOffset + length) {
    if (data[endPosition] === 0x00 && data[endPosition + 1] === 0x00) {
      break;
    }
    endPosition += 2; // Move in 2-byte increments (UTF-16)
  }

  // Extract and decode the name bytes
  const nameBytes = data.slice(startOffset, endPosition);
  return decoder.decode(nameBytes);
}

//
// common formats
//

/**
 * @typedef {Object} SupportedTypeDefinition
 * @property {string} name - A technical name for the format.
 * @property {Array<number>} sizes - Array of supported sizes (in bytes) for this format.
 * @property {number} [offsetCRC16] - Offset for where the data prior should be calculated into the CRC16.
 * Empty means no CRC16.
 * @property {number} [offsetName] - Offset for the name, if any.
 * @property {boolean} [isNameU16BE] - Whether the name's format is big-endian.
 * @property {boolean} [specialCaseConvertTo] - Whether the format should be
 * converted to studio format in certain cases.
 */

/** @type {Array<SupportedTypeDefinition>} */
const supportedTypes = [
  // don't think anyone actually uses this
  {
    name: 'FFLiMiiDataCore',
    sizes: [72],
    offsetName: 0x1A
  },
  { // "3dsmii"
    name: 'FFLiMiiDataOfficial',
    sizes: [92],
    offsetName: 0x1A
  },
  {
    name: 'FFLStoreData',
    sizes: [96],
    offsetCRC16: 94,
    offsetName: 0x1A
  },
  {
    name: 'FFLStoreData',
    sizes: [104, // 104 = 96 + nfpstoredataextention length
      106, 108, // mii-creator custom format
      336 // plus tomodachi life qr code extension
    ],
    offsetCRC16: 94,
    offsetName: 0x1A,
    specialCaseConvertTo: true
  },
  {
    name: 'RFLCharData',
    sizes: [74],
    offsetName: 0x2,
    isNameU16BE: true
  },
  {
    name: 'RFLStoreData',
    sizes: [76],
    offsetCRC16: 74,
    offsetName: 0x2,
    isNameU16BE: true
  },
  {
    name: 'nn::mii::CharInfo',
    sizes: [88],
    offsetName: 0x10
  },
  {
    name: 'nn::mii::CoreData',
    sizes: [48, 68],
    offsetName: 0x1C
  },
  // TODO: crc is at 0x44? checksums all before that?
  /* {
    name: 'nn::mii::StoreData',
    sizes: [68],
    offsetName: 0x1C,
  }, */
  {
    name: 'Mii Studio Data',
    sizes: [46, 47] // ignoring the encoded format for now
  }
];

/**
 * @param {number} size
 * @returns {SupportedTypeDefinition|undefined}
 */
const findSupportedTypeBySize =
  size => supportedTypes.find(type => type.sizes.includes(size));

export {
  hexToBytes,
  bytesToHex,
  base64ToBytes,
  parseHexOrB64ToBytes,
  bytesToBase64,
  extractUTF16Text,
  findSupportedTypeBySize
};
