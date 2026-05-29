/**
 * @file WrappedMiiDataSjcl.js
 * @author Arian Kordi <https://github.com/ariankordi>
 * Implementation for "WrappedStoreData", aka the encryption used
 * in Mii QR codes (among other uses on the 3DS), in JavaScript.
 * Uses the Stanford Javascript Crypto Library: https://github.com/bitwiseshiftleft/sjcl
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

import sjcl from 'sjcl';

// @ts-expect-error - Untyped function needed to enable CTR mode.
sjcl.beware['CTR mode is dangerous because it doesn\'t protect message integrity.']();

/** Size of encrypted Mii data found in QR codes (CFLiWrappedMiiData, FFLiWrappedStoreData) */
const WrappedMiiDataLength = 112; // 0x70

class WrappedMiiDataSjcl {
  /**
   * Size of 3DS/Wii U format Mii data, referred to as:
   * FFLStoreData, CFLiMiiDataPacket, nn::mii::Ver3StoreData
   * @package
   */
  static StoreDataLength = 96; // 0x60

  /**
   * @class
   * @param {Uint8Array<ArrayBuffer>} key
   * The AES-128 key for wrapped Mii data/QR codes.
   * Also known as the "slot 0x31" normal key (keyN).
   * https://www.3dbrew.org/wiki/PSPXI:EncryptDecryptAes#Key_Types
   */
  constructor(key) {
    /** @private */ this._cipher = new sjcl.cipher.aes(
      // @ts-ignore -- Works with ArrayLike<number>.
      sjcl.codec.bytes.toBits(key)
    );
  }

  /**
   * Gets 96 byte 3DS/Wii U format Mii data from QR code data.
   * Decrypts the AES-CCM encrypted data (CFLiWrappedMiiData) from the QR code using sjcl.
   *
   * The default AES-CCM decryption function in sjcl fails to verify the tag (MAC)
   * due to the following errata: https://www.3dbrew.org/wiki/AES_Registers#CCM_mode_pitfall
   * In order to skip verification of the tag (MAC), a private function to
   * decrypt without verifying is used, obtained by {@link getSjclCcmCtrModeDecryptFunc}.
   *
   * @param {Uint8Array} dst - Destination to write the decrypted StoreData to.
   * Expected size is {@link StoreDataLength}.
   * @param {Uint8Array} encryptedData - Encrypted "wrapped" Mii QR code data (CFLiWrappedMiiData)
   * @returns {void}
   * @throws {Error} Throws if the input data's size doesn't match {@link WrappedMiiDataLength}.
   * @todo Need to implement verifying the tag (MAC) using the private _computeTag function:
   * https://github.com/bitwiseshiftleft/sjcl/blob/85caa53c281eeeb502310013312c775d35fe0867/core/ccm.js#L109
   * Until then, you MUST verify the CRC-16 of the output to ensure the data is valid.
   */
  decrypt(dst, encryptedData) {
    const NonceLength = 12;
    const TagLength = 16;
    const IdLength = 8; // = (sizeof(FFLCreateID) = 10) & ~3

    if (encryptedData.length < WrappedMiiDataLength) { // Verify length.
      throw new Error(`Input size is ${encryptedData.length}, expected ${WrappedMiiDataLength} or longer.`);
    }

    /** AES-CCM nonce (like an IV) initialized to zeroes. Usually 8 bytes padded to 12 bytes. */
    const nonce = new Uint8Array(NonceLength);
    nonce.set(encryptedData.subarray(0, IdLength)); // Extract the ID into the nonce.
    const encryptedContent = encryptedData.subarray(IdLength);

    // Convert encrypted content and nonce to sjcl.BitArray (toBits expects array).
    // @ts-ignore -- Works with Uint8Array.
    const encryptedBits = sjcl.codec.bytes.toBits(encryptedContent);

    // Isolate the actual ciphertext from the tag and adjust IV.
    // Copied from sjcl.mode.ccm.decrypt: https://github.com/bitwiseshiftleft/sjcl/blob/85caa53c281eeeb502310013312c775d35fe0867/core/ccm.js#L83
    const dataWithoutTag = sjcl.bitArray.clamp(encryptedBits,
      // remove tag from out, tag length = 128
      sjcl.bitArray.bitLength(encryptedBits) - (TagLength * 8));

    // CTR IV for counter=1 (data blocks start at counter 1 in CCM):
    //   [0x02, nonce8, 0x00,0x00,0x00,0x00, 0x00,0x00,0x01]
    const ctr1 = new Uint8Array(16);
    ctr1[0] = 0x02;
    ctr1.set(nonce, 1);
    ctr1[15] = 0x01;
    // bytes [13:16] = 0x000000 (counter = 0)
    // @ts-ignore -- Works with Uint8Array.
    const nonceBits = sjcl.codec.bytes.toBits(ctr1);

    const decryptedBits = sjcl.mode.ctr.decrypt(
      this._cipher, dataWithoutTag, nonceBits);
    // NOTE: The tag (CBC-MAC) within the encrypted data is NOT verified here.

    // Convert the decrypted bytes from sjcl.BitArray format.
    const decryptedArray = sjcl.codec.bytes.fromBits(decryptedBits);
    // Create a Uint8Array so that we can slice and copy from it.
    const decryptedBytes = new Uint8Array(decryptedArray)
      .subarray(0, WrappedMiiDataLength - IdLength);

    // Create the final Mii StoreData from the decrypted bytes.
    // const dst = new Uint8Array(encryptedData.length);
    dst.set(decryptedBytes.subarray(0, NonceLength)); // First 12 decrypted bytes.
    dst.set(nonce, NonceLength); // Original nonce from the encrypted bytes.
    // Copy the rest of the decrypted bytes.
    dst.set(decryptedBytes.subarray(NonceLength),
      NonceLength + IdLength);
  }

