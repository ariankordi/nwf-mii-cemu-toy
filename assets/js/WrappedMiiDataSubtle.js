/**
 * @file WrappedMiiDataSubtle.js
 * @author Arian Kordi <https://github.com/ariankordi>
 * Implementation for "WrappedStoreData", aka the encryption used
 * in Mii QR codes (among other uses on the 3DS), in JavaScript.
 * Uses SubtleCrypto Web API (async-only :/)
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

const sc = globalThis.crypto.subtle;

// ---------------------------------------------------------------------------
// CCM building blocks
// ---------------------------------------------------------------------------

/**
 * Computes the AES-CCM CBC-MAC for Mii wrapped data.
 *
 * Formatted input to CBC-MAC = B_0 (16 bytes) | content (96 bytes) = 112 bytes.
 *
 * B_0 layout (RFC 3610 §2.2, flags formula from sjcl core/ccm.js _computeTag):
 *   byte 0  : flags = (Adata?64:0) | ((tlen/8 - 2)/2 << 3) | (L - 1)
 *             = 0 | ((16-2)/2 << 3) | (3-1) = 0 | (7<<3) | 2 = 0x3A
 *   bytes 1-12 : nonce12
 *   bytes 13-15: message length in L=3 bytes big-endian
 *             content is always 96 = 0x000060 for Mii data
 *
 * SubtleCrypto AES-CBC always appends a PKCS7 padding block, so:
 *   encrypt(key, iv=0, 112-byte input) → 128-byte output
 *   CBC-MAC = output[96:112]  (7th block; the 8th block is the PKCS7 tail, ignored)
 *
 * @param {CryptoKey} cryptoKey  16-byte AES key
 * @param {Uint8Array} nonce12   12-byte nonce (nonce8 zero-padded)
 * @param {Uint8Array} content96 96-byte CCM plaintext (storeData with ID spliced out)
 * @returns {Promise<Uint8Array>} 16-byte CBC-MAC
 */
async function computeCcmCbcMac(cryptoKey, nonce12, content96) {
  // B_0 block
  const b0 = new Uint8Array(16);
  b0[0] = 0x3A; // flags: no AAD | M'=7 | L'=2  (see above)
  b0.set(nonce12, 1);
  // message length = 96 = 0x000060, big-endian in L=3 bytes at bytes [13:16]
  b0[13] = 0x00;
  b0[14] = 0x00;
  b0[15] = 0x60;

  // Formatted input: B_0 | content (112 bytes, 7 AES blocks)
  const cbcInput = new Uint8Array(WrappedMiiDataLength);
  cbcInput.set(b0);
  cbcInput.set(content96, 16);

  // Encrypt with zero IV; PKCS7 makes output 128 bytes.
  // CBC-MAC is at output[96:112] (block 7, just before the PKCS7 padding block).
  const out = new Uint8Array(await sc.encrypt(
    { name: 'AES-CBC', iv: new Uint8Array(16) },
    cryptoKey,
    cbcInput
  ));

  return out.slice(96, WrappedMiiDataLength);
}

/**
 * Computes S_0: the CCM keystream block for counter = 0.
 * The CCM tag is encrypted as: stored_tag = CBC_MAC XOR S_0.
 *
 * Counter-0 block format (same flags as CTR data blocks, counter=0):
 *   [0x02, nonce12, 0x00, 0x00, 0x00]
 *
 * We get S_0 by CTR-encrypting 16 zero bytes at counter 0
 * (AES-CTR of zeros = keystream).
 *
 * @param {CryptoKey} cryptoKey
 * @param {Uint8Array} nonce12  12-byte nonce
 * @returns {Promise<Uint8Array>} 16-byte S_0 keystream block
 */
async function computeCcmS0(cryptoKey, nonce12) {
  const ctr0 = new Uint8Array(16);
  ctr0[0] = 0x02; // flags = L-1 = 2
  ctr0.set(nonce12, 1); // nonce at bytes [1:13]
  // bytes [13:16] = 0x000000 (counter = 0)

  const s0buf = await sc.encrypt(
    { name: 'AES-CTR', counter: ctr0, length: 24 },
    cryptoKey,
    new Uint8Array(16) // encrypt zeros -> keystream
  );
  return new Uint8Array(s0buf);
}

