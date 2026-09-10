/**
 * @file Tomo3dsExtraAccessor.js
 * @author Arian Kordi <https://github.com/ariankordi>
 */
// @ts-check

import { Char16 } from './MiiDataLibrary.mjs';

// Byte layout is from tomodachi_life_qr_code.ksy.
// Reference: https://github.com/ariankordi/nwf-mii-cemu-toy/blob/7570faefff49737a0d87cd4496eb5064657860cf/kaitai-structs/tomodachi_life_qr_code.ksy

/** Basic accessor for the 240-byte extra data in Tomodachi Life 3DS QR codes. */
class Tomo3dsExtraAccessor {
  constructor(/** @type {Uint8Array} */ data) {
    /** @private */ this._data = data;
    // Note: This is little-endian. To convert it
    // on big-endian browsers, use: getArray16From8(data)
    /** @private */ this._data16 = new Uint16Array(data.buffer, data.byteOffset);
  }

  getFirstName = () => Char16.toString(this._data16, 16, 0);
  getLastName = () => Char16.toString(this._data16, 16, 32 / 2);
  getIslandName = () => Char16.toString(this._data16, 9, 216 / 2);

  /** @returns {number} Hair dye color index (0-31). */
  getHairDye = () => (this._data[67] >> 1) & 0x1F; // Bits 5-1

  /** @returns {number} 0 = none, 1 = hair only, 2 = hair + eyebrow + beard. */
  getHairDyeMode = () => (this._data[67] >> 6) & 3; // Bits 7-6

  /**
   * Applies hair dye color to Mii visual data if hair dye is active.
   * Maps the hair dye index to a Switch common color
   * and applies to hair/eyebrow/beard color fields.
   */
  static applyHairDye(/** @type {import('./MiiDataLibrary.mjs').MiiVisualInfo} */ info,
    /** @type {number} */ mode, /** @type {number} */ color) {
    if (color < 0 || color > 31) {
      return; // Out-of-bounds color value.
    }

    const commonColor = Tomo3dsExtraAccessor.HairDyeToCommonColorTable[color];
    switch (mode) {
      case 2: // Apply to hair, eyebrow, and beard.
        info.eyebrowColor = commonColor;
        info.beardColor = commonColor;
        // Fall-through and also apply to hair.
      // eslint-disable-next-line no-fallthrough -- Explicit fall-through.
      case 1: // Apply to hair only.
        info.hairColor = commonColor;
        break;
      // Default: do not apply hair dye.
    }
  }

  /**
   * Maps Tomodachi Life 3DS hair dye indices (0–31) to Switch common colors.
   * Derived by taking the nearest common color to each
   * hair dye RGB value via Euclidean distance.
   *
   * r2-bintable-extract/scripts/misc/clone-tl3ds-to-common-mapping.ts
   * @type {Readonly<Uint8Array>}
   */
  static HairDyeToCommonColorTable = new Uint8Array([
    // Corresponds to the in-game color selection layout (6 columns, left to right):
    55, 51, 50, 12, 16, 12, 67, 61,
    51, 64, 69, 66, 65, 86, 85, 93,
    92, 19, 20, 20, 15, 32, 35, 26,
    38, 41, 43, 18, 95, 97, 97, 99
  ]);
}

export default Tomo3dsExtraAccessor;
