/**
 * @file ExtraData.js
 * @author Arian Kordi <https://github.com/ariankordi>
 * @license Zlib
 * Encrypts/decrypts the extra data that some Mii QR codes carry after the
 * 112-byte wrapped StoreData:
 * - {@link TomoExtraData}: Tomodachi Life 3DS, Miitomo, and Miitopia 3DS.
 * - {@link OunceMiiExtraData}: Switch 2.
 *
 * Both take the whole QR code payload rather than just the extra data,
 * because both bind the extra data to the wrapped StoreData before it:
 * the Tomo CRC-32 covers it, and the Switch 2 nonce is its first 8 bytes.
 */
// @ts-check

import { WrappedMiiDataLength } from './WrappedMiiData.js';
/** @import AesCcmSubtle from './AesCcmSubtle.js' */

const sc = globalThis.crypto.subtle;

// // ---------------------------------------------------------------------
// //  Tomodachi Life, Miitomo, Miitopia: AES-CTR and CRC-32
// // ---------------------------------------------------------------------

class Crc32Posix {
  constructor() {
    /** @private */ this._table = new Uint32Array(256);

    // Create table for CRC-32/POSIX/CKSUM using its polynomial value.
    const poly = 0x04C11DB7;
    for (let i = 0; i < 256; i++) {
      let crc = i << 24;
      for (let j = 0; j < 8; j++) {
        crc = crc & 0x80000000
          ? (crc << 1) ^ poly
          : crc << 1;
      }
      this._table[i] = crc >>> 0;
    }
  }

  /** @private */ _table;

