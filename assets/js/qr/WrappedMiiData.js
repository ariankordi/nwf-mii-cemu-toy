/**
 * @file WrappedMiiData.js
 * @author Arian Kordi <https://github.com/ariankordi>
 * @license Zlib
 * Implementation for "WrappedStoreData", aka the encryption used
 * in Mii QR codes (among other uses on the 3DS), in JavaScript.
 * Uses {@link AesCcmSubtle} for AES-CCM.
 *
 * References (Credits: 3DBrew contributors, jaames, kazuki-4ys):
 * - https://www.3dbrew.org/wiki/Mii_Maker#Mii_QR_Code_format
 * - (Only decryption) https://gist.github.com/jaames/96ce8daa11b61b758b6b0227b55f9f78
 * - https://github.com/kazuki-4ys/kazuki-4ys.github.io/blob/148dc339974f8b7515bfdc1395ec1fc9becb68ab/web_apps/MiiInfoEditorCTR/encode.js#L57, encryption: https://github.com/kazuki-4ys/kazuki-4ys.github.io/blob/148dc339974f8b7515bfdc1395ec1fc9becb68ab/web_apps/MiiInfoEditorCTR/encode.js#L46
 * - CFL: void CFLi_UnwrapMiiData(CFLiMiiDataPacket* packetData, CFLiWrappedMiiData* wrappedData);
 * -> nn::applet::CTR::detail::Unwrap(packetData, wrappedData, 0x70, 0xc, 10);
 * -> nn::ps::UnwrapMii(void* pMiiBuffer, const void* pWrapped, size_t wrappedSize, s32 idOffset, size_t idSize);
 * - CFL: void CFLi_WrapMiiData(CFLiWrappedMiiData* wrappedData, CFLiMiiDataPacket* packetData);
 * -> nn::applet::CTR::detail::Wrap(wrappedData,packetData, 0x60, 0xc, 10);
 * -> nn::ps::WrapMii(void* pWrappedBuffer, const void* pMii, size_t miiSize, s32 idOffset, size_t idSize);
 * (> ctr.7z: ctr/sources/libraries/ps/CTR/ps_Util.cpp)
 * - FFL: FFLResult FFLiUnwrapStoreData(FFLiStoreDataCFL*, const FFLiWrappedStoreData*);
 * -> ACPMiiUnwrap(pStoreDataCFL, FFL_MIIDATA_PACKET_SIZE, pWrappedStoreData, FFLI_WRAPPEDSTOREDATA_SIZE);
 * - FFL: FFLResult FFLiWrapStoreData(FFLiWrappedStoreData*, const FFLiStoreDataCFL*);
 * -> ACPMiiWrap(pWrappedStoreData, FFLI_WRAPPEDSTOREDATA_SIZE, pWrappedStoreData, FFL_MIIDATA_PACKET_SIZE);
 */
// @ts-check

/** Size of encrypted Mii data found in QR codes (CFLiWrappedMiiData, FFLiWrappedStoreData) */
const WrappedMiiDataLength = 112; // 0x70

class WrappedMiiData {
  /**
   * Size of 3DS/Wii U format Mii data, referred to as:
   * FFLStoreData, CFLiMiiDataPacket, nn::mii::Ver3StoreData
   * @package
   */
  static StoreDataLength = 96; // 0x60

  /** Offset of the create ID within the StoreData. */
  static IdOffset = 12;
  /** Length of the ID used as the nonce: `(sizeof(FFLCreateID) = 10) & ~3` */
  static IdLength = 8;
  /** AES-CCM nonce length, to which the ID is zero-padded. */
  static NonceLength = 12;
  static TagLength = 16;
  /** Amount of ciphertext stored (88 bytes), equaling StoreData without the ID. */
  static CipherTextLength = WrappedMiiData.StoreDataLength - WrappedMiiData.IdLength;

  /**
   * @class
   * @param {import('./AesCcmSubtle.js').default} cipher - AES-CCM cipher set up with the key for wrapped
   * Mii data/QR codes. On the 3DS this is the "slot 0x31" normal key (keyN).
   * https://www.3dbrew.org/wiki/PSPXI:EncryptDecryptAes#Key_Types
   */
  constructor(cipher) {
    /** @private */ this._cipher = cipher;
  }

  /** Makes the zero-padded AES-CCM nonce from the ID. @private */
  static _makeNonce(/** @type {Uint8Array} */ wrappedId) {
    const nonce = new Uint8Array(WrappedMiiData.NonceLength);
    nonce.set(wrappedId);
    return nonce;
  }

