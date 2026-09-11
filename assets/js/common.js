// @ts-check

import { ExtendedVer3 } from './ExtendedVer3Formats.js';

// #region Utility: Base64 -> U8, Hex -> U8, U8 -> Hex
// // ---------------------------------------------------------------------
// //  Utility: Base64 -> U8, Hex -> U8, U8 -> Hex
// // ---------------------------------------------------------------------
// Merge to class: CodecUtility, TextCodingUtil, TextCodec

// Base64

/** Base64 -> Bytes / https://stackoverflow.com/a/41106346 */
const base64ToBytes = (/** @type {string} */ base64) =>
  Uint8Array.from(atob(base64), c => c.charCodeAt(0));

/** Bytes -> Base64 */
const bytesToBase64 = (/** @type {ArrayLike<number>} */ bytes) =>
  btoa(String.fromCharCode.apply(null, bytes));

// Base64: Extended

/**
 * Base64 -> U8 function that also supports Base64URL
 * encoding, and adds padding if it is missing.
 * @param {string} base64 - Input Base64 or Base64URL data to decode.
 */
function base64ExToBytes(base64) {
  // Replace URL-safe characters with regular Base64 equivalents.
  base64 = base64.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding to the Base64 string if it is missing.
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return base64ToBytes(base64);
}

// Hex

/** Hex -> Bytes */
const hexToBytes = (/** @type {string} */ hex) =>
  Uint8Array.from({ length: hex.length >>> 1 }, (_, i) =>
    Number.parseInt(hex.slice(i << 1, (i << 1) + 2), 16));

/** U8 -> Hex / https://www.xaymar.com/articles/2020/12/08/fastest-uint8array-to-hex-string-conversion-in-javascript/ */
const bytesToHex = (/** @type {ArrayLike<number>} */ bytes) =>
  Array.prototype.map.call(bytes,
    (/** @type {{ toString: (arg0: number) => string; }} */ x) =>
      x.toString(16).padStart(2, '0')).join('');

// #endregion

/** Parses either hex or Base64 -> U8, stripping spaces from the input. */
const parseHexOrB64ToBytes = (/** @type {string} */ text) => {
  text = text.replace(/\s+/g, ''); // Strip spaces.
  // Check if it is hex, otherwise assume it is Base64.
  return /^[0-9a-fA-F]+$/.test(text)
    ? hexToBytes(text)
    : base64ExToBytes(text);
};

// Uint16Array conversion.

const getArray16 = (/** @type {DataView} */ view, littleEndian = true) =>
  Uint16Array.from({ length: view.byteLength / 2 },
    (_, i) => view.getUint16(i * 2, littleEndian));

const getArray16From8 = (/** @type {Uint8Array} */ u8, littleEndian = true) =>
  getArray16(new DataView(u8.buffer, u8.byteOffset, u8.byteLength), littleEndian);

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
 */

/** @type {SupportedTypeDefinition} */ const ver3StoreData = {
  name: 'FFLStoreData',
  sizes: [96],
  offsetCRC16: 94,
  offsetName: 0x1A
};

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
  ver3StoreData,
  {
    name: 'nn::mii::CharInfo',
    sizes: [88],
    offsetName: 0x10
  },
  {
    name: 'nn::mii::CoreData',
    sizes: [48],
    offsetName: 0x1C
  },
  {
    name: 'nn::mii::StoreData',
    sizes: [68],
    offsetCRC16: 0x44,
    offsetName: 0x1C
  },
  {
    name: 'Mii Studio Data',
    sizes: [46, 47] // last covers the obfuscated/encoded format
  }
];

const findSupportedTypeBySize = (/** @type {number} */ size) => {
  const r = supportedTypes.find(type => type.sizes.includes(size));
  return (!r && ExtendedVer3.has(size)) ? ver3StoreData : r;
};

export {
  hexToBytes,
  bytesToHex,
  base64ToBytes,
  base64ExToBytes,
  parseHexOrB64ToBytes,
  bytesToBase64,
  getArray16,
  getArray16From8,
  findSupportedTypeBySize
};