  /**
   * Encrypts 3DS/Wii U Mii data with AES-CCM (CFLiWrappedMiiData)
   * using sjcl for use in a Mii QR code.
   * @param {Uint8Array} dst - Destination to write the
   * encrypted QR code data (CFLiWrappedMiiData) to. Expected size is {@link WrappedMiiDataLength}.
   * @param {Uint8Array} storeData - Input 96 byte StoreData to encrypt.
   * @returns {void}
   * @throws {Error} Throws if the input data's size doesn't match {@link StoreDataLength}.
   */
  encrypt(dst, storeData) {
    const NonceLength = 12;
    const TagLength = 16;
    const IdOffset = 12;
    const IdLength = 8;

    if (storeData.length !== WrappedMiiDataSjcl.StoreDataLength) { // Verify length.
      throw new Error(`Input size is ${storeData.length}, expected ${WrappedMiiDataSjcl.StoreDataLength} / 3DS/Wii U format Mii StoreData.`);
    }

    /** Offset after the ID ends. */
    const idEndOffset = IdOffset + IdLength;
    /** The ID to include in the encrypted data as the nonce (IV). */
    const wrappedId = storeData.subarray(IdOffset, idEndOffset);

    /** The content to be encrypted. Consists of the data with the ID cut out, and with extra padding. */
    const content = new Uint8Array(
      // Size: 96-len(id) (= 88) + len(id) = 96
      WrappedMiiDataSjcl.StoreDataLength);
    content.set(storeData.subarray(0, IdOffset)); // Copy until the ID.
    content.set(storeData.subarray(idEndOffset), IdOffset); // Copy after the ID.
    // This leaves 8 bytes of padding.

    /** AES-CCM nonce (like an IV) initialized to zeroes. */
    const nonce = new Uint8Array(NonceLength);
    nonce.set(wrappedId); // Set the ID in the nonce, leaving extra padding.
    // @ts-ignore -- Works with Uint8Array.
    const nonceBits = sjcl.codec.bytes.toBits(nonce);
    // @ts-ignore -- Works with Uint8Array.
    const contentBits = sjcl.codec.bytes.toBits(content);

    const tlen = TagLength * 8;
    // Encrypt the padded StoreData with the ID cut out, using the ID as a nonce (IV).
    const encryptedBits = sjcl.mode.ccm.encrypt(
      this._cipher, contentBits, nonceBits, undefined, tlen);
    const encryptedBytes = new Uint8Array(sjcl.codec.bytes.fromBits(encryptedBits));

    // The encrypted bytes are padded and the tag is at the end.
    const contentLength =
      encryptedBytes.length - IdLength - TagLength;
    // The data is spliced to remove the extra padding in the middle.
    const encryptedContent = encryptedBytes.subarray(0, contentLength);
    const tag = encryptedBytes.subarray(encryptedBytes.length - TagLength);

    // const dst = new Uint8Array(WRAPPED_MII_DATA_LENGTH);
    dst.set(wrappedId); // Set nonce from the original data.
    dst.set(encryptedContent, IdLength); // Encrypted content.
    dst.set(tag, WrappedMiiDataSjcl.StoreDataLength); // Set tag after content + nonce.
  }
}

