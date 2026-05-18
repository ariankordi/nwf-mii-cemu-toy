/**
 * @file JS utility and site module that handles conversion across Mii data formats.
 * See exports ({@link convertDataToType}, {@link bindResultTemplateHandlers}).
 * Binds event listeners to result template clones via {@link bindResultTemplateHandlers}.
 * @author Arian Kordi <ariankordi@ariankordi.net>
 */
// @ts-check

/**
 * @typedef {Object} FormatDefinition
 * @property {string} className - A generic label for categorizing the Mii format (e.g. 'Gen1Wii').
 * @property {string} technicalName - A technical description of the format and where it's used.
 * @property {Array<number>} sizes - Array of supported sizes (in bytes) for this format.
 * @property {number} [version] - Optional version number (e.g. 3 or 4).
 * @property {string} [encodeFunction] - Name of the encode function for this format, if available.
 * @property {string} [toVer3Function] - Name of the function to convert to version 3.
 * @property {string} [toVer4Function] - Name of the function to convert to version 4.
 * @property {string} [preConvertFromFunction] - Name of a function to run *before* converting *from* this format.
 * @property {string} [postConvertToFunction] - Name of a function to run *after* converting *to* this format.
 * @property {string} [parseExtensionFunction] - Name of a parser for extension data embedded in the format.
 */

import { KaitaiStream } from 'kaitai-struct';
import * as Gen1Wii from '../kaitai-dist/Gen1Wii.cjs';
import * as Gen2Wiiu3dsMiitomo from '../kaitai-dist/Gen2Wiiu3dsMiitomo.cjs';
import * as Gen3Studio from '../kaitai-dist/Gen3Studio.cjs';
import * as Gen3Switch from '../kaitai-dist/Gen3Switch.cjs';
import * as Gen3Switchgame from '../kaitai-dist/Gen3Switchgame.cjs';
import * as TomodachiLifeQrCode from '../kaitai-dist/TomodachiLifeQrCode.cjs';
import { bytesToHex, crc16 } from './common.js';
import { WrappedMiiDataLength, WrappedMiiDataSubtle } from './WrappedMiiDataSubtle.js';
import { KeySlot0x31Keys, KeyType } from './WrapAesKeys.js';
import { MiiLogoQrCode } from './MiiLogoQrCode.js';

// below is an UGLY!!!!!!! workaround to importing
// UMD modules, from ESM, for browser and node (bundler)

// the generated scripts do not import KaitaiStream properly
// so this has to be injected into the globalThis...
globalThis['KaitaiStream'] = KaitaiStream;
/* eslint-disable @stylistic/quote-props -- maybe clearer for closure compiler */
const structsObj = {
  'Gen1Wii': globalThis.Gen1Wii || Gen1Wii.default,
  'Gen2Wiiu3dsMiitomo': globalThis.Gen2Wiiu3dsMiitomo || Gen2Wiiu3dsMiitomo.default,
  'Gen3Studio': globalThis.Gen3Studio || Gen3Studio.default,
  'Gen3Switch': globalThis.Gen3Switch || Gen3Switch.default,
  'Gen3Switchgame': globalThis.Gen3Switchgame || Gen3Switchgame.default,
  'TomodachiLifeQrCode': globalThis.TomodachiLifeQrCode || TomodachiLifeQrCode.default
};
/* eslint-enable @stylistic/quote-props -- see above */
// kaitai's exported class is the "default" import, however we
// use star imports to be compatible with browser and node ESM
for (const k of Object.keys(structsObj)) {
  // @ts-ignore -- read above, this is manually resolved`
  structsObj[k] = structsObj[k][k];
}

/**
 * Object representing common fields shared by Kaitai structures.
 * Properties are ordered in alphabetical order according to the
 * real names of nn::mii::CharInfo.
 * @typedef {Object} MiiVisualParam
 * @property {number} facialHairColor
 * @property {number} facialHairBeard
 * @property {number} bodyWeight
 * @property {number} eyeStretch
 * @property {number} eyeColor
 * @property {number} eyeRotation
 * @property {number} eyeSize
 * @property {number} eyeType
 * @property {number} eyeHorizontal
 * @property {number} eyeVertical
 * @property {number} eyebrowStretch
 * @property {number} eyebrowColor
 * @property {number} eyebrowRotation
 * @property {number} eyebrowSize
 * @property {number} eyebrowType
 * @property {number} eyebrowHorizontal
 * @property {number} eyebrowVertical
 * @property {number} faceColor
 * @property {number} faceMakeup
 * @property {number} faceType
 * @property {number} faceWrinkles
 * @property {number} favoriteColor
 * @property {number} gender
 * @property {number} glassesColor
 * @property {number} glassesSize
 * @property {number} glassesType
 * @property {number} glassesVertical
 * @property {number} hairColor
 * @property {number} hairFlip
 * @property {number} hairType
 * @property {number} bodyHeight
 * @property {number} moleSize
 * @property {number} moleEnable
 * @property {number} moleHorizontal
 * @property {number} moleVertical
 * @property {number} mouthStretch
 * @property {number} mouthColor
 * @property {number} mouthSize
 * @property {number} mouthType
 * @property {number} mouthVertical
 * @property {number} facialHairSize
 * @property {number} facialHairMustache
 * @property {number} facialHairVertical
 * @property {number} noseSize
 * @property {number} noseType
 * @property {number} noseVertical
 */

// #region Format Definitions
// // ---------------------------------------------------------------------
// //  Format Definitions
// // ---------------------------------------------------------------------

/**
 * NOTE: "to" functions need to be defined in conersionMethods
 * for simplicity, 3DS/Wii U format will be referred to as "Ver3"
 * and Switch/Studio as "Ver4". idk what wii is but it will be 1
 * @type {Array<FormatDefinition>}
 */
const supportedFormats = [{
  className: 'Gen1Wii',
  technicalName: 'RFLCharData/RFLStoreData (Wii)',
  sizes: [74, 76],
  // TODO: needs dedicated encode function
  toVer3Function: 'convertWiiFieldsToVer3',
  toVer4Function: 'convertVer3FieldsToVer4'
},
{
  className: 'Gen3Switch',
  // Switch data is not commonly referred to as Ver4, however, in Pikmin Bloom's global-metadata.dat,
  // there are many strings referring to Ver3, many being symbols directly from nn::mii, even a string
  // that looks like a const or macro in the file: "NN_MII_CHAR_INFO_SIZE".
  // And finally, there is a string in there reading "FromVer4CoreData".
  technicalName: 'nn::mii::StoreData/nn::mii::CoreData (Switch)',
  // Now, even though Pikmin Bloom is in Unity and not developed by Nintendo, there's still one
  // other reference to the name. The Coral API endpoint "me.json" has a child in a "mii"
  // object called "storeData", containing another child named simply "3" with 96-byte long Base64 data.
  // However, there is another element called "coreData" containing a child named "4"
  // with 48-byte long Base64 data. SO, there you go: officially Ver3StoreData, and Ver4CoreData.
  sizes: [68, 48],
  version: 4,
  // TODO: needs dedicated encode function
  toVer3Function: 'convertVer4FieldsToVer3',
  // NOTE: coredata's eyebrow y field's true value += 3
  preConvertFromFunction: 'correctFromVer4CoreDataFields'
},
{
  className: 'Gen3Switchgame',
  technicalName: 'nn::mii::CharInfo (Switch)',
  sizes: [88],
  version: 4,
  encodeFunction: 'encodeSwitchCharInfo',
  toVer3Function: 'convertVer4FieldsToVer3'
},
{
  className: 'Gen2Wiiu3dsMiitomo',
  sizes: [96, 92, 72],
  // NOTE: 3DS/Wii U compatible data is referred to officially in the Switch nn::mii library
  // as "Ver3": "nn::mii::Ver3StoreData", functions and tables using "ToVer3" and "FromVer3",
  // mii_Ver3Common.cpp, mii_Ver3StoreDataTable.cpp, etc.
  technicalName: 'CFL/FFL/AFL/Ver3 (3DS/Wii U) StoreData',
  version: 3,
  encodeFunction: 'encodeVer3StoreData',
  toVer4Function: 'convertVer3FieldsToVer4',
  // NOTE: right now we are force enabling copy from
  // structs that do not support it, specifically TO only ver3
  // perhaps if we are converting to other types that allow
  // copying, which I know nn::mii::CharInfo may but who cares...
  // ... then it should logically be applied there as WELL, bleh.
  postConvertToFunction: 'forceEnableCopyingIfUndefined'
},
// for NfpStoreDataExtention:
{
  className: 'Gen2Wiiu3dsMiitomo',
  sizes: [104, 106, 108], // 106/108 = for mii-creator ".miic"
  technicalName: 'Ver3StoreData + NfpStoreDataExtention (amiibo Data)',
  version: 3,
  parseExtensionFunction: 'parseNfpStoreDataExtention',
  toVer4Function: 'useNfpStoreDataExtentionFieldsForVer4'
},
// for Tomodachi Life 3DS data:
{
  className: 'Gen2Wiiu3dsMiitomo',
  sizes: [96 + 240], // qr code data is 240 bytes long
  technicalName: 'CFLiMiiDataPacket + Tomodachi Life 3DS QR Data',
  version: 3,
  parseExtensionFunction: 'parseTomodachiLifeQRCodeData',
  toVer4Function: 'applyHairDyeAsVer4HairColor'
},
{
  // mii studio site decoded URL format/LocalStorage format
  className: 'Gen3Studio',
  // the js will deobfuscate length 47 itself
  sizes: [46, 47], // 46 = decoded/raw format
  technicalName: 'Mii Studio Data',
  version: 4,
  encodeFunction: 'encodeKaitaiStructToUint8Array',
  toVer3Function: 'convertVer4FieldsToVer3',
  preConvertFromFunction: 'gen3studioDefineFacialHairFromBeardFields', // define facialhair from beard
  postConvertToFunction: 'gen3studioDefineBeardFromFacialHairFields' // define beard from facialhair
}
];

