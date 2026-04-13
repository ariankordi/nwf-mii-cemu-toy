const stripSpaces = str => str.replace(/\s+/g, '');
const hexToUint8Array = hex => new Uint8Array(hex.match(/.{1,2}/g).map(byte => Number.parseInt(byte, 16)));
const base64ToUint8Array = (base64) => {
  // Replace URL-safe Base64 characters
  const normalizedBase64 = base64.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if necessary
  const paddedBase64 = normalizedBase64.padEnd(normalizedBase64.length + (4 - (normalizedBase64.length % 4)) % 4, '=');
  return Uint8Array.from(atob(paddedBase64), c => c.charCodeAt(0));
};
const uint8ArrayToBase64 = data => btoa(String.fromCharCode.apply(null, data));

const parseHexOrB64ToUint8Array = (text) => {
  // decode it to a uint8array whether it's hex or base64
  const textData = stripSpaces(text);
  // check if it's base 16 exclusively, otherwise assume base64
  return /^[0-9a-fA-F]+$/.test(textData) ? hexToUint8Array(textData) : base64ToUint8Array(textData);
};

/**
 * Calculates the CRC-16/CCITT/XMODEM checksum for the specified input data.
 * Courtesy of Luciano Barcaro: https://stackoverflow.com/a/30357446
 * @param {Uint8Array|Array<number>} data - The data to create a checksum of.
 * @param {number} [current] - The starting CRC value, defaulting to 0.
 * @returns {number} The calculated CRC-16 checksum.
 */
function crc16(data, current = 0x0000) {
  const crc = current;
  let msb = crc >> 8;
  let lsb = crc & 0xFF;

  for (let i = 0; i < data.length; i++) {
    const c = data[i];
    let x = c ^ msb;
    x ^= (x >> 4);
    msb = (lsb ^ (x >> 3) ^ (x << 4)) & 0xFF;
    lsb = (x ^ (x << 5)) & 0xFF;
  }

  return (msb << 8) | lsb;
}

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
  // TODO: DON'T KNOW THE CRC, DON'T HAVE SAMPLES EITHER
  /* {
    name: 'nn::mii::StoreData',
    sizes: [68],
    offsetName: 0x1C,
  }, */
  /*
        <!-- switch mii store data types:
        nn::mii::CoreData - 48 bytes
          * size from method nn::mii::detail::CoreDataRaw::SetDefault
            - contains memset for 0x30 = size is 0x30/48
        nn::mii::StoreData - 68 bytes, i think
          * size from method nn::mii::detail::StoreDataRaw::UpdateDeviceCrc -> nn::mii::detail::CalculateAndSetCrc16
            - sets total size to 0x44 = size is 0x44/68
        -->
  */
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
  hexToUint8Array,
  base64ToUint8Array,
  parseHexOrB64ToUint8Array,
  uint8ArrayToBase64,
  extractUTF16Text,
  findSupportedTypeBySize,
  crc16
};