  /**
   * Calculates a checksum of `data` using CRC-32/POSIX/CKSUM.
   * @param {ArrayLike<number>} input - The data to create a checksum of.
   * @param {number} length - The amount of bytes in `input` to calculate.
   * @returns {number} The CRC-32 checksum.
   */
  calculate(input, length = input.length) {
    let crc = 0x00000000;
    for (let i = 0; i < length; i++) {
      const byte = (input[i] ^ (crc >>> 24)) & 0xFF;
      crc = (this._table[byte] ^ (crc << 8)) >>> 0;
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
}

/**
 * Extra data used by Tomodachi Life, Miitomo, and Miitopia (3DS).
 * Layout after the wrapped StoreData: a 16-byte IV, then AES-CTR ciphertext
 * of the extra data followed by a little-endian CRC-32.
 * The CRC-32 covers the wrapped (encrypted) StoreData followed by the plaintext extra data.
 */
class TomoExtraData {
  static IvLength = 16;
  static CrcLength = 4;

  /** @param {Uint8Array<ArrayBuffer>} key - The 16-byte AES-CTR key. */
  constructor(key) {
    /** @private */ this._key = sc.importKey('raw', key,
      { name: 'AES-CTR' }, false, ['decrypt', 'encrypt']);
    /** @private */ this._crc32 = new Crc32Posix();
  }

  /**
   * @param {number} extraDataLength - Length of the plaintext extra data.
   * @returns {number} Bytes the extra data takes up after the wrapped StoreData.
   */
  static getEncodedLength = extraDataLength =>
    TomoExtraData.IvLength + extraDataLength + TomoExtraData.CrcLength;

  /**
   * Encrypts extra data and writes it after the wrapped StoreData.
   * @param {Uint8Array<ArrayBuffer>} qrBytes - The QR code payload, with the wrapped
   * StoreData already written. Must be {@link WrappedMiiDataLength} plus
   * {@link TomoExtraData.getEncodedLength} bytes long.
   * @param {Uint8Array} extraData - The extra data to encrypt. It is not modified.
   * @returns {Promise<void>}
   * @throws {Error} Throws if `qrBytes` is too small for the extra data.
   */
  async encryptToWrappedData(qrBytes, extraData) {
    const { IvLength, CrcLength } = TomoExtraData;
    const encodedLength = WrappedMiiDataLength + TomoExtraData.getEncodedLength(extraData.length);
    if (qrBytes.length < encodedLength) {
      throw new Error(`QR code buffer is ${qrBytes.length} bytes, expected ${encodedLength} or more.`);
    }

    // Put the plaintext right after the wrapped StoreData, so the CRC-32 can
    // be taken over both in place, then append the CRC-32 after it.
    const crcOffset = WrappedMiiDataLength + extraData.length;
    qrBytes.set(extraData, WrappedMiiDataLength);
    const crc = this._crc32.calculate(qrBytes, crcOffset);
    new DataView(qrBytes.buffer, qrBytes.byteOffset).setUint32(crcOffset, crc, true);

    /** Deterministic IV used instead of a random one, so the same input gives the same code. */
    const iv = new Uint8Array(IvLength);
    const cipherText = new Uint8Array(await sc.encrypt({ name: 'AES-CTR', counter: iv, length: 128 },
      await this._key, qrBytes.subarray(WrappedMiiDataLength, crcOffset + CrcLength)));

    // The IV comes first, which overwrites the plaintext.
    qrBytes.set(iv, WrappedMiiDataLength);
    qrBytes.set(cipherText, WrappedMiiDataLength + IvLength);
  }

  /**
   * Decrypts the extra data after the wrapped StoreData.
   * @param {Uint8Array<ArrayBuffer>} qrBytes - The whole QR code payload.
   * @returns {Promise<Uint8Array<ArrayBuffer>|null>} The extra data, or null
   * if the payload is too short or the CRC-32 does not match.
   */
  async decryptFromWrappedData(qrBytes) {
    const { IvLength, CrcLength } = TomoExtraData;
    const ivEndOffset = WrappedMiiDataLength + IvLength;
    if (qrBytes.length < ivEndOffset + CrcLength) {
      return null;
    }

    const iv = qrBytes.subarray(WrappedMiiDataLength, ivEndOffset);
    const decrypted = new Uint8Array(await sc.decrypt({ name: 'AES-CTR', counter: iv, length: 128 },
      await this._key, qrBytes.subarray(ivEndOffset)));

    const extraDataLength = decrypted.length - CrcLength;
    const extraData = decrypted.slice(0, extraDataLength);
    const crcActual = new DataView(decrypted.buffer).getUint32(extraDataLength, true);

    // The CRC-32 covers the wrapped StoreData followed by the plaintext extra data.
    const crcInput = new Uint8Array(WrappedMiiDataLength + extraDataLength);
    crcInput.set(qrBytes.subarray(0, WrappedMiiDataLength));
    crcInput.set(extraData, WrappedMiiDataLength);
    return this._crc32.calculate(crcInput) === crcActual ? extraData : null;
  }
}

// // ---------------------------------------------------------------------
// //  Switch 2: AES-CCM
// // ---------------------------------------------------------------------

/**
 * Extra data written by the Switch 2 Mii QR code feature.
 * This was included in the sdb (IDatabaseService) module on 23.0.0.
 */
class OunceMiiExtraData {
  /** Length of the extra data structure. */
  static StructLength = 10;
  /** Offset of the part of the structure that is encrypted. */
  static EncryptedStructOffset = 1;
  /** Length of the AES-CCM plaintext: the encrypted part of the structure plus zero padding. */
  static PlaintextLength = 15;
  static TagLength = 16;
  /** Length of everything after the wrapped StoreData, which is 32 bytes. */
  static EncodedLength = 1 + OunceMiiExtraData.PlaintextLength + OunceMiiExtraData.TagLength;
  /** Length of the ID at the start of the wrapped StoreData used as the nonce. */
  static IdLength = 8;
  static NonceLength = 12;

  /** @param {AesCcmSubtle} cipher - AES-CCM cipher set up with the Switch 2 extra data key. */
  constructor(cipher) {
    /** @private */ this._cipher = cipher;
  }

  /**
   * Makes the AES-CCM nonce from the ID at the start of the wrapped StoreData.
   * @param {Uint8Array} qrBytes - Data starting with the wrapped StoreData.
   * @returns {Uint8Array<ArrayBuffer>} The 12-byte nonce.
   * @private
   */
  static _makeNonce(qrBytes) {
    const nonce = new Uint8Array(OunceMiiExtraData.NonceLength);
    nonce.set(qrBytes.subarray(0, OunceMiiExtraData.IdLength));
    return nonce;
  }

  /**
   * Encrypts the extra data structure and writes it after the wrapped StoreData.
   * @param {Uint8Array} qrBytes - The QR code payload, with the wrapped StoreData
   * already written. Must be {@link WrappedMiiDataLength} plus
   * {@link OunceMiiExtraData.EncodedLength} bytes long.
   * @param {Uint8Array} extraData - The 10-byte structure. It is not modified.
   * @returns {Promise<void>}
   * @throws {Error} Throws if the structure is not exactly
   * {@link OunceMiiExtraData.StructLength} bytes, or `qrBytes` is too small.
   */
  async encryptToWrappedData(qrBytes, extraData) {
    const { StructLength, EncryptedStructOffset, PlaintextLength, TagLength, EncodedLength } =
      OunceMiiExtraData;
    if (extraData.length !== StructLength) {
      throw new Error(`Ounce extra data must be exactly ${StructLength} bytes, got ${extraData.length}.`);
    }
    if (qrBytes.length < WrappedMiiDataLength + EncodedLength) {
      throw new Error(`QR code buffer is ${qrBytes.length} bytes, expected ${WrappedMiiDataLength + EncodedLength} or more.`);
    }

    const plaintext = new Uint8Array(PlaintextLength);
    plaintext.set(extraData.subarray(EncryptedStructOffset)); // The rest is zero padding.
    const sealed = await this._cipher.encrypt(plaintext,
      OunceMiiExtraData._makeNonce(qrBytes), TagLength);

    // The first byte of the structure is stored as-is, before the ciphertext and tag.
    qrBytes.set(extraData.subarray(0, EncryptedStructOffset), WrappedMiiDataLength);
    qrBytes.set(sealed, WrappedMiiDataLength + EncryptedStructOffset);
  }

  /**
   * Decrypts and verifies the extra data structure after the wrapped StoreData.
   * @param {Uint8Array<ArrayBuffer>} qrBytes - The whole QR code payload.
   * @returns {Promise<Uint8Array<ArrayBuffer>|null>} The 10-byte structure,
   * or null if the length is wrong or the tag does not match.
   */
  async decryptFromWrappedData(qrBytes) {
    const { StructLength, EncryptedStructOffset, TagLength, EncodedLength } = OunceMiiExtraData;
    if (qrBytes.length !== WrappedMiiDataLength + EncodedLength) {
      return null;
    }

    const sealedOffset = WrappedMiiDataLength + EncryptedStructOffset;
    const plaintext = await this._cipher.decrypt(qrBytes.subarray(sealedOffset),
      OunceMiiExtraData._makeNonce(qrBytes), TagLength);
    if (!plaintext) {
      return null;
    }

    const encryptedStructLength = StructLength - EncryptedStructOffset;

    // Allocate the buffer for the extra data structure and return it.
    const extraData = new Uint8Array(StructLength);
    extraData.set(qrBytes.subarray(WrappedMiiDataLength, sealedOffset));
    extraData.set(plaintext.subarray(0, encryptedStructLength), EncryptedStructOffset);
    return extraData;
  }
}

export {
  TomoExtraData,
  OunceMiiExtraData
};