// #endregion

/**
 * ig you could also make this "no name" like FFL does
 * blanco (na) api sets mii studio miis' names to this
 */
const DEFAULT_NAME_IF_NONE = 'Mii';

// #region Conversion Methods
// // ---------------------------------------------------------------------
// //  Conversion Methods
// // ---------------------------------------------------------------------

/** conversion methods for supportedFormats are defined here instead of window now */
const conversionMethods = {};

// NOTE: while there are tables to map ver3 colors to the CommonColor type...
// shortcuts are being used here to effectively
// simulate the exact behavior of those tables

// facelineColor: maps identically, no conv needed
/**
 * 0->8
 * @param {number} c - Ver3 hair color.
 * @returns {number} The corresponding common color.
 */
const ver3ToVer4HairColor = c => c === 0 ? 8 : c;
/**
 * offset 8
 * @param {number} c - Ver3 eye color.
 * @returns {number} The corresponding common color.
 */
const ver3ToVer4EyeColor = c => c + 8;
/**
 * Ver3GlassColorTable
 * @param {number} c - Ver3 glass color.
 * @returns {number} The corresponding common color.
 */
const ver3ToVer4GlassColor = (c) => {
  // Ver3GlassColorTable
  // ig there is a chance this will be out of bounds
  return [8, 14, 15, 16, 17, 18, 0][c];
  // ^^^^  0->8, 1->14, 5->18, 6->0
};
/**
 * offset 19
 * @param {number} c - Ver3 mouth color.
 * @returns {number} The corresponding common color.
 */
const ver3ToVer4MouthColor = c => c + 19;
// glassType: maps identically, no conv needed

/**
 * convert fields from ver3 and below to be compatible with switch/studio
 * the only fields that need to be made compatible, however,
 * , are the colors to convert them to the CommonColor type
 * @param {MiiVisualParam} data
 */
conversionMethods.convertVer3FieldsToVer4 = (data) => {
  // cannot just set these directly, have to set the properties
  // kaitai structs use defineProperty to make these fetch from bitshifts

  Object.defineProperty(data, 'facialHairColor', {
    value: ver3ToVer4HairColor(data.facialHairColor),
    configurable: true
  });
  Object.defineProperty(data, 'eyeColor', {
    value: ver3ToVer4EyeColor(data.eyeColor)
  });
  Object.defineProperty(data, 'eyebrowColor', {
    // hair color (same as above)
    value: ver3ToVer4HairColor(data.eyebrowColor),
    configurable: true
  });
  Object.defineProperty(data, 'glassesColor', {
    value: ver3ToVer4GlassColor(data.glassesColor)
  });
  Object.defineProperty(data, 'hairColor', {
    // hair color (same as above)
    value: ver3ToVer4HairColor(data.hairColor),
    configurable: true
  });
  Object.defineProperty(data, 'mouthColor', {
    value: ver3ToVer4MouthColor(data.mouthColor)
  });
  // NOTE: you cannot do the same vice-versa to convert ver4 colors back
  // ver4 also has new glass types, and...
  // ... faceline/skin color is not mapped (ver3 ones work on ver4)

  // clamp build/height to 127 if it's higher
  // because build/height max is 128 for ver3
  Object.defineProperty(data, 'bodyWeight', {
    value: Math.min(data.bodyWeight, 127)
  });
  Object.defineProperty(data, 'bodyHeight', {
    value: Math.min(data.bodyHeight, 127)
  });
};

// NOTE: tables are from MiiPort:
// https://github.com/Genwald/MiiPort/blob/4ee38bbb8aa68a2365e9c48d59d7709f760f9b5d/include/convert_mii.h#L18
// these SHOULD be extracted from nn::mii, however, AFAIK these are located...
// ... in the CommonColorTable as four uint8s after the two Color3s
const ToVer3GlassTypeTable = [0, 1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 1, 3, 7, 7, 6, 7, 8, 7, 7];
/* eslint-disable @stylistic/max-len -- Directly pasted tables. */
const ToVer3HairColorTable = [0, 1, 2, 3, 4, 5, 6, 7, 0, 4, 3, 5, 4, 4, 6, 2, 0, 6, 4, 3, 2, 2, 7, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 4, 4, 4, 4, 4, 4, 4, 0, 0, 4, 4, 4, 4, 4, 4, 0, 0, 0, 4, 4, 4, 4, 4, 4, 5, 5, 5, 4, 4, 4, 4, 4, 4, 4, 5, 7, 5, 7, 7, 7, 7, 7, 6, 7, 7, 7, 7, 7, 3, 7, 7, 7, 7, 7, 0, 4, 4, 4, 4];
const ToVer3EyeColorTable = [0, 2, 2, 2, 1, 3, 2, 3, 0, 1, 2, 3, 4, 5, 2, 2, 4, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 4, 4, 4, 4, 4, 4, 4, 1, 0, 4, 4, 4, 4, 4, 4, 4, 0, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 3, 3, 3, 3, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1];
const ToVer3MouthColorTable = [4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 1, 4, 4, 4, 0, 1, 2, 3, 4, 4, 2, 3, 3, 4, 4, 4, 4, 1, 4, 4, 2, 3, 3, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 4, 4, 4, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 3, 3, 3, 3, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 4, 4, 3, 3, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 4, 0, 3, 3, 3, 3, 4, 3, 3, 3, 3];
const ToVer3GlassColorTable = [0, 1, 1, 1, 5, 1, 1, 4, 0, 5, 1, 1, 3, 5, 1, 2, 3, 4, 5, 4, 2, 2, 4, 4, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 0, 0, 0, 5, 5, 5, 5, 5, 5, 0, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5];
/* eslint-enable @stylistic/max-len -- Directly pasted tables. */
const ToVer3FacelineColorTable = [0, 1, 2, 3, 4, 5, 0, 1, 5, 5];

/**
 * converting fields from ver4 to ver3, like vice versa,
 * involves reassigning colors, from CommonColor to the respective ver3 types
 * one of the differences is that this is also reassigning glass type as ver4 has more
 * @param {MiiVisualParam} data
 */
