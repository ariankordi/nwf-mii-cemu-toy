/**
 * @file ExtraAesKeys.js
 * AES-128 keys for extra data in Mii QR codes.
 * @author Arian Kordi <https://github.com/ariankordi>
 */
// @ts-check

/** AES-CTR key for extra data in Tomodachi Life, Miitomo, and Miitopia QR codes. */
const TomoExtraDataKey = /* @__PURE__ */ new Uint8Array([0x30, 0x81, 0x9F,
  0x30, 0x0D, 0x06, 0x09, 0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x01, 0x01, 0x01]);

/**
 * AES-CCM key for Switch 2 Mii QR code extra data.
 * This key is stored right after the old "slot 0x31" key
 * in the code for the sdb (IDatabaseService) module on 23.0.0.
 */
const OunceMiiExtraDataKey = /* @__PURE__ */ new Uint8Array([0xA9, 0x3C, 0xB1,
  0x2E, 0x94, 0x86, 0x1A, 0xC1, 0xD0, 0x74, 0xBB, 0x60, 0x19, 0xFD, 0x0E, 0x92]);

export {
  TomoExtraDataKey,
  OunceMiiExtraDataKey
};
