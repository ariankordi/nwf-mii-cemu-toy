import { WrappedMiiDataLength } from './WrappedMiiDataSubtle.js';

// // ---------------------------------------------------------------------
// //  CRC-32
// // ---------------------------------------------------------------------

/** Polynomial for CRC-32/POSIX/CKSUM. */
const Crc32CksumPoly = 0x04C11DB7;

/**
 * Function to generate a CRC-32/POSIX/CKSUM table.
 * @param {Uint32Array} table - The Uint32Array to populate with the table.
 * @param {number} [poly] - The polynomial to generate the CRC-32 table with.
 */
function generateCrc32Table(table, poly = Crc32CksumPoly) {
  for (let i = 0; i < 256; i++) {
    let crc = i << 24;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x80000000
        ? (crc << 1) ^ poly
        : crc << 1;
    }
    table[i] = crc >>> 0; // Ensure the value is an unsigned 32-bit integer
  }
}

/** Table for CRC-32 lookup. */
const crc32CksumTable = /* @__PURE__ */ new Uint32Array(256);
generateCrc32Table(crc32CksumTable); // Generate the table.

/**
 * Calculates a checksum of `data` using CRC-32/POSIX/CKSUM.
 * @param {ArrayLike<number>} input - The data to create a checksum of.
 * @param {number} length - The amount of bytes in `input` to calculate.
 * @param {Uint32Array} [table] - The CRC-32 table to use.
 * @returns {number} The CRC-32 checksum.
 */