conversionMethods.convertVer4FieldsToVer3 = (data) => {
  // using the conversion tables defined above:
  data.faceColor = ToVer3FacelineColorTable[data.faceColor];
  data.hairColor = ToVer3HairColorTable[data.hairColor];
  data.eyeColor = ToVer3EyeColorTable[data.eyeColor];
  data.eyebrowColor = ToVer3HairColorTable[data.eyebrowColor];
  data.mouthColor = ToVer3MouthColorTable[data.mouthColor];
  // NOTE: even though the rest of the beard fields are named differently
  // in Gen3Studio, this one for beard color is the same there and in all
  data.facialHairColor = ToVer3HairColorTable[data.facialHairColor];
  data.glassesColor = ToVer3GlassColorTable[data.glassesColor];
  data.glassesType = ToVer3GlassTypeTable[data.glassesType];
};

/**
 * parses either NfpStoreDataExtention or
 * mii-creator custom extension/".miic" format
 * @param {Uint8Array} data
 * @param {MiiVisualParam} struct
 */
conversionMethods.parseNfpStoreDataExtention = (data, struct) => {
  // begin reading after Ver3StoreData offset
  /** sizeof(FFLStoreData) */
  let offset = 96;

  /** stub, no u8 fields equal this */
  let useOriginalVer3Value = -1;
  // 104 = sizeof(nn::mii::Ver3StoreData)
  // + sizeof(nn::mii::NfpStoreDataExtention)
  // mii-creator extension is larger than 8 bytes
  if (data.length > 104) {
    // uses 0 to indicate use original val
    useOriginalVer3Value = 0;
  }

  // all fields below are u8 so all just one byte
  struct.extFacelineColor = data[offset++];
  struct.extHairColor = data[offset++];
  struct.extEyeColor = data[offset++];
  struct.extEyebrowColor = data[offset++];
  struct.extMouthColor = data[offset++];
  struct.extBeardColor = data[offset++];
  struct.extGlassColor = data[offset++];
  struct.extGlassType = data[offset++];

  // handle fields that use original values:
  // (mostly for mii-creator format)
  if (struct.extFacelineColor === useOriginalVer3Value) {
    struct.extFacelineColor = struct.faceColor;
  } // identity
  if (struct.extHairColor === useOriginalVer3Value) {
    struct.extHairColor = ver3ToVer4HairColor(struct.hairColor);
  }
  if (struct.extEyeColor === useOriginalVer3Value) {
    struct.extEyeColor = ver3ToVer4EyeColor(struct.eyeColor);
  }
  if (struct.extEyebrowColor === useOriginalVer3Value) {
    struct.extEyebrowColor = ver3ToVer4HairColor(struct.eyebrowColor);
  }
  if (struct.extMouthColor === useOriginalVer3Value) {
    struct.extMouthColor = ver3ToVer4MouthColor(struct.mouthColor);
  }
  if (struct.extBeardColor === useOriginalVer3Value) {
    struct.extBeardColor = ver3ToVer4HairColor(struct.facialHairColor);
  }
  if (struct.extGlassColor === useOriginalVer3Value) {
    struct.extGlassColor = ver3ToVer4GlassColor(struct.glassesColor);
  }
  if (struct.extGlassType === useOriginalVer3Value) {
    struct.extGlassType = struct.glassesType;
  } // identity
};

/**
 * apply extra "extension" fields at the end of this struct
 * back to the actual fields since the extension fields are ver4
 * @param {MiiVisualParam} data
 */
conversionMethods.useNfpStoreDataExtentionFieldsForVer4 = (data) => {
  Object.defineProperty(data, 'faceColor', {
    value: data.extFacelineColor
  });
  Object.defineProperty(data, 'hairColor', {
    value: data.extHairColor
  });
  Object.defineProperty(data, 'eyeColor', {
    value: data.extEyeColor
  });
  Object.defineProperty(data, 'eyebrowColor', {
    value: data.extEyebrowColor
  });
  Object.defineProperty(data, 'mouthColor', {
    value: data.extMouthColor
  });
  Object.defineProperty(data, 'facialHairColor', {
    value: data.extBeardColor
  });
  Object.defineProperty(data, 'glassesColor', {
    value: data.extGlassColor
  });
  Object.defineProperty(data, 'glassesType', {
    value: data.extGlassType
  });
};

/**
 * parse tomodachi life qr code data from kaitai
 * treat as extension appended after data
 * @param {Uint8Array} data
 * @param {Object} struct
 */
const parseTomodachiLifeQRCodeData = (data, struct) => {
  const className = 'TomodachiLifeQrCode';
  const structClass = structsObj[className];

  /** begins after cfsd */
  const qrCodeData = data.subarray(96);
  const stream = new KaitaiStream(qrCodeData);
  const src = new structClass(stream);

  // copy fields on the destination that the source also has
  const allDestKeys = [...Object.keys(src),
    // get keys as WELL as properties on the prototype
    ...Object.getOwnPropertyNames(
      Object.getPrototypeOf(src)
    )
  ];
  for (const key of allDestKeys) {
    // do not copy private fields that start with an underscore
    if (key.startsWith('_')) {
      continue;
    }
    // null terminate every string...
    if (typeof src[key] === 'string') {
      src[key] = removeEverythingAfterNullTerminator(src[key]);
    }
    Object.defineProperty(struct, key, {
      value: src[key]
    });
  }
};

conversionMethods.parseTomodachiLifeQRCodeData = parseTomodachiLifeQRCodeData;

/**
 * @param {MiiVisualParam} data
 */
conversionMethods.applyHairDyeAsVer4HairColor = (data) => {
  // all fields will be interpreted as common colors
  conversionMethods.convertVer3FieldsToVer4(data);

  // usually the value is at offset 0x43
  // first bit = hair dye enable
  // hair dye value = bits range 2-7 (5 bits, 32 max)

  // if(typeof data.hairDye !== 'number')
  if (!data.hairDyeMode || data.hairDyeMode > 2) { // if it's zero or undefined
    return; // Return unmodified
  }

  /*
    Table for custom hair dye colors from Tomodachi Life 3DS.
    These are RGBA little-endian integers (0xAABBGGRR)
    in the binary found at FUN_00706fb0, Title: 0004000E0008C300 1.1.0
    (not a linear table, some values are outside of the data section)
    Values as 0xRRGGBB:

    0x9DDFFF, 0x68CCFF, 0x3D86FF, 0x0000FF, 0x27275F, 0x4B4B8C, 0x007070, 0x2EA9A9,
    0x00FFFF, 0x8BEA9E, 0x47F026, 0x009500, 0x004C00, 0xFFFF71, 0xFFFF00, 0xFFCC99,
    0xFF9C41, 0xDD6400, 0xFF1E1E, 0xFF0000, 0x910000, 0xFF00AA, 0xFF6297, 0xFFADA2,
    0x3C003C, 0x8308C2, 0xC381F8, 0x7B5D6D, 0x4B4B4B, 0xBBBFA1, 0xB4B4B4, 0xFFFFFF
  */

  /**
   * Lookup table converting TL 3DS (Clone) hair dye colors to Switch common colors.
   * Created by taking the nearest value of each via Euclidian distance.
   * See also a version by HEYimHeroic: https://x.com/HEYimHeroic/status/1705662026398196073
   */
  const HairDyeToCommonColorTable = [
    // Corresponds to the in-game color selection layout:
    55, 51, 50, 12, 16, 12, 67, 61,
    51, 64, 69, 66, 65, 86, 85, 93,
    92, 19, 20, 20, 15, 32, 35, 26,
    38, 41, 43, 18, 95, 97, 97, 99
  ];
  // Map from data.hairDye.
  const hairDyeCommonColor = HairDyeToCommonColorTable[data.hairDye];
  // These are applied to hairColor, eyebrowColor, facialHairColor.
  // (Confirmed according to https://web.archive.org/web/20250106204124/https://tomodachi.fandom.com/wiki/Hair_Dye)
  Object.defineProperty(data, 'hairColor', {
    value: hairDyeCommonColor
  });
  if (data.hairDyeMode !== 1) { // If mode is not hair only...
    Object.defineProperty(data, 'eyebrowColor', {
      value: hairDyeCommonColor
    });
    Object.defineProperty(data, 'facialHairColor', {
      value: hairDyeCommonColor
    });
  }
};

