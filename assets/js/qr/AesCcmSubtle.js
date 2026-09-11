/**
 * @file AesCcmSubtle.js
 * @author Arian Kordi <https://github.com/ariankordi>
 * @license Zlib
 * AES-CCM built from the SubtleCrypto primitives that browsers do have
 * (AES-CTR and AES-CBC), because SubtleCrypto has no AES-CCM.
 *
 * CCM is CBC-MAC for the tag plus CTR for the ciphertext (RFC 3610):
 * - The CBC-MAC is taken from an AES-CBC encryption with a zero IV.
 * - The tag and the ciphertext both come from a single AES-CTR pass.
 */
// @ts-check

const sc = globalThis.crypto.subtle;

class AesCcmSubtle {
  /** AES block length in bytes. */
  static BlockLength = 16;

  /** @param {Uint8Array<ArrayBuffer>} key - The 16-byte AES-128 key. */
  constructor(key) {
    /** @private */ this._ctrKey = sc.importKey('raw', key,
      { name: 'AES-CTR' }, false, ['encrypt']);
    /** @private */ this._cbcKey = sc.importKey('raw', key,
      { name: 'AES-CBC' }, false, ['encrypt']);
  }

  /**
   * Builds a CTR counter block: flags (L - 1), the nonce, then the counter.
   * CCM uses counter 0 to encrypt the tag and counters 1 and up for the data.
   * @param {Uint8Array} nonce - CCM nonce, 7 to 13 bytes.
   * @param {number} counter - The starting counter, 0 or 1 here.
   * @returns {Uint8Array<ArrayBuffer>} The 16-byte counter block.
   * @private
   */
  static _makeCounterBlock(nonce, counter) {
    const block = new Uint8Array(AesCcmSubtle.BlockLength);
    block[0] = AesCcmSubtle.BlockLength - 1 - nonce.length - 1; // L - 1.
    block.set(nonce, 1);
    block[AesCcmSubtle.BlockLength - 1] = counter;
    return block;
  }

  /**
   * Runs AES-CTR over `data` starting at the given CCM counter.
   * @param {Uint8Array<ArrayBuffer>} data - Data to encrypt or decrypt.
   * @param {Uint8Array} nonce - CCM nonce, 7 to 13 bytes.
   * @param {number} counter - The starting counter.
   * @returns {Promise<Uint8Array<ArrayBuffer>>} The transformed data.
   * @private
   */
  async _ctr(data, nonce, counter) {
    const lengthFieldBytes = AesCcmSubtle.BlockLength - 1 - nonce.length;
    return new Uint8Array(await sc.encrypt({
      name: 'AES-CTR',
      counter: AesCcmSubtle._makeCounterBlock(nonce, counter),
      // Only the L length bytes act as the counter; the nonce must never carry.
      length: 8 * lengthFieldBytes
    }, await this._ctrKey, data));
  }

  /**
   * Computes the full 16-byte CBC-MAC over B_0 followed by the zero-padded plaintext.
   *
   * B_0 layout (RFC 3610 section 2.2):
   * - byte 0: flags = (Adata ? 64 : 0) | ((tagLength - 2) / 2 << 3) | (L - 1)
   * - bytes 1 to nonce end: the nonce
   * - last L bytes: the plaintext length, big-endian
   *
   * SubtleCrypto AES-CBC always appends a PKCS7 padding block. The input is
   * already a whole number of blocks, so that padding is always exactly one
   * extra block, and the MAC is the block just before it.
   * @param {Uint8Array} plaintext - Data to authenticate.
   * @param {Uint8Array} nonce - CCM nonce, 7 to 13 bytes.
   * @param {number} tagLength - Tag length, which is encoded into the flags.
   * @returns {Promise<Uint8Array<ArrayBuffer>>} The 16-byte CBC-MAC.
   * @private
   */
  async _computeCbcMac(plaintext, nonce, tagLength) {
    const blockLength = AesCcmSubtle.BlockLength;
    const lengthFieldBytes = blockLength - 1 - nonce.length;
    const paddedLength = Math.ceil(plaintext.length / blockLength) * blockLength;

    const cbcInput = new Uint8Array(blockLength + paddedLength);
    cbcInput[0] = (((tagLength - 2) / 2) << 3) | (lengthFieldBytes - 1); // No Adata.
    cbcInput.set(nonce, 1);
    // Write the length big-endian. Division instead of shifting keeps it correct past 32 bits.
    let remainingLength = plaintext.length;
    for (let i = blockLength - 1; i > nonce.length; i--) {
      cbcInput[i] = remainingLength % 256;
      remainingLength = Math.floor(remainingLength / 256);
    }
    cbcInput.set(plaintext, blockLength); // The remaining zeroes are the padding.

    const cbcOutput = new Uint8Array(await sc.encrypt(
      { name: 'AES-CBC', iv: new Uint8Array(blockLength) }, await this._cbcKey, cbcInput));
    return cbcOutput.slice(cbcInput.length - blockLength, cbcInput.length);
  }