  /**
   * Gets 96 byte 3DS/Wii U format Mii data from AES-CCM encrypted data (in QR codes).
   * @param {Uint8Array} dst - Destination to write the decrypted StoreData to.
   * Expected size is {@link WrappedMiiData.StoreDataLength}.
   * @param {Uint8Array<ArrayBuffer>} encryptedData - Encrypted/"wrapped" Mii QR code data (CFLiWrappedMiiData).
   * @returns {Promise<boolean>} Whether the AES-CCM tag matched.
   * @throws {Error} Throws if the input data is shorter than {@link WrappedMiiDataLength}.
   */
  async decrypt(dst, encryptedData) {
    const { IdOffset, IdLength, TagLength, StoreDataLength } = WrappedMiiData;

    if (encryptedData.length < WrappedMiiDataLength) { // Verify length.
      throw new Error(`Input size is ${encryptedData.length}, expected ${WrappedMiiDataLength} or longer.`);
    }

    const wrappedId = encryptedData.subarray(0, IdLength);
    const cipherText = encryptedData.subarray(IdLength, StoreDataLength);
    const tag = encryptedData.subarray(StoreDataLength, WrappedMiiDataLength);
    const nonce = WrappedMiiData._makeNonce(wrappedId);

    // Decrypt the 88 stored bytes.
    const decrypted = await this._cipher.decryptSkipTag(cipherText, nonce);

    let difference = 0;
    // Pad the 88 byte buffer to 96 bytes for re-encryption.
    {
      const content = new Uint8Array(StoreDataLength);
      content.set(decrypted);
      const resealed = await this._cipher.encrypt(content, nonce, TagLength);
      // Validate that the tag after encryption is the same as what's stored.
      for (let i = 0; i < TagLength; i++) {
        difference |= resealed[StoreDataLength + i] ^ tag[i];
      }
    }

    if (difference !== 0) {
      return false; // Stored tag does not match.
    }

    // Create the final StoreData by putting the ID back.
    dst.set(decrypted.subarray(0, IdOffset));
    dst.set(wrappedId, IdOffset);
    dst.set(decrypted.subarray(IdOffset), IdOffset + IdLength);
    return true;
  }

  /**
   * Encrypts 96 byte 3DS/Wii U format Mii data in AES-CCM,
   * aka CFLiWrappedMiiData, for use in a Mii QR code.
   * @param {Uint8Array} dst - Destination to write the encrypted/"wrapped" Mii QR code data (CFLiWrappedMiiData) to.
   * Expected size is {@link WrappedMiiDataLength} or more.
   * @param {Uint8Array} storeData - Input StoreData to encrypt.
   * @returns {Promise<void>}
   * @throws {Error} Throws if the input data size doesn't match {@link WrappedMiiData.StoreDataLength}.
   */
  async encrypt(dst, storeData) {
    const { IdOffset, IdLength, TagLength, StoreDataLength, CipherTextLength } = WrappedMiiData;

    if (storeData.length !== StoreDataLength) { // Verify length.
      throw new Error(`Input size is ${storeData.length}, expected ${StoreDataLength} / 3DS/Wii U format Mii StoreData.`);
    }

    /** Offset after the ID ends. */
    const idEndOffset = IdOffset + IdLength;
    /** The ID to include in the encrypted data as the nonce (IV). */
    const wrappedId = storeData.subarray(IdOffset, idEndOffset);

    /** The content to be encrypted: the data with the ID cut out, padded back to 96 bytes. */
    const content = new Uint8Array(StoreDataLength);
    content.set(storeData.subarray(0, IdOffset)); // Copy until the ID.
    content.set(storeData.subarray(idEndOffset), IdOffset); // Copy after the ID.
    // This leaves 8 bytes of padding.

    const nonce = WrappedMiiData._makeNonce(wrappedId);
    const sealed = await this._cipher.encrypt(content, nonce, TagLength);

    dst.set(wrappedId); // Set nonce from the original data.
    // Store only the first 88 bytes of ciphertext, dropping the padding.
    dst.set(sealed.subarray(0, CipherTextLength), IdLength);
    dst.set(sealed.subarray(StoreDataLength), StoreDataLength); // Tag after content + nonce.
  }
}

export {
  WrappedMiiDataLength,
  WrappedMiiData
};