/**
 * add 3 to eyebrow vertical
 * @param {Object} _ - Output struct.
 * @param {MiiVisualParam} input
 */
conversionMethods.correctFromVer4CoreDataFields = (_, input) => {
  input.eyebrowVertical += 3;
  /*
  Object.defineProperty(output, 'eyebrowVertical', {
    value: (input.eyebrowVertical + 3)
  });
  */
  // when using this, it says attempt to change the value of a readonly property
};

/**
 * the method below is used to encode studio and switch charinfo
 * by more or less directly mapping the u8 fields in the struct to a new array
 * NOTE: only supports strings (TO UTF-16LE ONLY!!!), lists, and ofc uint8
 * @param {Object} struct
 * @returns {Uint8Array}
 */
conversionMethods.encodeKaitaiStructToUint8Array = (struct) => {
  // append all keys into this array
  // which will then become a uint8array
  const structArray = [];
  // NOTE: NOTE: kaitai private fields are NOT:
  // ... numbers, arrays, or strings. we can get away with switch()
  /*
  for(const key in struct) {
    // remove all private fields so that the object
    // represents only the struct fields in order
    if(key.startsWith('_')) {
      delete struct[key];
      continue;
    }
    //else if(typeof key)
    else
      // by default, add it directly (assuming int?)
      structArray.push(struct[key]);
  }
  */

  for (const key in struct) {
    // add to array based on the type
    // value will be changed for string case
    let value = struct[key];
    switch (typeof value) {
      case 'number':
        // assuming this is a uint8, pushing it
        structArray.push(value);
        break;
      case 'boolean':
        // there are never booleans in these fields natively
        // but there are when they are set from another struct
        structArray.push(Number(value));
        break;
      case 'string': {
        // NOTE: assuming NAME is ALWAYS 10 CHARACTER UTF-16 STRING
        // IMPORTANT!!!!: in Switch CharInfo, the name is (10+1) characters, where the last character is for padding
        // I THINK!!!! that Switch CharInfo is the only (for storage/transmission) format with padding
        // BECAUSE of this, for compatibility with other types...
        // ... this will be using and serializing a 10 character name
        // this WORKS in "gen3_switchgame.ksy" but NOT!!!! "miidata_swi.ksy" by HEYimHeroic
        const stringBytes = new Uint8Array(new ArrayBuffer(20));
        const stringBytesView = new DataView(stringBytes.buffer);
        for (let i = 0; i < 10; i++) {
          // assuming name is always 10 characters even if it has padding
          const u16Offset = i * 2;
          stringBytesView.setUint16(u16Offset, value.charCodeAt(i), true); // little-endian UTF-16
        }
        // encode string to utf-16le byte array
        value = [...stringBytes];
        // FALL THROUGH and add this as an array
      }
      case 'object':
        // actually, only arrays
        if (!(Array.isArray(value))) {
          if (!key.startsWith('_')) {
            console.warn('unknown field type on key object: ' + key);
          }
          continue;
        }
        // this is an array, so push each element
        for (const v of value) {
          structArray.push(v);
        }
        break;
      default:
        if (!key.startsWith('_')) {
          console.warn('unknown field type on key: ' + key);
        }
        // all other types are ignored
    }
  }
  // array of ints representing studio data
  // const structArray = Object.values(struct);
  // return as a uint8array for consistency
  return new Uint8Array(structArray);
  // NOTE: could be a uint8array, however...
  // ... apparently, in order to encode to hex it has to be an array anyway
};

/**
 * encodeSwitchCharInfo is mostly just a thunk using the
 * above function to encode to uint8array, but generating
 * a random create ID (in this kaitai called "unknownData") first
 * @param {Object} struct
 * @returns {Uint8Array}
 */
conversionMethods.encodeSwitchCharInfo = (struct) => {
  // if create id is not null, fill it in
  if (!struct.unknownData || isArrayNull(struct.unknownData)) {
    for (let i = 0; i < 16; i++) {
      // random 16 bytes
      struct.unknownData[i] = Math.floor(Math.random() * 256);
    }
    // The Switch nn::mii::CreateId type is just nn::util::Uuid
    // and created by: struct nn::util::Uuid __cdecl nn::util::`anonymous namespace'::GenerateUuidVersion4(void)
    // It sets extra network?? related data in:
    // struct nn::util::Uuid __cdecl nn::util::`anonymous namespace'::InternalUuid::Serialize(void)
    // but: nn::mii::CreateId::IsValid() just checks clock_seq_hi_and_reserved (8th byte) as seen below
    // struct.unknownData[6] &= (0b00001111 | 0b01000000);

    // Set two leftmost bits in order for this to be valid.
    struct.unknownData[8] &= 0b00111111; // Clear bits 7, 8
    struct.unknownData[8] |= 0b10000000; // Set bit 8
    // ^^^ Filling clock_seq_hi_and_reserved field from RFC 4122.
  }
  // fill in mii name if it is null
  if (!struct.miiName || isStringNull(struct.miiName)) {
    struct.miiName = DEFAULT_NAME_IF_NONE;
  }
  // for whatever reason they do not want any characters
  // to be in the name after the null terminator
  struct.miiName =
    removeEverythingAfterNullTerminator(struct.miiName);
  // then thunk to encode kaitai function
  return conversionMethods.encodeKaitaiStructToUint8Array(struct);
};

// the methods below remap inconsistently named fields in gen3_studio.ksy from the original mii2studio
// as the fields usually prefixed "facialHair" in the other structs are instead prefixed "beard" here

/**
 * this will map the fields FROM the studio struct TO another one
 * @param {MiiVisualParam} output
 * @param {MiiVisualParam} [inputOptional]
 */
conversionMethods.gen3studioDefineFacialHairFromBeardFields = (output, inputOptional) => {
  // if we are only acting on one struct then we will use output for both
  let input = inputOptional;
  if (input === undefined) {
    input = output;
  }

  // if the studio fields are properly named according to the others then skip
  if (input.facialHairBeard !== undefined ||
    // ... or, if this is somehow already the same studio struct?!
    output.beardGoatee !== undefined) {
    return;
  }

  Object.defineProperty(output, 'facialHairBeard', {
    value: input.beardGoatee
  });
  Object.defineProperty(output, 'facialHairSize', {
    value: input.beardSize
  });
  Object.defineProperty(output, 'facialHairMustache', {
    value: input.beardMustache
  });
  Object.defineProperty(output, 'facialHairVertical', {
    value: input.beardVertical
  });
};
/**
 * this maps the fields TO the studio struct FROM any other one
 * @param {MiiVisualParam} output
 * @param {MiiVisualParam} input
 */
conversionMethods.gen3studioDefineBeardFromFacialHairFields = (output, input) => {
  // if the studio fields are properly named according to the others then skip
  if (output.facialHairBeard !== undefined ||
    // ... or, if this is somehow already the same studio struct?!
    input.beardGoatee !== undefined) {
    return;
  }

  // erroneously prefixed "beard" in studio when other structs use "facialHair"
  output.beardGoatee = input.facialHairBeard;
  output.beardSize = input.facialHairSize;
  output.beardMustache = input.facialHairMustache;
  output.beardVertical = input.facialHairVertical;
};

/**
 * @param {MiiVisualParam} output
 * @param {MiiVisualParam} input
 */
conversionMethods.forceEnableCopyingIfUndefined = (output, input) => {
  if (input.copying === undefined) {
    Object.defineProperty(output, 'copying', {
      value: true
    });
  }
};

/**
 * encodes a compatible struct to Ver3StoreData
 * NOTE: forQRCode DOES THESE (potentially undesirable) THINGS:
 * FORCE ENABLES COPYING
 * sets MiiVersion to 0x03, and birth platform to 3DS
 * - both needed to scan as a qr code
 * skips crc16 but actually only bc qr encode routine does it itself
 * @param {MiiVisualParam} dataStruct
 * @param {boolean} forQRCode
 * @returns {Uint8Array}
 */