class WrappedMiiDataSubtle {
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
    /** @private */ this._ctrKey = sc.importKey('raw', key,
      { name: 'AES-CTR' }, false, ['encrypt', 'decrypt']);
    /** @private */ this._cbcKey = sc.importKey('raw', key,
      { name: 'AES-CBC' }, false, ['encrypt', 'decrypt']);
  }

  /**
   * Gets 96 byte 3DS/Wii U format Mii data from QR code data.
   * Decrypts the AES-CCM encrypted data (CFLiWrappedMiiData) from the QR code.
   * @param {Uint8Array} dst - Destination to write the decrypted StoreData to.
   * Expected size is {@link StoreDataLength}.
   * @param {Uint8Array<ArrayBuffer>} encryptedData - Encrypted "wrapped" Mii QR code data (CFLiWrappedMiiData)
   * @returns {Promise<boolean>}
   * @throws {Error} Throws if the input data's size doesn't match {@link WrappedMiiDataLength}.
   */
  async decrypt(dst, encryptedData) {
    const NonceLength = 12;
    const TagLength = 16;
    const IdLength = 8; // = (sizeof(FFLCreateID) = 10) & ~3

    if (encryptedData.length < WrappedMiiDataLength) { // Verify length.
      throw new Error(`Input size is ${encryptedData.length}, expected ${WrappedMiiDataLength} or longer.`);
    }

    const wrappedId = encryptedData.subarray(0, IdLength);
    const cipherText = encryptedData.subarray(
      IdLength, WrappedMiiDataSubtle.StoreDataLength);
    const storedTag = encryptedData.subarray(
      WrappedMiiDataLength - TagLength, WrappedMiiDataLength); // 16-byte CCM tag

    // CTR-decrypt the 88 ciphertext bytes (counter starts at 1 for data)
    const ctr1 = new Uint8Array(16);
    ctr1[0] = 0x02;
    ctr1.set(wrappedId, 1);
    ctr1[15] = 0x01;

    const key = await this._ctrKey;
    const dec = new Uint8Array(await sc.decrypt(
      { name: 'AES-CTR', counter: ctr1, length: 24 },
      key, cipherText
    )); // 88 bytes of plaintext

    // Reconstruct content96 for CBC-MAC:
    //   dec[0:88] | 0x00*8  (the 8 tail zeros were always plaintext zeros — see file header)
    const content96 = new Uint8Array(WrappedMiiDataSubtle.StoreDataLength);
    content96.set(dec); // last 8 bytes remain zero

    /** AES-CCM nonce (like an IV) initialized to zeroes. Usually 8 bytes padded to 12 bytes. */
    const nonce12 = new Uint8Array(NonceLength);
    nonce12.set(wrappedId);

    const mac = await computeCcmCbcMac(await this._cbcKey, nonce12, content96);
    const s0 = await computeCcmS0(key, nonce12);
    const expectedTag = new Uint8Array(TagLength);
    for (let i = 0; i < TagLength; i++) {
      expectedTag[i] = mac[i] ^ s0[i];

      // Verify if the tag matches.
      if (expectedTag[i] !== storedTag[i]) {
        return false;
      }
    }

    // Create the final Mii StoreData from the decrypted bytes.
    // const dst = new Uint8Array(encryptedData.length);
    dst.set(dec.subarray(0, NonceLength)); // First 12 decrypted bytes.
    dst.set(nonce12, NonceLength); // Original nonce from the encrypted bytes.
    // Copy the rest of the decrypted bytes.
    dst.set(dec.subarray(NonceLength),
      NonceLength + IdLength);

    return true;
  }

  /**
   * Encrypts 3DS/Wii U Mii data with AES-CCM
   * (CFLiWrappedMiiData) for use in a Mii QR code.
   * @param {Uint8Array} dst - Destination to write the
   * encrypted QR code data (CFLiWrappedMiiData) to. Expected size is {@link WrappedMiiDataLength}.
   * @param {Uint8Array} storeData - Input 96 byte StoreData to encrypt.
   * @returns {Promise<void>}
   * @throws {Error} Throws if the input data's size doesn't match {@link StoreDataLength}.
   */
  async encrypt(dst, storeData) {
    const NonceLength = 12;
    const TagLength = 16;
    const IdOffset = 12;
    const IdLength = 8;

    if (storeData.length !== WrappedMiiDataSubtle.StoreDataLength) { // Verify length.
      throw new Error(`Input size is ${storeData.length}, expected ${WrappedMiiDataSubtle.StoreDataLength} / 3DS/Wii U format Mii StoreData.`);
    }

    /** Offset after the ID ends. */
    const idEndOffset = IdOffset + IdLength;
    /** The ID to include in the encrypted data as the nonce (IV). */
    const wrappedId = storeData.subarray(IdOffset, idEndOffset);

    /** The content to be encrypted. Consists of the data with the ID cut out, and with extra padding. */
    const content96 = new Uint8Array(
      // Size: 96-len(id) (= 88) + len(id) = 96
      WrappedMiiDataSubtle.StoreDataLength);
    content96.set(storeData.subarray(0, IdOffset)); // Copy until the ID.
    content96.set(storeData.subarray(idEndOffset), IdOffset); // Copy after the ID.
    // This leaves 8 bytes of padding.

    /** AES-CCM nonce (like an IV) initialized to zeroes. */
    const nonce12 = new Uint8Array(NonceLength);
    nonce12.set(wrappedId); // Set the ID in the nonce, leaving extra padding.

    const key = await this._ctrKey;
    // Compute CBC-MAC as the tag.
    const mac = await computeCcmCbcMac(await this._cbcKey, nonce12, content96);
    const s0 = await computeCcmS0(key, nonce12);
    const tag = new Uint8Array(TagLength);
    for (let i = 0; i < TagLength; i++) {
      tag[i] = mac[i] ^ s0[i];
    }

    // CTR-encrypt the first 88 bytes of content96 (counter starting at 1)
    // (The last 8 bytes are zeros, their ciphertext is dropped — see file header)
    const ctr1 = new Uint8Array(16);
    ctr1[0] = 0x02;
    ctr1.set(wrappedId, 1);
    ctr1[15] = 0x01;

    const cipherTextSize = WrappedMiiDataSubtle.StoreDataLength - IdLength;
    // Encrypt the padded StoreData with the ID cut out, using the ID as a nonce (IV).
    const cipherText = new Uint8Array(await sc.encrypt(
      { name: 'AES-CTR', counter: ctr1, length: 24 },
      key, content96.subarray(0, cipherTextSize)
    ));

    // const dst = new Uint8Array(WRAPPED_MII_DATA_LENGTH);
    dst.set(wrappedId); // Set nonce from the original data.
    dst.set(cipherText, IdLength); // Encrypted content.
    dst.set(tag, WrappedMiiDataSubtle.StoreDataLength); // Set tag after content + nonce.
  }
}

/** Tests {@link WrappedMiiDataSubtle} against known good data. */
async function wrappedStoreDataTest() {
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
  const crypt = new WrappedMiiDataSubtle(new Uint8Array(16));

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
  const storeData = new Uint8Array(WrappedMiiDataSubtle.StoreDataLength);
  crypt.decrypt(storeData, wrapped);

  for (let i = 0; i < testStoreData.length; i++) {
    if (testStoreData[i] !== storeData[i]) {
      console.error('mismatch:', testStoreData, storeData);
      return;
    }
  }

  console.info('wrappedStoreDataTest: ✅ passed (en/de)code');
}

// (globalThis.process !== undefined) && wrappedStoreDataTest();

export {
  WrappedMiiDataLength,
  WrappedMiiDataSubtle
};