/** Tests {@link WrappedMiiDataSjcl} against known good data. */
/*
function wrappedStoreDataTest() {
  const testStoreData = new Uint8Array([
    0x03, 0x00, 0x23, 0x30, 0x64, 0x3F, 0xB0, 0xBD,
    0xC6, 0x1B, 0x29, 0x25, 0x9E, 0x5C, 0x08, 0x77,
    0x40, 0xF4, 0x07, 0x88, 0x05, 0x92, 0x00, 0x00,
    0x01, 0x20, 0x4D, 0x00, 0x69, 0x00, 0x79, 0x00,
    0x75, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x40, 0x40,
    0xA2, 0x90, 0x2E, 0x00, 0xDE, 0x66, 0x63, 0x1A,
    0x20, 0x34, 0x45, 0x18, 0x81, 0x14, 0x15, 0xC6,
    0x0E, 0x00, 0x00, 0x29, 0x00, 0x52, 0x48, 0x50,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x97, 0xE3
  ]);

  const wrappedStoreData = new Uint8Array([
    0x9e, 0x5c, 0x08, 0x77, 0x40, 0xf4, 0x07, 0x88,
    0x3f, 0x5d, 0xbe, 0xfe, 0x2e, 0x93, 0x79, 0x0d,
    0x62, 0x1b, 0xb7, 0xff, 0x7a, 0x01, 0x95, 0x52,
    0x34, 0xeb, 0xf7, 0x35, 0xa2, 0xf6, 0xf3, 0x3f,
    0xde, 0xc4, 0xbd, 0x18, 0x10, 0x6b, 0x73, 0x76,
    0x5d, 0xaa, 0xc5, 0x78, 0xf0, 0x7f, 0x2f, 0x94,
    0x2d, 0x3c, 0x5c, 0xdc, 0xcc, 0xea, 0x98, 0xa7,
    0x50, 0x57, 0x93, 0x16, 0x0d, 0x6d, 0x5d, 0xca,
    0x38, 0x66, 0x26, 0xc4, 0x3e, 0x48, 0xf3, 0xff,
    0x3c, 0xbb, 0xcf, 0x9a, 0xba, 0x3c, 0xe8, 0xf7,
    0xad, 0x98, 0x03, 0x0a, 0x68, 0xf6, 0x06, 0xdf,
    0x35, 0x4b, 0x0d, 0x46, 0x90, 0x38, 0xfa, 0xa3,
    0x04, 0x81, 0x8e, 0x8a, 0x29, 0xa2, 0x7e, 0x00,
    0x85, 0x49, 0xbf, 0x46, 0xd3, 0xdd, 0xbd, 0x58
  ]);

  // Expected test data is using null key (all zeroes).
  const crypt = new WrappedMiiDataSjcl(new Uint8Array(16));

  // encode test
  const wrapped = new Uint8Array(WrappedMiiDataLength);
  crypt.encrypt(wrapped, testStoreData);

  for (let i = 0; i < wrappedStoreData.length; i++) {
    if (wrappedStoreData[i] !== wrapped[i]) {
      console.error('mismatch:', wrappedStoreData, wrapped);
      return;
    }
  }

  // decode test
  const storeData = new Uint8Array(WrappedMiiDataSjcl.StoreDataLength);
  crypt.decrypt(storeData, wrapped);

  for (let i = 0; i < testStoreData.length; i++) {
    if (testStoreData[i] !== storeData[i]) {
      console.error('mismatch:', testStoreData, storeData);
      return;
    }
  }

  console.info('wrappedStoreDataTest: ✅ passed (en/de)code');
}

if (globalThis.process !== undefined) {
  wrappedStoreDataTest();
}
*/

export {
  WrappedMiiDataLength,
  WrappedMiiDataSjcl
};