conversionMethods.encodeVer3StoreData = (dataStruct, forQRCode) => {
  // set unmarked fields
  dataStruct.unknown1 = 3; // ALWAYS constant 100% of the time
  // 3ds version mii, will scan as a qr code on 3ds and wii u
  // may already be set so using defineProperty on it
  if (forQRCode ||
    // there is no birth platform corresponding to 0 (1 is wii)
    dataStruct.version === undefined || dataStruct.version < 1
  ) {
    Object.defineProperty(dataStruct, 'version', {
      value: 3 // FFL_BIRTH_PLATFORM_CTR
    });
  }
  // mii needs a non-null name to scan

  // this name is what the Coral account API returns in its
  // Mii data, along with random IDs, I assume they forge it from studio data
  if (!dataStruct.miiName || isStringNull(dataStruct.miiName)) {
    dataStruct.miiName = DEFAULT_NAME_IF_NONE;
  }

  /**
   * random array of u8s
   * @param {number} size
   * @returns {Uint8Array}
   */
  const randomUint8Array =
    size => Array.from({ length: size }, () => Math.floor(Math.random() * 256));

  // NOTE: "systemId" = AuthorID, "clientId" = CreateID base
  // "avatarId" = CreateID first 4 bytes

  // systemId/AuthorID and clientId/CreateID base are not
  // needed, both can be randomy (CreateID base is ONLY
  // set to the MAC address on Wii, (DS?), 3DS but NOT
  // on Wii U (nn::act::GetDeviceHash), Switch (??? random?)

  // dataStruct.systemId = [0, 0, 0, 0, 0, 0, 0, 0];
  // CreateID cannot be null.
  // scanning two Miis with the same CreateID leads
  // the system to thinking they are the same and overwrite

  // dataStruct.avatarId = [0b00001111, 0, 0, 0];
  // TODO: make ALL IDs random, or, a hash of the
  // mii studio data or something i think maybe???

  // qr codes with THIS BIT SET will NOT SCAN on 3ds
  // (all check against this bit: FFLiIsValidMiiID,
  // CFLi_IsValidMiiID, nn::mii::CreateId::IsValid)
  if (dataStruct.avatarId[0] & 0b00100000) { // FFLI_CREATE_ID_FLAG_TEMPORARY
    dataStruct.avatarId[0] &= ~0b00100000;
  } // unset this bit

  // check if create id indicates special mii
  if (dataStruct.avatarId[0] !== 0 && // not just null
    (dataStruct.avatarId[0] & 0b10000000) === 0) { // special mii bit is 0
    // check for problems with the special mii and just warn
    console.info('Encoding a Special Mii.');
    // check localonly, must be true
    if (!dataStruct.mingle) {
      console.warn('For Special Miis, "mingling/sharing" must be OFF (localonly = true). This Special Mii has sharing enabled, therefore it will not work on any console.');
    }
    // now check if it is 3ds exclusive
    if ((dataStruct.avatarId[0] & 0b01010000) == 0x10) { // ctr bit is set
      // 0000 = wii / 0100 = ntr / 0001 = ctr / 0101 = wiiu
      console.warn('This Special Mii was created on a 3DS, so it will not scan on a Wii U. Try setting the first and third bits of the Mii ID\'s first byte. Like this: storeData.createID.data[0] |= 0x80');
    }
  }

  // TODO: IF YOU ARE READING, it MAY BE A GOOD IDEA
  // to MAKE THE CREATE ID an actual HASH OF THE
  // ORIGINAL DATA or something so that it is CONSISTENT
  if (!dataStruct.avatarId || isArrayNull(dataStruct.avatarId)) {
    const randomCreateID = randomUint8Array(10); // Ver3CreateId

    randomCreateID[0] = 0b11010000; // set normal/wiiu bit
    randomCreateID[3] = 0;
    dataStruct.avatarId = randomCreateID;
    dataStruct.clientId = randomCreateID.slice(4);
    // CreateID = avatarId + clientId
  }

  // force enable copying, but only if qr code mode is on
  if (forQRCode) {
    Object.defineProperty(dataStruct, 'copying', {
      value: true
    });
  }
  // mingle, or local only, is already initialized to false tho
  return encode3DSStoreDataFromStruct(dataStruct);
};

/**
 * converts Wii properties to ver3 compatible properties
 * @param {MiiVisualParam} data
 */
conversionMethods.convertWiiFieldsToVer3 = (data) => {
  // wii data does not support eye/mouth/eyebrow aspect/stretch so these are constant
  data.eyeStretch = 3;
  data.mouthStretch = 3;
  data.eyebrowStretch = 3;

  /**
   * Table to map faceTex field in RFLCharData to wrinkle and makeup fields.
   * First column is wrinkle (faceTex), second is makeup (faceMake).
   * See: https://github.com/aboood40091/ffl/blob/73fe9fc70c0f96ebea373122e50f6d3acc443180/src/FFLiMiiData.cpp#L353
   */
  const faceTexTable = [
    [0, 0], [0, 1], [0, 6], [0, 9], [5, 0], [2, 0],
    [3, 0], [7, 0], [8, 0], [0, 10], [9, 0], [11, 0]
  ];

  data.faceWrinkles = faceTexTable[data.facialFeature][0];
  data.faceMakeup = faceTexTable[data.facialFeature][1];
};

// #endregion

// #region Struct Parsing Utilities
// // ---------------------------------------------------------------------
// //  Struct Parsing Utilities
// // ---------------------------------------------------------------------

/**
 * iterate through format list, assumed to be called supportedFormats
 * to find that input format and throw an error if it is not supported
 * @param {number} size
 * @returns {FormatDefinition}
 * @throws {Error} Throws if there is no format corresponding to the input size.
 */
const findInputFormatFromSize = (size) => {
  for (const format of supportedFormats) {
    if (format.sizes.includes(size)) {
      return format;
    }
  }
  // nothing was found, throw error
  throw new Error('Input format is an unknown size of: ' + size);
};

/**
 * ensures that the format class exists and then creates the struct type
 * if data is not specified, then it simply creates a blank structure of the size
 * @param {FormatDefinition} format
 * @param {Uint8Array} data
 * @returns {Object} The constructed Kaitai Struct class instance.
 * @throws {Error} Throws if format class name does not exist in window,
 * or does not have prototype._read (may not be Kaitai struct),
 * or if a blank instance is passed in but it does not have any defined sizes.
 */
const createNewInstanceOfKaitaiStructFormat = (format, data) => {
  // className in the format is assumed to be a (kaitai struct) class in window
  const structClass = structsObj[format.className];
  // ensure that this actually exists
  if (!structClass) {
    throw new Error('Cannot find format class name: ' + format.className);
  }
  // find the _read prototype that kaitai constructors usually have
  if (!structClass.prototype._read) {
    throw new Error('Class does not have prototype._read and may not be generated from a Kaitai struct: ' + format.className);
  }

  // determine if this format is an extension
  const hasExtensionFunction = format.parseExtensionFunction !== undefined &&
    typeof conversionMethods[format.parseExtensionFunction] === 'function';

  // assumed to be a KaitaiStream type passed to the constructor
  let stream;

  // if data is undefined, create a new blank stream using the first supported size
  if (data === undefined) {
    // ensure that the format actually defines sizes
    if (format.sizes.length < 1) {
      throw new Error(`Trying to construct a blank instance of format ${format.className} but it does not have any defined sizes and no data was passed in.`);
    }
    // if this is an extension, do not use the first supported size
    if (hasExtensionFunction) {
      // use the data as is so that the size can be detected
      stream = new KaitaiStream(data);
    } else {
      // assuming that the first size in the list is sufficient
      const firstSupportedSize = format.sizes[0];
      stream = new KaitaiStream(new ArrayBuffer(firstSupportedSize));
    }
  } else {
    // ... otherwise, construct with data
    // if the data is smaller than the first size, which is assumed to
    // be the size of the struct, then construct with that first size
    if (format.sizes.length > 0) {
      // this is what the size of the struct is meant to be
      const firstSupportedSize = format.sizes[0];
      if (data.length < firstSupportedSize) {
        const u8Array = new Uint8Array(firstSupportedSize);
        // copy the data to the larger buffer
        u8Array.set(data, 0);
        // create the stream with that buffer
        stream = new KaitaiStream(u8Array);
      } else {
        stream = new KaitaiStream(data);
      }
    } else {
      // NOTE: assumes "data" is ArrayBuffer or DataView: https://github.com/kaitai-io/kaitai_struct_javascript_runtime/blob/a911d627ffeb244ce0b7873858325020d6694ba5/KaitaiStream.js#L20
      stream = new KaitaiStream(data);
    }
  }

  const struct = new structClass(stream);
  // the above function will throw an error if something goes wrong
  // notably I have seen it will if the data is not long enough for it

  // apply parseExtensionFunction if the format is an extension
  if (hasExtensionFunction) {
    // has valid parseExtensionFunction
    conversionMethods[format.parseExtensionFunction](data, struct);
  }

  return struct;
};

