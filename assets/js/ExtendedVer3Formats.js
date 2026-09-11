// @ts-check

import { MiiDataSize, MiiDecoder, MiiVisualInfo } from './MiiDataLibrary.mjs';
import Tomo3dsExtraAccessor from './Tomo3dsExtraAccessor.js';

/** @enum {number} */
const ExtendedVer3DataType = {
  None: 0,
  Tomo3ds: 1,
  Nfp: 2,
  Ounce: 3
};

/*
const ExtendedVer3DataSize = {
  None: 96,
  Tomo3ds: 96 + 240,
  Nfp: 96 + 8,
  Ounce: 96 + 10
};
*/

function infoToNfpData(/** @type {Uint8Array} */ dst,
  /** @type {MiiVisualInfo} */ info) {
  // TODO: move to MiiDataLibrary
  dst[0] = info.facelineColor;
  dst[1] = info.hairColor;
  dst[2] = info.eyeColor;
  dst[3] = info.eyebrowColor;
  dst[4] = info.mouthColor;
  dst[5] = info.beardColor;
  dst[6] = info.glassColor;
  dst[7] = info.glassType;
}

class ExtendedVer3 {
  static getTypeFromSize(size = 0) {
    switch (size) {
      case MiiDataSize.VER3_STORE_DATA + 240:
        return ExtendedVer3DataType.Tomo3ds;
      case MiiDataSize.VER3_STORE_DATA + 8:
        return ExtendedVer3DataType.Nfp;
      case MiiDataSize.VER3_STORE_DATA + 10:
        return ExtendedVer3DataType.Ounce;
      default:
        return ExtendedVer3DataType.None;
    }
  }

  static has = (/** @type {number} */ size) =>
    this.getTypeFromSize(size) !== ExtendedVer3DataType.None;

  /**
   * @param {ExtendedVer3DataType} type
   * @param {Uint8Array} data
   * @returns
   */
  static getNfpExtensionFromType(type, data) {
    switch (type) {
      case ExtendedVer3DataType.Tomo3ds: {
        // Populate MiiVisualInfo from the base visual data.
        const info = new MiiVisualInfo();
        MiiDecoder.visualFromVer3Core(data, info);
        const extension = new Uint8Array(8);
        {
          // Get the extra data and apply hair dye to the MiiVisualInfo.
          const extra = data.subarray(MiiDataSize.VER3_STORE_DATA);
          const accessor = new Tomo3dsExtraAccessor(extra);
          Tomo3dsExtraAccessor.applyHairDye(info,
            accessor.getHairDyeMode(), accessor.getHairDye());
        }
        // Convert MiiVisualInfo to the extension.
        infoToNfpData(extension);
        return extension;
      }
      case ExtendedVer3DataType.Nfp:
        return data.slice(MiiDataSize.VER3_STORE_DATA);
      case ExtendedVer3DataType.Ounce:
        return data.slice(MiiDataSize.VER3_STORE_DATA + 2);
      default:
        throw new Error('Unexpected type.');
    }
  }
}

export {
  ExtendedVer3DataType,
  ExtendedVer3
};