  /**
   * @param {Uint8Array<ArrayBuffer>} plaintext - Data to encrypt.
   * @param {Uint8Array<ArrayBuffer>} nonce - CCM nonce, 7 to 13 bytes.
   * @param {number} tagLength - Length of the tag to append, 4 to 16 (even).
   * @returns {Promise<Uint8Array<ArrayBuffer>>} The ciphertext followed by the tag.
   * @throws {Error} Throws if the parameters are not valid for CCM.
   */
  async encrypt(plaintext, nonce, tagLength) {
    const blockLength = AesCcmSubtle.BlockLength;
    const mac = await this._computeCbcMac(plaintext, nonce, tagLength);

    // The tag is MAC XOR S_0, and the ciphertext is plaintext XOR S_1, S_2, ...
    // Since the MAC is exactly one block, one CTR pass from counter 0 over
    // (MAC, plaintext) produces the tag followed by the ciphertext.
    const ctrInput = new Uint8Array(blockLength + plaintext.length);
    ctrInput.set(mac);
    ctrInput.set(plaintext, blockLength);
    const ctrOutput = await this._ctr(ctrInput, nonce, 0);

    const sealed = new Uint8Array(plaintext.length + tagLength);
    sealed.set(ctrOutput.subarray(blockLength)); // Ciphertext.
    // Truncating after the XOR is the same as truncating the MAC first.
    sealed.set(ctrOutput.subarray(0, tagLength), plaintext.length);
    return sealed;
  }

  /**
   * @param {Uint8Array<ArrayBuffer>} cipherText - Ciphertext with no tag attached.
   * @param {Uint8Array<ArrayBuffer>} nonce - CCM nonce, 7 to 13 bytes.
   * @returns {Promise<Uint8Array<ArrayBuffer>>} The plaintext.
   * @throws {Error} Throws if the nonce length is not valid for CCM.
   */
  decryptSkipTag = (cipherText, nonce) =>
    this._ctr(cipherText, nonce, 1);

  /**
   * Decrypts and verifies ciphertext followed by its tag.
   * SubtleCrypto has no AES-CCM, so this decrypts with CTR, re-encrypts to
   * get the tag, and compares that with the stored tag.
   * @param {Uint8Array<ArrayBuffer>} cipherTextWithTag - Ciphertext followed by the tag.
   * @param {Uint8Array<ArrayBuffer>} nonce - CCM nonce, 7 to 13 bytes.
   * @param {number} tagLength - Length of the tag at the end of `ciphertextWithTag`.
   * @returns {Promise<Uint8Array<ArrayBuffer>|null>} The plaintext, or null if the tag does not match.
   */
  async decrypt(cipherTextWithTag, nonce, tagLength) {
    if (cipherTextWithTag.length < tagLength) {
      return null;
    }
    const cipherTextLength = cipherTextWithTag.length - tagLength;
    const plaintext = await this.decryptSkipTag(
      cipherTextWithTag.subarray(0, cipherTextLength), nonce);
    const resealed = await this.encrypt(plaintext, nonce, tagLength);

    // Compare every byte rather than returning early, so timing does not reveal
    // how much of the tag matched.
    let difference = 0;
    for (let i = 0; i < tagLength; i++) {
      difference |= resealed[cipherTextLength + i] ^ cipherTextWithTag[cipherTextLength + i];
    }
    return difference === 0 ? plaintext : null;
  }
}

export default AesCcmSubtle;