/**
 * for mapping objects like these kaitai structs
 * where the property names match on both
 * @param {Object} src
 * @param {Object} dest
 */
const mapObjectFieldsOneToOne = (src, dest) => {
  // copy fields on the destination that the source also has
  const allDestKeys = [...Object.keys(dest),
    // get keys as WELL as properties on the prototype
    // these are used by larsenv's structs for bitmapped fields
    ...Object.getOwnPropertyNames(
      Object.getPrototypeOf(dest)
    )
  ];
  // speaking of structs, these have NOT been tested with HEYimHeroic's structs
  for (const key of allDestKeys) { // in dest) {
    // do not copy private fields that start with an underscore
    // NOTE: not needed anymore bc if they are not on the dest they wont be copied
    if (!key.startsWith('_') &&
      // if the key exists on the source...
      src[key] !== undefined) {
      // ... then copy it to the destination
      // dest[key] = src[key];
      Object.defineProperty(dest, key, {
        value: src[key]
      });
    }
  }
  // NOTE!!!! NOTE!!!! this TURNS THE DESTINATION
  // into an INSTANCE OF THE SOURCE ...
};

// length of obfuscated studio data
const STUDIO_OBFUSCATED_LENGTH = 47;

/**
 * converts and encodes to a certain type
 * third arugment, inupt format name, is optional
 * if not provided then the size is used to auto detect
 * @param {Uint8Array} data
 * @param {FormatDefinition} outputFormat
 * @param {FormatDefinition|string|number|null} [inputFormat]
 * @param {boolean} [optionalBoolToEncodeFunc] - Passed to encode function.
 * @returns {Uint8Array}
 * @throws {Error} Throws if input format name is unknown, or outputFormat is not a valid format
 */
const convertDataToType = (data, outputFormat, inputFormat, optionalBoolToEncodeFunc) => {
  // ensure that data is an ArrayBuffer
  /* if(!(data instanceof ArrayBuffer))
      throw new Error('data must be ArrayBuffer or compatible.');
  */

  // format comes from either findInputFormatFromSize
  // or it comes directly from supportedFormats itself
  let format;
  // if non-null and is an object...
  if (inputFormat && typeof inputFormat === 'object') {
    // assume it is the format specification
    format = inputFormat;
  } else if (typeof inputFormat === 'string') {
    // otherwise, inputFormat is assumed to be className
    format = supportedFormats.find(f => f.className === inputFormat);
    // find() will make it null or undefined
  } else {
    // if inputFormat is NOT a valid string, so it's undefined...{
    format = findInputFormatFromSize(data.length);
    // ... auto detect based on size
    // that will throw an error so we don't need to handle it ourselves
  }
  if (!format) {
    // unsupported/non-existent formatName was passed in
    throw new Error('Unknown input format name: ' + inputFormat);
  }

  // NOTE: SPECIAL CASE: DEOBFUSCATE STUDIO DATA
  if (data && data.length === STUDIO_OBFUSCATED_LENGTH) {
    const obfs = data; // Copy reference of old data.
    data = new Uint8Array(46); // Replace data with new unobfuscated bytes.
    studioURLObfuscationDecode(data, obfs); // Decode old data to new bytes.
  }

  // if this is the output format directly then no conversion is required
  /* if(findInputFormatFromSize(data.length) === outputFormat)
      return data;
  */
  // NOTE: above isn't viable anymore just because ver3storedata
  // needs birth platform modified before qr will work
  // and if it is smaller than the full storedata it needs checksum

  // create a new instance of the class, with this function handling errors
  // may be overridden by the preprocessing function
  const inputStruct = createNewInstanceOfKaitaiStructFormat(format, data);

  // assumes that outputFormat is an object and has className in it
  if (!outputFormat || outputFormat.className === undefined) {
    throw new Error('outputFormat is not a valid format object or does not have className');
  }

  // version is needed to evaluate which of the few conversion functions need to be run
  if (typeof outputFormat.version !== 'number') {
    throw new TypeError(`Output format ${outputFormat.className} does not have a version field or it is not a number.`);
  }
  // encode function is run at the end here so it is needed
  if (outputFormat.encodeFunction === undefined ||
    typeof conversionMethods[outputFormat.encodeFunction] !== 'function') {
    throw new Error(`Output format ${outputFormat.className} does not have a valid encodeFunction.`);
  }

  // determine whether to convert to ver3, or ver4, or both
  let doConvertToVer3 = true;
  let doConvertToVer4 = true;

  // for equal versions, do not do conversion at all
  if (format.version === outputFormat.version) {
    doConvertToVer3 = false;
    doConvertToVer4 = false;
  }
  // aim to convert up AND down...?
  // if this is less than ver4 then do not convert to it
  if (outputFormat.version < 4) {
    doConvertToVer4 = false;
  }
  // if this is less than ver3 don't convert to that either
  if (outputFormat.version < 3) {
    doConvertToVer3 = false;
  }

  if (doConvertToVer3 && format.toVer3Function !== undefined) {
    // TODO: DOES NOT CHECK WHETHER THE FUNCTION ITSELF IS UNDEFINED
    conversionMethods[format.toVer3Function](inputStruct);
  }
  if (doConvertToVer4 && format.toVer4Function !== undefined) {
    // TODO: DOES NOT CHECK WHETHER THE FUNCTION ITSELF IS UNDEFINED
    conversionMethods[format.toVer4Function](inputStruct);
  }

  // create a new blank instance of the output format
  const outputStruct = createNewInstanceOfKaitaiStructFormat(outputFormat);

  // call preConvertFromFunction for input if it exists
  if (format.preConvertFromFunction !== undefined) {
    conversionMethods[format.preConvertFromFunction](outputStruct, inputStruct);
  }

  // map all fields with the same names to each other
  // TODO: should use kaitai struct dedicated encoding functions instead...!!!
  mapObjectFieldsOneToOne(inputStruct, outputStruct);
  // NOTE!!!! NOTE!!!! the OUTPUT FORMAT becomes the same as the INPUT FORMAT's CLASS!!!!!

  // call postConvertToFunction for output if it exists
  if (outputFormat.postConvertToFunction !== undefined) {
    conversionMethods[outputFormat.postConvertToFunction](outputStruct, inputStruct);
  }

  // we should be finished
  // return outputStruct;
  // FINALLY, call the encoding function
  const encodedOutput =
    conversionMethods[outputFormat.encodeFunction](outputStruct, optionalBoolToEncodeFunc);
  return encodedOutput; // should be a uint8array
};

// #endregion

// #region Codec Utilities, String Utilities
// // ---------------------------------------------------------------------
// //  Codec Utilities, String Utilities
// // ---------------------------------------------------------------------

// !! == ALL BELOW TAKEN FROM "mii2studio in js ai slop attempt 1" FIDDLE == !!

