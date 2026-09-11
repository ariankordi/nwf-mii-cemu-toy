/**
 * @file WrapAesKeys.js
 * @author Arian Kordi <https://github.com/ariankordi>
 * AES-128 keys for "WrappedStoreData", AKA the
 * encrypted form of Mii data seen in QR codes.
 */
// @ts-check

/** @enum {number} */
const KeyType = {
  Production: 0,
  Development: 1,
  Null: 2
};

/**
 * AES normal keys (keyN) at "Type 2, slot 0x31" from the 3DS.
 * https://www.3dbrew.org/wiki/PSPXI:EncryptDecryptAes#Key_Types
 * @type {Object<KeyType, Uint8Array>}
 */
const KeySlot0x31Keys = [
  /** Production key. */
  /* @__PURE__ */ new Uint8Array([0x59, 0xFC, 0x81, 0x7E, 0x64, 0x46,
    0xEA, 0x61, 0x90, 0x34, 0x7B, 0x20, 0xE9, 0xBD, 0xCE, 0x52]),
  /** Development key. */
  /* @__PURE__ */ new Uint8Array([0x12, 0xDF, 0x92, 0xB6, 0xFF, 0xD4,
    0x38, 0xAB, 0x29, 0x1C, 0x4F, 0xD4, 0xD7, 0xCE, 0x25, 0x6D]),
  /** Null key made of all zeroes used in emulators. */
  /* @__PURE__ */ new Uint8Array(16)
];

export {
  KeyType,
  KeySlot0x31Keys
};