function crc32(input, length = input.length, table = crc32CksumTable) {
  let crc = 0x00000000;
  for (let i = 0; i < length; i++) {
    const byte = (input[i] ^ (crc >>> 24)) & 0xFF;
    crc = (table[byte] ^ (crc << 8)) >>> 0;
  }
  // XOR with 0xFFFFFFFF at the end and ensure it's unsigned
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// // ---------------------------------------------------------------------
// //  AES-CTR
// // ---------------------------------------------------------------------

const sc = globalThis.crypto.subtle;

class TomoExtraData {
  /** @private */
  static AesCtrKeyBytes = /* @__PURE__ */ new Uint8Array([0x30, 0x81, 0x9F,
    0x30, 0x0D, 0x06, 0x09, 0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x01, 0x01, 0x01]);

  /** @private */
  static _key = sc.importKey('raw', TomoExtraData.AesCtrKeyBytes,
    { name: 'AES-CTR' }, false, ['decrypt', 'encrypt']);

  static decrypt = async (/** @type {Uint8Array<ArrayBuffer>} */ data,
    /** @type {AesCtrParams["counter"]} */ iv) =>
    new Uint8Array(await sc.decrypt(
      { name: 'AES-CTR', counter: iv, length: 128 },
      await TomoExtraData._key, data));

  static encrypt = async (/** @type {BufferSource} */ data,
    /** @type {Uint8Array<ArrayBuffer>} */ iv) => ({
    iv, encrypted: new Uint8Array(await sc.encrypt({ name: 'AES-CTR', counter: iv, length: 128 },
      await TomoExtraData._key, data))
  });

  /**
   * Encrypts and appends extra data using AES-CTR and CRC-32
   * at the end of the wrapped StoreData for use in a QR code
   * for Tomodachi Life/Miitomo/Miitopia.
   *
   * The input `encryptedBytes` must already be encrypted and
   * fit the extra data + 4 (CRC-32) + 16 (IV).
   * @param {Uint8Array<ArrayBuffer>} encryptedBytes - The wrapped StoreData,
   * which the extra data will be appended at the end of.
   * @param {Uint8Array} extraData - The extra data.
   */
  static async encryptToWrappedData(encryptedBytes, extraData) {
    encryptedBytes.set(extraData, WrappedMiiDataLength); // Append decrypted extra data.
    // Calculate CRC-32 from ENCRYPTED/wrapped data + DECRYPTED extra data.
    const lenForCrc = WrappedMiiDataLength + extraData.length;
    // console.debug('data into crc32:', bytesToHexSpaced(dataForCrc));
    const crc = crc32(encryptedBytes, lenForCrc);
    // const crcBytes = [crc & 0xff, (crc >> 8) & 0xff, (crc >> 16) & 0xff, (crc >> 24) & 0xff];
    // console.debug('crc32: ', bytesToHexSpaced(crcBytes));

    // Write CRC-32 as an unsigned 32-bit little-endian integer.
    const totalOffsetCrc = WrappedMiiDataLength + extraData.length;
    new DataView(encryptedBytes.buffer).setUint32(totalOffsetCrc, crc, true);
    // new DataView(extraWithCrc.buffer).setUint32(extraData.length, crc, true);
    const extraWithCrc = encryptedBytes.subarray(
      WrappedMiiDataLength, totalOffsetCrc + 4);

    /** Deterministic IV used instead of a random one for encryption. */
    const determinedIv = new Uint8Array(16);
    // const determinedIv = new Uint32Array([crc, crc, crc, crc]).buffer);
    // Get randomly generated IV and ciphertext as a new buffer.
    const { encrypted: encryptedExtra, iv } =
      await TomoExtraData.encrypt(extraWithCrc, determinedIv);

    // Copy the IV first, then the encrypted data, after the main QR data.
    encryptedBytes.set(iv, WrappedMiiDataLength);
    encryptedBytes.set(encryptedExtra, WrappedMiiDataLength + 16); // 16 = IV length.
  }

  /**
   * Decodes extra data in the QR code (must be present) and displays in the hex editor.
   * @param {Uint8Array<ArrayBuffer>} encryptedBytes - The encrypted QR code data.
   * @returns {Promise<Uint8Array<ArrayBuffer>|null>} The extra data present,
   * or null if it's either not present or verification failed.
   */
  static async decryptFromWrappedData(encryptedBytes) {
    const ivOffset = WrappedMiiDataLength + 16;
    /** Take the 128 bit IV. */
    const iv = encryptedBytes.subarray(WrappedMiiDataLength, ivOffset);
    /** This is the full ciphertext. Last 4 bytes are the CRC-32. */
    const encryptedExtra = encryptedBytes.subarray(ivOffset);

    const decryptedExtra = await TomoExtraData.decrypt(encryptedExtra, iv);
    // If decryption succeeded, slice off the CRC-32 in the data and load that.
    const CRC32_SIZE = 4;
    const decryptedExtraData = decryptedExtra.subarray(0, -CRC32_SIZE);

    const crcOffset = decryptedExtra.length - CRC32_SIZE;
    /** Actual CRC-32 in the data. */
    const crcActual = new DataView(decryptedExtra.buffer).getUint32(crcOffset, true);

    // Verify the CRC-32 checksum, which verifies against the
    // encrypted (wrapped) StoreData with the decrypted extra data.

    // Copy encryptedBytes array and set decrypted extra data within it.
    const encryptedForCrc = new Uint8Array(encryptedBytes);
    encryptedForCrc.set(decryptedExtraData, WrappedMiiDataLength);
    const offsetForCrc = WrappedMiiDataLength + decryptedExtraData.length;
    const dataForCrc = encryptedForCrc.subarray(0, offsetForCrc);
    /** Calculated CRC-32 from the real data. */
    const crcExpected = crc32(dataForCrc);
    if (crcExpected !== crcActual) {
      return null;
    }

    // CRC matches, load into output.
    return decryptedExtraData;
  }

  /**
   * @param {number} length - The length of the extra data.
   * @returns {string} A generic name that can be used in a filename to describe the extra data.
   */
  static getDataName(length) {
    switch (length) {
      case 40:
        return 'miitomo-data';
      case 240:
        return 'tomodachi-life-data';
      case 192:
        return 'miitopia-data';
      default:
        return 'data';
    }
  }

  static hasExtra(/** @type {number} */ encryptedLength) {
    const extraLength = encryptedLength - WrappedMiiDataLength - 16 - 4;
    // return extraLength > 0;
    return TomoExtraData.getDataName(extraLength) !== 'data';
  }
}

export default TomoExtraData;