// Helper functions
/*
const stripSpaces = str => str.replace(/\s+/g, '');
const hexToUint8Array = hex => new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
const base64ToUint8Array = base64 => Uint8Array.from(atob(base64), c => c.charCodeAt(0));
*/
/**
 * used to check if a string is all zeroes, which are seen in kaitai structs
 * @param {string} str
 * @returns {boolean}
 */
const isStringNull = str => str.split('').every(char => char === '\u0000');
/**
 * take a null terminated string, and remove everything
 * after the null terminator by replacing the rest with zeroes
 * switch mii formats need this i think
 * @param {string} str
 * @returns {string}
 */
const removeEverythingAfterNullTerminator = (str) => {
  /** find null terminator in string */
  const nullIndex = str.indexOf('\0');
  if (nullIndex !== -1) { // if it is found...
    // .. we want to replace everything after it with nothing
    // however this is simply overwriting everything else with zeroes
    const beforeNull = str.slice(0, nullIndex + 1);
    // create padding to put after the null
    const padding = '\u0000'.repeat(str.length - beforeNull.length);
    return beforeNull + padding;
  }
  return str; // if no null terminator??? then return input
};
/**
 * likewise used to check if an array is null
 * @param {Array<number>} array
 * @returns {boolean}
 */
const isArrayNull = array => array.every(i => i === 0);

// #endregion

// #region Encoding Methods
// // ---------------------------------------------------------------------
// //  Encoding Methods
// // ---------------------------------------------------------------------

/**
 * NOTE: customized for the kaitai by GPT-4o...
 * ... and adapted from MiiInfoEditorCTR:
 * https://github.com/kazuki-4ys/kazuki-4ys.github.io/blob/148dc339974f8b7515bfdc1395ec1fc9becb68ab/web_apps/MiiInfoEditorCTR/mii.js#L348
 * 2024-08-10: tested to be accurate with: blanco, bro-mole-high, jasmine
 * @param {MiiVisualParam} data
 * @returns {Uint8Array}
 */
const encode3DSStoreDataFromStruct = (data) => {
  // Create buffer to store the encoded data
  /** 0x48 bytes + 20 bytes for creatorName + 2 bytes padding + 2 bytes checksum */
  const buf = new Uint8Array(0x48 + 20 + 2 + 2);

  // unknown1 byte
  buf[0x00] = data.unknown1;

  // characterSet, regionLock, profanityFlag, and copying all packed into one byte
  buf[0x01] = ((data.characterSet || 0) << 4) | // font region (2 bits),
    // typically 0=JPN+USA+EUR, 1=CHN, 2=KOR, 3=TWN
    (((data.regionLock || 0) & 0x03) << 2) | // region lock (2 bits), 0=no lock, 1=JPN, 2=USA, 3=EUR
    (Number(data.profanityFlag) << 1) | // profanity flag (1 bit), 1 = contains profanity
    Number(data.copying); // copying allowed (1 bit), 1 = copying allowed

  // mii position page index and slot index
  buf[0x02] = (data.miiPositionPageIndex & 0x0F) | // page index (4 bits)
    ((data.miiPositionSlotIndex & 0x0F) << 4); // slot index (4 bits)

  // version and unknown3 packed together
  buf[0x03] = (data.version << 4); // | // version (4 bits)
  // (data.unknown3 & 0x0F); // unknown, typically 0 (4 bits)

  // systemId: unique ID associated with the console, 8 bytes
  if (data.systemId !== undefined) {
    for (let i = 0; i < 8; i++) {
      buf[0x04 + i] = data.systemId[i] || 0;
    }
  }

  // avatarId: unique Mii ID, 4 bytes (REQUIRED)
  for (let i = 0; i < 4; i++) {
    buf[0x0C + i] = data.avatarId[i] || 0;
  }

  // clientId: MAC address of the creator's console, 6 bytes
  if (data.clientId !== undefined) {
    for (let i = 0; i < 6; i++) {
      buf[0x10 + i] = data.clientId[i] || 0;
    }
  }

  // padding, 2 bytes (usually 0)
  buf[0x16] = data.padding & 0xFF;
  buf[0x17] = (data.padding >> 8) & 0xFF;

  // data1: gender, birth month, birth day, favorite color, favorite flag
  buf[0x18] = (data.gender & 0x01) | // gender (1 bit), 0 = male, 1 = female
    ((data.birthMonth & 0x0F) << 1) | // birth month (4 bits)
    ((data.birthDay & 0x1F) << 5); // birth day (5 bits)

  buf[0x19] = ((data.birthDay >> 3) & 0x03) | // continuation of birth day (2 bits)
    ((data.favoriteColor & 0x0F) << 2) | // favorite color (4 bits)
    (Number(data.favorite) << 6); // favorite flag (1 bit)

  // mii name (REQUIRED), UTF-16LE encoded
  const nameBytes = new Uint8Array(new ArrayBuffer(20));
  const nameBytesView = new DataView(nameBytes.buffer);
  for (let i = 0; i < 10; i++) { // only copy 10 characters, last one is padding
    const u16Offset = i * 2;
    nameBytesView.setUint16(u16Offset, data.miiName.charCodeAt(i), true); // little-endian UTF-16
  }
  buf.set(nameBytes, 0x1A);

  // height and weight
  buf[0x2E] = data.bodyHeight || 0; // height (1 byte)
  buf[0x2F] = data.bodyWeight || 0; // weight (1 byte)

  // face type (shape), skin color, and mingle settings
  buf[0x30] = ((data.faceColor & 0x07) << 5) | // skin color (3 bits)
    ((data.faceType & 0x0F) << 1) | // face shape (4 bits)
    Number(data.mingle); // mingle (1 bit)

  // face makeup and wrinkles
  buf[0x31] = (data.faceWrinkles & 0x0F) | // face wrinkles (4 bits)
    ((data.faceMakeup & 0x0F) << 4); // face makeup (4 bits)

  // hair type, color, and flip
  buf[0x32] = data.hairType; // hair type (1 byte)
  buf[0x33] = (data.hairColor & 0x07) | // hair color (3 bits)
    (Number(data.hairFlip) << 3); // | // hair flip (1 bit)
  // ((data.unknown5 & 0x0F) << 4); // unknown (4 bits)

  // eye details: type, color, size, stretch, rotation, horizontal spacing, vertical position
  /** eye vertical position (5 bits) */
  const eyeDetails = (data.eyeType & 0x3F) | // eye type (6 bits)
    ((data.eyeColor & 0x07) << 6) | // eye color (3 bits)
    ((data.eyeSize & 0x07) << 9) | // eye size (3 bits)
    ((data.eyeStretch & 0x07) << 13) | // eye stretch (3 bits)
    ((data.eyeRotation & 0x1F) << 16) | // eye rotation (5 bits)
    ((data.eyeHorizontal & 0x0F) << 21) | // eye horizontal spacing (4 bits)
    ((data.eyeVertical & 0x1F) << 25);

  buf[0x34] = eyeDetails & 0xFF;
  buf[0x35] = (eyeDetails >> 8) & 0xFF;
  buf[0x36] = (eyeDetails >> 16) & 0xFF;
  buf[0x37] = (eyeDetails >> 24) & 0xFF;

  // eyebrow details: type, color, size, stretch, rotation, horizontal spacing, vertical position
  /** eyebrow vertical position (5 bits) */
  const eyebrowDetails = (data.eyebrowType & 0x1F) | // eyebrow type (5 bits)
    ((data.eyebrowColor & 0x07) << 5) | // eyebrow color (3 bits)
    ((data.eyebrowSize & 0x0F) << 8) | // eyebrow size (4 bits)
    ((data.eyebrowStretch & 0x07) << 12) | // eyebrow stretch (3 bits)
    ((data.eyebrowRotation & 0x0F) << 16) | // eyebrow rotation (4 bits)
    ((data.eyebrowHorizontal & 0x0F) << 21) | // eyebrow horizontal spacing (4 bits)
    ((data.eyebrowVertical & 0x1F) << 25);

  buf[0x38] = eyebrowDetails & 0xFF;
  buf[0x39] = (eyebrowDetails >> 8) & 0xFF;
  buf[0x3A] = (eyebrowDetails >> 16) & 0xFF;
  buf[0x3B] = (eyebrowDetails >> 24) & 0xFF;

  // nose details: type, size, vertical position
  /** nose vertical position (5 bits) */
  const noseDetails = (data.noseType & 0x1F) | // nose type (5 bits)
    ((data.noseSize & 0x0F) << 5) | // nose size (4 bits)
    ((data.noseVertical & 0x1F) << 9);

  buf[0x3C] = noseDetails & 0xFF;
  buf[0x3D] = (noseDetails >> 8) & 0xFF;

  // mouth details: type, color, size, stretch
  /** mouth stretch (3 bits) */
  const mouthDetails = (data.mouthType & 0x3F) | // mouth type (6 bits)
    ((data.mouthColor & 0x07) << 6) | // mouth color (3 bits)
    ((data.mouthSize & 0x0F) << 9) | // mouth size (4 bits)
    ((data.mouthStretch & 0x07) << 13);

  buf[0x3E] = mouthDetails & 0xFF;
  buf[0x3F] = (mouthDetails >> 8) & 0xFF;

  // mouth2 details: vertical position, mustache type
  /** mustache type (3 bits) */
  const mouth2Details = (data.mouthVertical & 0x1F) | // mouth vertical position (5 bits)
    ((data.facialHairMustache & 0x07) << 5);

  buf[0x40] = mouth2Details & 0xFF;
  buf[0x41] = (mouth2Details >> 8) & 0xFF;

  // beard details: type, color, size, vertical position
  /** beard vertical position (5 bits) */
  const beardDetails = (data.facialHairBeard & 0x07) | // beard type (3 bits)
    ((data.facialHairColor & 0x07) << 3) | // beard color (3 bits)
    ((data.facialHairSize & 0x0F) << 6) | // beard size (4 bits)
    ((data.facialHairVertical & 0x1F) << 10);

  buf[0x42] = beardDetails & 0xFF;
  buf[0x43] = (beardDetails >> 8) & 0xFF;

  // glasses details: type, color, size, vertical position
  /** glasses vertical position (4 bits) */
  const glassesDetails = (data.glassesType & 0x0F) | // glasses type (4 bits)
    ((data.glassesColor & 0x07) << 4) | // glasses color (3 bits)
    ((data.glassesSize & 0x0F) << 7) | // glasses size (4 bits)
    (data.glassesVertical << 11);

  buf[0x44] = glassesDetails & 0xFF;
  buf[0x45] = (glassesDetails >> 8) & 0xFF;

  // mole details: enable, size, horizontal position, vertical position
  /** mole vertical position (5 bits) */
  const moleDetails = (data.moleEnable & 0x01) | // mole enabled (1 bit)
    ((data.moleSize & 0x0F) << 1) | // mole size (4 bits)
    ((data.moleHorizontal & 0x1F) << 5) | // mole horizontal position (5 bits)
    ((data.moleVertical & 0x1F) << 10);

  buf[0x46] = moleDetails & 0xFF;
  buf[0x47] = (moleDetails >> 8) & 0xFF;

  // creator name (optional), UTF-16LE encoded
  if (data.creatorName !== undefined) {
    const creatorNameBytes = new Uint8Array(new ArrayBuffer(20));
    const creatorNameBytesView = new DataView(creatorNameBytes.buffer);
    for (let i = 0; i < 10; i++) { // only copy 10 characters, last one is padding
      const u16Offset = i * 2;
      creatorNameBytesView.setUint16(u16Offset,
        data.creatorName.charCodeAt(i), true); // little-endian UTF-16
    }
    buf.set(creatorNameBytes, 0x48);
  }

  // padding2 which should always be zero
  buf[0x5C] = data.padding2 & 0xFF;
  buf[0x5D] = (data.padding2 >> 8) & 0xFF;

  // SET CRC16 CHECKSUM
  // crc all before last two bytes
  const calculatedCRC16 = crc16(buf.slice(0, 94));
  // think MSB and LSB are reversed here but eh
  buf[0x5E] = (calculatedCRC16 >> 8) & 0xFF;
  buf[0x5F] = calculatedCRC16 & 0xFF;

  return buf; // return the buffer containing the encoded StoreData
};

