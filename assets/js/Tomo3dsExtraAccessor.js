/**
 * @file Tomo3dsExtraAccessor.js
 * @author Arian Kordi <https://github.com/ariankordi>
 * Accessor for the 240-byte extra data appended to ver3StoreData in
 * Tomodachi Collection: New Life / Tomodachi Life 3DS QR codes.
 * Takes only the extra portion (bytes after the 96-byte ver3StoreData),
 * not the full 336-byte buffer.
 */
// @ts-check

import { extractUTF16Text } from './common.js';

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

class Tomo3dsExtraAccessor {
  /**
   * @param {Uint8Array} extra - The 240 bytes of extra data only (post-96-byte ver3StoreData).
   */
  constructor(extra) {
    this._extra = extra;
  }

  /** @returns {string} */
  getFirstName()  { return extractUTF16Text(this._extra, 0, false, 16); }

  /** @returns {string} */
  getLastName()   { return extractUTF16Text(this._extra, 32, false, 16); }

  /** @returns {string} */
  getIslandName() { return extractUTF16Text(this._extra, 216, false, 9); }

  /** @returns {number} 5-bit hair dye color index. */
  getHairDye()    { return this._extra[67] & 0x1F; }

  /**
   * @returns {number} 0 = no dye, 1 = hair only, 2 = hair + eyebrow + beard.
   */
  getHairDyeMode() { return (this._extra[67] >> 5) & 0x3; }

  /**
   * Applies hair dye color overrides to a MiiVisualInfo if hair dye is active.
   * Maps the hair dye index through HAIR_DYE_TO_COMMON_COLOR_TABLE to a
   * Switch common color, then writes it to the relevant visual fields.
   * @param {import('./MiiDataLibrary.mjs').MiiVisualInfo} info
   */
  applyHairDye(info) {
    const mode = this.getHairDyeMode();
    if (!mode || mode > 2) return; // 0 = no dye active.
    const color = Tomo3dsExtraAccessor.HAIR_DYE_TO_COMMON_COLOR_TABLE[this.getHairDye()];
    info.hairColor = color;
    if (mode !== 1) { // Mode 2 applies to hair + eyebrow + beard.
      info.eyebrowColor = color;
      info.beardColor = color;
    }
  }

  /**
   * Maps Tomodachi Life 3DS hair dye indices (0–31) to Switch common colors.
   * Derived by taking the nearest common color to each TL hair dye RGB value
   * via Euclidean distance.
   * See also HEYimHeroic's version: https://x.com/HEYimHeroic/status/1705662026398196073
   * @type {ReadonlyArray<number>}
   */
  static HAIR_DYE_TO_COMMON_COLOR_TABLE = Object.freeze([
    // Corresponds to the in-game color selection layout (6 columns, left to right):
    55, 51, 50, 12, 16, 12, 67, 61,
    51, 64, 69, 66, 65, 86, 85, 93,
    92, 19, 20, 20, 15, 32, 35, 26,
    38, 41, 43, 18, 95, 97, 97, 99
  ]);
}

export default Tomo3dsExtraAccessor;
