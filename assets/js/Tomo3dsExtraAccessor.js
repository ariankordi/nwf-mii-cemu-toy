/**
 * @file Tomo3dsExtraAccessor.js
 * @author Arian Kordi <https://github.com/ariankordi>
 */
// @ts-check

import { Char16 } from './MiiDataLibrary.mjs';

// Byte layout of the 240-byte extra (from TomodachiLifeQrCode.ksy):
// 0–31:   firstName     (32 bytes, UTF-16LE, up to 16 chars)
// 32–63:  lastName      (32 bytes, UTF-16LE, up to 16 chars)
// 64–66:  unknownBirthdayAge (3 bytes)
// 67:     packed byte — bits 0–4 = hairDye (5-bit index, LE),
//                       bits 5–6 = hairDyeMode (2-bit, LE)
// 68–79:  unknown (12 bytes)
// 80–111: catchphrase   (32 bytes, UTF-16LE)
// 112–119: unknown3Clothing (8 bytes)
// 120–135: islandId1    (16 bytes)
// 136–151: islandId2    (16 bytes)
// 152–159: miiAuthorId  (8 bytes)
// 160–169: miiCreateId  (10 bytes)
// 170–175: voice fields (6 bytes)
// 176–180: character fields (5 bytes)
// 181–199: unknown5     (19 bytes)
// 200–215: islandId3    (16 bytes)
// 216–233: islandName   (18 bytes, UTF-16LE, up to 9 chars)
// 234–239: unknown6     (6 bytes)

/** Basic accessor for the 240-byte extra data in Tomodachi Life 3DS QR codes. */
class Tomo3dsExtraAccessor {
  constructor(/** @type {Uint8Array} */ data) {
    /** @private */ this._data = data;
    /** @private */ this._data16 = new Uint16Array(data.buffer, data.byteOffset);
  }

  getFirstName = () => Char16.toString(this._data16, 16, 0);
  getLastName = () => Char16.toString(this._data16, 16, 32/2);
  getIslandName = () => Char16.toString(this._data16, 9, 216/2);

  /** @returns {number} 5-bit hair dye color index. */
  getHairDye = () => (this._data[67] >> 1) & 0b00011111; // Bits 5-1

  /** @returns {number} 0 = no dye, 1 = hair only, 2 = hair + eyebrow + beard. */
  getHairDyeMode = () => (this._data[67] >> 6) & 0b00000011; // Bits 7-6

  /**
   * Applies hair dye color to Mii visual data if hair dye is active.
   * Maps the hair dye index to a Switch common color
   * and applies to hair/eyebrow/beard color fields.
   */
  static applyHairDye(/** @type {import('./MiiDataLibrary.mjs').MiiVisualInfo} */ info,
    /** @type {number} */ mode, /** @type {number} */ color) {
    if (mode === 0) {
      return; // 0 = no dye active.
    }

    const commonColor = Tomo3dsExtraAccessor.HairDyeToCommonColorTable[color];
    info.hairColor = commonColor;
    if (mode !== 1) { // Mode 2 applies to hair + eyebrow + beard.
      info.eyebrowColor = commonColor;
      info.beardColor = commonColor;
    }
  }

  /**
   * Maps Tomodachi Life 3DS hair dye indices (0–31) to Switch common colors.
   * Derived by taking the nearest common color to each TL hair dye RGB value
   * via Euclidean distance.
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