/**
 * Obfuscation code from: https://mii-studio.akamaized.net/static/js/editor.pc.46056ea432a4ef3974af.js
 * Search ".prototype.encode".
 * @param {Uint8Array} src - 46-byte source data before obfuscation.
 * @param {Uint8Array} [dst] - 47-byte destination.
 * @param {number} [seed] - Random byte value to use for obfuscation.
 * @returns {Uint8Array} Destination array.
 */
function studioURLObfuscationEncode(src, dst, seed = 0) {
  if (!dst) {
    dst = new Uint8Array(STUDIO_OBFUSCATED_LENGTH); // sizeof(charInfoStudio) + 1
  }

  // Store the seed at index 0 of destination.
  dst[0] = seed;
  // Use seed as initial previous value.
  let previous = seed;
  // iterate over the source array length
  for (let i = 0; i < 46; i++) { // 46 = sizeof(charInfoStudio)
    const current = src[i];
    // XOR the current value with the previous one, add 7, then take modulo 256
    dst[i + 1] = (7 + (current ^ previous)) % 256;
    // update the previous value to the current encoded value
    previous = dst[i + 1];
  }
  return dst;
}

/**
 * Obfuscates raw Studio data using {@link studioURLObfuscationEncode}
 * and then returns the result as a hex string.
 * @param {Uint8Array} src - 46-byte source data before obfuscation.
 * @param {number} [seed] - Random byte value to use for obfuscation.
 * @returns {string} Obfuscated hex string to use in a Studio API URL.
 */
const studioURLEncodeHex = (src, seed = 0) =>
  bytesToHex(studioURLObfuscationEncode(src, undefined, seed));

/**
 * deobfuscate the obfuscated studio url format
 * from, and to, a Uint8Array (so requires converting from/to hex)
 * @param {Array<number>|Uint8Array} dst
 * @param {Array<number>|Uint8Array} src
 */
function studioURLObfuscationDecode(dst, src) {
  const seed = src[0];
  let previous = seed;

  for (let i = 1; i < STUDIO_OBFUSCATED_LENGTH; i++) {
    const encodedByte = src[i];
    const original = (encodedByte - 7 + 256) % 256;
    dst[i - 1] = original ^ previous;
    previous = encodedByte;
  }
}

const wrapVer3StoreDataForQR = async (/** @type {Uint8Array} */ data) => {
  const out = new Uint8Array(WrappedMiiDataLength);
  await (new WrappedMiiDataSubtle(KeySlot0x31Keys[KeyType.Production]))
    .encrypt(out, data);
  return out;
};

// #endregion

// current name of studio kaitai struct class being used
const studioFormat = /** @type {FormatDefinition} */ (supportedFormats.find(f => f.className === 'Gen3Studio'));
const ver3Format = /** @type {FormatDefinition} */ (supportedFormats.find(f => f.className === 'Gen2Wiiu3dsMiitomo'));
console.assert(studioFormat !== undefined && ver3Format !== undefined);

// TODO ORGANIZE THIS BETTER
const coreFormat = /** @type {FormatDefinition} */ (supportedFormats.find(f => f.className === 'Gen3Switch'));
const charInfoFormat = /** @type {FormatDefinition} */ (supportedFormats.find(f => f.className === 'Gen3Switchgame'));

export {
  convertDataToType,
  supportedFormats,
  studioFormat,
  ver3Format,
  coreFormat,
  charInfoFormat,
  studioURLObfuscationEncode,
  studioURLEncodeHex,
  parseTomodachiLifeQRCodeData,
  DEFAULT_NAME_IF_NONE,
  // for tests:
  removeEverythingAfterNullTerminator,
  wrapVer3StoreDataForQR,
  encode3DSStoreDataFromStruct,
  findInputFormatFromSize,
  studioURLObfuscationDecode,
  createNewInstanceOfKaitaiStructFormat
};
