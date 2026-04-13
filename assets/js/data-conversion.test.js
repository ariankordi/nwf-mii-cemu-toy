// @ts-check

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { parse } from 'csv-parse/sync';
import * as conv from './data-conversion.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// const data = conv.convertDataToType(new Uint8Array(), conv.ver3Format, 'Gen1Wii', true);
// console.log(data);

// #region Utility: Base64 -> U8, Hex -> U8, U8 -> Hex
// // ---------------------------------------------------------------------
// //  Utility: Base64 -> U8, Hex -> U8, U8 -> Hex
// // ---------------------------------------------------------------------
// Merge to class: CodecUtility, TextCodingUtil, TextCodec

/**
 * Base64 -> U8 / https://stackoverflow.com/a/41106346
 * @param {string} base64 - Input Base64 data to decode.
 * @returns {Uint8Array} Decoded input data.
 */
const base64ToBytes = base64 => Uint8Array.from(atob(base64), c => c.charCodeAt(0));
/**
 * Hex -> U8
 * @param {string} hex - Input hex data to decode.
 * @returns {Uint8Array} Decoded input data.
 */
const hexToBytes = hex => Uint8Array.from({ length: hex.length >>> 1 }, (_, i) =>
  Number.parseInt(hex.slice(i << 1, (i << 1) + 2), 16));

/**
 * U8 -> Hex / https://www.xaymar.com/articles/2020/12/08/fastest-uint8array-to-hex-string-conversion-in-javascript/
 * @param {Array<number>|Uint8Array} bytes - Input data to encode.
 * @returns {string} Hexadecimal representation of `buffer`.
 */
const bytesToHex = bytes => Array.prototype.map.call(bytes,
  (/** @type {{ toString: (arg0: number) => string; }} */ x) =>
    x.toString(16).padStart(2, '0')).join(''); // padStart: ES2017

/**
 * U8 -> Base64
 * @param {Array<number>|Uint8Array} bytes - Input data to encode.
 * @returns {string} Base64 representation of `buffer`.
 */
// const bytesToBase64 = bytes =>
// fromCharCode should be compatible with Uint8Array, but its param type is number[].
//   btoa(String.fromCharCode.apply(null, /** @type {Array<number>} */ (bytes)));

/**
 * Base64 -> U8 function that also supports Base64URL
 * encoding, and adds padding if it is missing.
 * @param {string} base64 - Input Base64 or Base64URL data to decode.
 * @returns {Uint8Array} Decoded input data.
 */
function base64ExToBytes(base64) {
  // Replace URL-safe characters with regular Base64 equivalents.
  base64 = base64.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding to the Base64 string if it is missing.
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return base64ToBytes(base64);
}

// #endregion

class TestUtility {
  /**
   * Compare two Uint8Array buffers as hex strings.
   * @param {Uint8Array} a - First buffer to compare.
   * @param {Uint8Array} b - Second buffer to compare.
   */
  static expectBuffersEqual(a, b) {
    const hexA = bytesToHex(a);
    const hexB = bytesToHex(b);
    expect(hexA).toBe(hexB);
  }

  /**
   * Fills the specified range of the array with a repeating 2-byte pattern (e.g., 0x5A, 0xFE).
   * @param {Uint8Array} buffer - The target byte array to mutate.
   * @param {number} start - Inclusive start offset.
   * @param {number} end - Exclusive end offset.
   * @param {number} byte1 - First byte of the repeating pattern (default: 0x5A).
   * @param {number} byte2 - Second byte of the repeating pattern (default: 0xFE).
   */
  static fillPattern(buffer, start, end,
    // byte1 = 0x5A, byte2 = 0xFE) {
    byte1 = 0xFF, byte2 = 0xFF) {
    for (let i = start; i < end; i++) {
      buffer[i] = (i % 2 === 0) ? byte1 : byte2;
    }
  }

  /**
   * Sets all bytes in the given range to zero.
   * @param {Uint8Array} buffer - The target byte array to mutate.
   * @param {number} start - Inclusive start offset.
   * @param {number} end - Exclusive end offset.
   */
  static zeroRange(buffer, start, end) {
    for (let i = start; i < end; i++) {
      buffer[i] = 0x00;
    }
  }
}

/**
 * Each element is an instance of a test character
 * with multiple data representations for conversion.
 * Data conversion methods:
 * - Ver3StoreData -> Studio: Using NA Mii Studio import from NNID.
 * - Ver3StoreData -> CoreData: Miitomo from QR code
 * -  (Or, import to Studio, and see Nintendo Account API "coreData" with INVALID CREATEID)
 * - Studio Seed 0: Using own obfuscation function from raw.
 * - Studio -> Ver3StoreData: Set Studio Mii as primary, see Nintendo Account API
 * - Switch (StoreData) -> Ver3StoreData: From amiibo (NfpStoreData)
 * - RFLCharData -> Ver3StoreData: Wii U vWii to Mii Maker import
 * Unofficial methods:
 * - Switch (StoreData) -> Studio: data-conversion.js
 * - nn::mii::CharInfo -> CoreData: In C with mii_ext.h headers
 * -  (SHOULD USE nn::mii::detail::StoreDataRaw::BuildWithCharInfo)
 * - Ver3StoreData -> CharInfo: In C with mii_ext.h headers
 * @typedef {Object} TestDataTableElement
 * @property {string} label - Name and source for this character.
 * @property {string} details - Description of this character's role in testing (known quirks).
 * @property {string} ver3StoreData - Base64 Ver3StoreData (3DS/Wii U)
 * @property {string} [nnmiiCoreData] - Base64 nn::mii::CoreData (Switch/Miitomo internal)
 * @property {string} [studioCharInfo] - Hex studio.mii.nintendo.com data before obfuscation
 * @property {string} [studioURLSeed0] - Hex obfuscated Studio URL data (obfucated with seed 0)
 * @property {string} [nnmiiCharInfo] - Hex nn::mii::CharInfo (Switch)
 * @property {string} [nfpStoreData] - Base64 nn::mii::NfpStoreData (Ver3StoreData + NfpStoreDataExtention)
 * TODO: Should we have the full thing, or just NfpStoreDataExtention? Only if the two match. I guess.
 * @property {string} [rflCharData] - Hex RFLCharData (Wii)
 */

/** @type {Array<TestDataTableElement>} */
const testDataTable = parse(
  fs.readFileSync(
    path.join(__dirname, '../test-fixtures/conversion-test-data.csv'), 'utf8'),
  {
    columns: true,
    skip_empty_lines: true
  });

/** @type {Array<TestDataTableElement>} */
const testDataTableFromNX = parse(
  fs.readFileSync(
    path.join(__dirname, '../test-fixtures/conv-from-nx.csv'), 'utf8'),
  {
    columns: true,
    skip_empty_lines: true
  });

/**
 * Base64-encoded wrapped/encrypted version of {@link testVer3StoreDataForWrap}.
 * "Miyamoto" Special Mii (CreateID is from 3DS, so it won't scan on Wii U)
 * found in manuals of some 3DS games. Source: https://nintendoeverything.com/shigeru-miyamoto-gold-mii-qr-code-for-3ds/
 * @type {string}
 */
const testWrappedStoreData = 'FQ++DaTA4XEELAe3dJG/VmELi17q3n9U6WxslpDpDBFvMmnPuh21+rkNSEhLIeYacekfvuETNiF7d+UHO/tvFqyv79MDlpOWtY4SMxgMkZpkWTpFpBNr3jp7RWigeSsW+DSJBDpBFMI/KcaXiTpPpw==';

/** Base64-encoded Ver3StoreData reflecting the decrypted version of {@link testWrappedStoreData} */
const testVer3StoreDataForWrap = 'AwAwMAAAAAAAAAAAFQ++DaTA4XF8tQAAAABNAGkAeQBhAG0AbwB0AG8AAAAAAD5AI5JCABdERBoWYkcURBIRSg0AACkAUkhQTgBpAG4AdABlAG4AZABvAAAAAAAAAOmh';

class Normalize {
  /** @param {Uint8Array} buffer - Ver3StoreData to normalize. */
  static ver3NormalizeExclusiveFields(buffer) {
    // personal

    // birthPlatform = 3
    buffer[3] = buffer[3] & 0b10001111 | 0b00110000;
    buffer[1] |= 1; // copyable = 1

    // bitfields 0x01, 0x02, 0x03
    buffer[1] &= ~0x2; // ngWord = 0 (no)
    buffer[1] &= 0xF3; // regionMove = 0 (all)
    buffer[2] &= 0xF0; // roomIndex = 0 (set on ctr)
    buffer[2] &= 0x0F; // positionInRoom = 0 (set on ctr)
    buffer[3] &= 0xF0; // authorType = 0 ("normal" - unused)
  }

  /** @param {Uint8Array} buffer - Ver3StoreData to normalize. */
  static ver3NormalizeForNX(buffer) {
    this.ver3NormalizeExclusiveFields(buffer);
    // personal

    // bitfield 0x01
    buffer[1] &= 0xCF; // fontRegion = 0 (jp_us_eu)
    // bitfields 0x18, 0x19
    buffer[0x18] &= 0xE1; // birthMonth = 0 (unset)
    buffer[0x18] &= 0x1F; // birthDay = 0 (unset)
    buffer[0x19] &= 0xFC; // birthDay
    buffer[0x19] &= ~0x40; // favorite = 0 (no)
    // bitfield 0x30
    buffer[0x30] &= ~0x1; // localonly = 0 (enable mingling/sharing)

    // Set AuthorID and CreateID - get randomized on destination
    TestUtility.fillPattern(buffer, 0x04, 0x16);
    // TODO: MAKE SURE CreateID IS NORMAL AND WII U, AND BASE IS NOT Nintendo MAC ADDRESS

    TestUtility.fillPattern(buffer, 0x5E, 0x60); // CRC-16 checksum.
  }

  /** @param {Uint8Array} buffer - nn::mii::CharInfo to normalize. */
  static nnmiiCharInfoNormalize(buffer) {
    // Set CreateID which gets normalized on destination.
    TestUtility.fillPattern(buffer, 0x0, 0x10);
  }
}

/**
 * @param {TestDataTableElement} entry
 * @param {boolean} [fromNX]
 */
const testConvEntry = (entry, fromNX = false) => () => {
  /** @type {Uint8Array} */ const srcBytes = new Uint8Array(96);
  /** @type {Uint8Array} */ let expectedCore;
  /** @type {Uint8Array} */ let expectedStudio;

  beforeAll(() => {
    // Prepare byte buffers once per entry.
    const src = base64ToBytes(entry.ver3StoreData);
    expect(src.length).toBeGreaterThanOrEqual(92); // .toHaveLength(96);
    srcBytes.set(src);

    if (entry.nnmiiCoreData) {
      expectedCore = base64ExToBytes(entry.nnmiiCoreData);
      expect(expectedCore).toHaveLength(48);
    }

    if (entry.studioCharInfo) {
      expectedStudio = hexToBytes(entry.studioCharInfo);
      expect(expectedStudio).toHaveLength(46);
    }
    /*
      if (entry.studioURLSeed0) {
        expectedURL = hexToBytes(entry.studioURLSeed0);
        expect(expectedURL).toHaveLength(47);
      }
      */
  });

  if (entry.rflCharData) {
    it('converts RFLCharData (Wii) -> Ver3StoreData', () => {
      /** @param {Uint8Array} buffer - Ver3StoreData to normalize. */
      function normalize(buffer) {
        Normalize.ver3NormalizeExclusiveFields(buffer);

        // bitfield 0x01
        buffer[1] &= 0xCF; // fontRegion = 0 (jp_us_eu)

        // Zero out part of CreateID exlusive to Ver3StoreData.
        TestUtility.zeroRange(buffer, 0x14, 0x16); // CreateID last 2 bytes
        // TODO: Last 2 bytes are SUPPOSED TO BE a CRC-16 of the AuthorID.
        // Not sure how to implement this if we don't "know" what
        // the AuthorID is supposed to be. Perhaps let the RFL->Ver3
        // function specify the AuthorID in case they know it?
        TestUtility.fillPattern(buffer, 0x04, 0x0C); // AuthorID

        TestUtility.fillPattern(buffer, 0x5E, 0x60); // CRC-16 checksum.
      }

      const rawRfl = hexToBytes(/** @type {string} */(entry.rflCharData));
      const roundTrip = conv.convertDataToType(rawRfl, conv.ver3Format, null, false);

      /** Source bytes copied for normalization. */
      const srcBytesForCompare = new Uint8Array(srcBytes.length);
      srcBytesForCompare.set(srcBytes);
      normalize(srcBytesForCompare);
      normalize(roundTrip);

      TestUtility.expectBuffersEqual(roundTrip, srcBytesForCompare);
    });
  }
  // rflCharData

  if (entry.studioCharInfo) {
    if (!fromNX) {
      it('converts Ver3StoreData -> Studio CharInfo', () => {
        const studio = conv.convertDataToType(srcBytes, conv.studioFormat, null);

        TestUtility.expectBuffersEqual(studio, expectedStudio);
      });
    }

    it('converts Studio CharInfo -> Ver3StoreData', () => {
      // TODO: convertVer4FieldsToVer3
      /**
       * Normalize converted from/to test data so that
       * fields not present on the source or destination
       * will not be compared against.
       * @param {Uint8Array} buffer - Ver3StoreData to normalize.
       */
      function normalize(buffer) {
        Normalize.ver3NormalizeForNX(buffer);
        // Set name - gets overwritten with "Mii" on destination.
        TestUtility.fillPattern(buffer, 0x1A, 0x2E);
        TestUtility.fillPattern(buffer, 0x48, 0x5C); // Creator name.
      }

      const roundTrip = conv.convertDataToType(expectedStudio, conv.ver3Format, null, false);

      // Set copyable to 1 for source - always gets set to 1 in destinati

      /** Source bytes copied for normalization. */
      const srcBytesForCompare = new Uint8Array(srcBytes.length);
      srcBytesForCompare.set(srcBytes);
      normalize(srcBytesForCompare);
      normalize(roundTrip);

      TestUtility.expectBuffersEqual(roundTrip, srcBytesForCompare);
    });
  }
  // studioCharInfo

  if (entry.nnmiiCoreData && !fromNX) {
    it('converts nn::mii::CoreData -> Ver3StoreData', () => {
      // TODO: convertVer4FieldsToVer3
      /**
       * Normalize converted from/to test data so that
       * fields not present on the source or destination
       * will not be compared against.
       * @param {Uint8Array} buffer - Ver3StoreData to normalize.
       */
      function normalize(buffer) {
        Normalize.ver3NormalizeForNX(buffer);

        // zero out AFTER NAME FIRST utf-16le character
        // account for continuity termination, all
        // names always have at least one character
        TestUtility.zeroRange(buffer, 0x1C, 0x2D);

        TestUtility.fillPattern(buffer, 0x48, 0x5C); // Creator name.
      }

      const roundTrip = conv.convertDataToType(expectedCore, conv.ver3Format, null, false);

      // TODO: Continuity Termination

      /** Source bytes copied for normalization. */
      const srcBytesForCompare = new Uint8Array(srcBytes.length);
      srcBytesForCompare.set(srcBytes);
      normalize(srcBytesForCompare);
      normalize(roundTrip);

      TestUtility.expectBuffersEqual(roundTrip, srcBytesForCompare);
    });
  }
  // nnmiiCoreData

  if (entry.studioURLSeed0) {
    /*
      it('applies Studio URL obfuscation (seed = 0)', () => {
        // First convert Ver3 -> Studio binary
        const studioRaw = conv.convertDataToType(srcBytes, conv.studioFormat, 'Gen2Wiiu3dsMiitomo', false);
        // Then obfuscate to URL bytes, and compare
        const expectedURLHex = conv.studioURLEncodeHex(studioRaw, 0);
        expect(expectedURLHex).toBe(entry.studioURLSeed0);
      });
      */
    // TODO split into encode and decode

    it('decodes Studio URL (seed=0) and re-encodes to same', () => {
      // Convert hex to bytes
      const obfuscatedBytes = hexToBytes(/** @type {string} */(entry.studioURLSeed0));
      // Decode Studio URL back to raw studio data
      const studioRaw = conv.convertDataToType(obfuscatedBytes, conv.studioFormat, null);

      // Then obfuscate to URL bytes, and compare
      const expectedURLHex = conv.studioURLEncodeHex(studioRaw, 0);
      expect(expectedURLHex).toBe(entry.studioURLSeed0);
    });
  }
  // studioURLSeed0

  if (entry.nnmiiCharInfo && !fromNX) {
    it('converts nn::mii::CoreData -> nn::mii::CharInfo', () => {
      const expectedCharInfo = hexToBytes(/** @type {string} */(entry.nnmiiCharInfo));
      const actualCharInfo = conv.convertDataToType(expectedCore,
        conv.charInfoFormat, null, false);
      Normalize.nnmiiCharInfoNormalize(expectedCharInfo);
      Normalize.nnmiiCharInfoNormalize(actualCharInfo);

      // TODO:
      // - create id, name, ACTUALLY FILL THIS IN LATER L OL
      TestUtility.expectBuffersEqual(actualCharInfo, expectedCharInfo);
    });
  }
  // cannot convert back to CharInfo, due to not being able to encode CoreData
  // nnmiiCharInfo

  if (entry.nfpStoreData && entry.nnmiiCharInfo) {
    it('converts NfpStoreData -> CharInfo', () => {
      const nfpBytes = base64ExToBytes(/** @type {string} */(entry.nfpStoreData));
      const expectedCharInfo = hexToBytes(/** @type {string} */(entry.nnmiiCharInfo));
      const actualCharInfo = conv.convertDataToType(nfpBytes, conv.charInfoFormat, null, false);
      Normalize.nnmiiCharInfoNormalize(expectedCharInfo);
      Normalize.nnmiiCharInfoNormalize(actualCharInfo);

      TestUtility.expectBuffersEqual(actualCharInfo, expectedCharInfo);
    });
  }
  // nfpStoreData
};

describe('Mii data cross-conversion tests', () => {
  for (const entry of testDataTable) {
    if (!entry.label) {
      if (entry.details) {
        console.info(entry.details);
      }
      continue;
    }

    const name = `${entry.label} / ${entry.details}`;
    describe(name, testConvEntry(entry));
    // describe
  }
  // testDataTable.forEach

  for (const entry of testDataTableFromNX) {
    const name = `${entry.label} / ${entry.details}`;
    describe(name, testConvEntry(entry, /* fromNX */ true));
    // describe
  }
  // testDataTableFromNX.forEach

  // Individual cases.

  describe('QR code encryption wrapping tests', () => {
    it('encodes Ver3StoreData and wraps for QR code correctly', () => {
      // Expected wrapped/encrypted QR code data.
      const expectedQR = base64ToBytes(testWrappedStoreData);
      // Get the raw Ver3StoreData.
      const rawData = base64ToBytes(testVer3StoreDataForWrap);
      // Convert to object, and then back to StoreData.
      const obj = conv
        .createNewInstanceOfKaitaiStructFormat(conv.ver3Format, rawData);
      const convData = conv.encode3DSStoreDataFromStruct(obj, true);
      // Wrap the raw Ver3StoreData.
      const wrapped = new Uint8Array(conv.wrapVer3StoreDataForQR(convData));

      TestUtility.expectBuffersEqual(wrapped, expectedQR);
    });
  });

  describe('Ver3 CreateID tests', () => {
    // Guest A / "no name" - a normal Wii U Mii.
    // avatarId[0] = 0x80: bit7 set (normal mii), bit5 clear (not temporary).
    const normalVer3 = 'AwAAQAAAAAAAAAAAgAAAAOz/gtIAAAAAABBuAG8AIABuAGEAbQBlAAAAAAAAAEBAgQBEAAJoRBgGNEYUgRIXaA0AACkAUkhQAAAAAAAAAAAAAAAAAAAAAAAAAAAAALQV';

    it('clears temporary flag (bit 5) when encoding', () => {
      // Set bit 5 in avatarId[0] in the raw bytes before encoding.
      const src = base64ToBytes(normalVer3);
      src[0x0C] |= 0b00100000; // FFLI_CREATE_ID_FLAG_TEMPORARY

      const encoded = conv.convertDataToType(src, conv.ver3Format, null, true);
      const out = conv.createNewInstanceOfKaitaiStructFormat(conv.ver3Format, encoded);
      expect(out.avatarId[0] & 0b00100000).toBe(0);
    });

    it('assigns normal/Wii U createid when only temporary flag was set (treated as null)', () => {
      // avatarId[0] = 0x20: only the temporary bit. After clearing it becomes 0,
      // so isArrayNull fires and a fresh normal/Wii U createid is generated.
      const src = base64ToBytes(normalVer3);
      src[0x0C] = 0b00100000;
      // Zero out the rest of the createid (avatarId bytes 1-3 + clientId).
      TestUtility.zeroRange(src, 0x0D, 0x16);

      const encoded = conv.convertDataToType(src, conv.ver3Format, null, true);
      const out = conv.createNewInstanceOfKaitaiStructFormat(conv.ver3Format, encoded);
      // Normal/Wii U: bits 7, 6, 4 set (0b11010000 = 0xD0).
      expect(out.avatarId[0] & 0b11010000).toBe(0b11010000);
      expect(out.avatarId[0] & 0b00100000).toBe(0); // still no temporary bit
    });

    it('assigns normal/Wii U createid when createid is fully null', () => {
      const src = base64ToBytes(normalVer3);
      // Zero out avatarId (0x0C-0x0F) and clientId (0x10-0x15).
      TestUtility.zeroRange(src, 0x0C, 0x16);

      const encoded = conv.convertDataToType(src, conv.ver3Format, null, true);
      const out = conv.createNewInstanceOfKaitaiStructFormat(conv.ver3Format, encoded);
      expect(out.avatarId[0] & 0b11010000).toBe(0b11010000);
    });

    it('preserves Special Mii createid (Miyamoto, 3DS origin)', () => {
      // Miyamoto: avatarId[0] = 0x15 (non-zero, bit7=0 -> special mii).
      // Encoding should not reassign the createid.
      const src = base64ToBytes(testVer3StoreDataForWrap);
      expect(src[0x0C]).toBe(0x15); // sanity-check fixture

      const encoded = conv.convertDataToType(src, conv.ver3Format, null, true);
      const out = conv.createNewInstanceOfKaitaiStructFormat(conv.ver3Format, encoded);
      expect(out.avatarId[0]).toBe(0x15);
    });
  });

  describe('Library-specific behavior tests', () => {
    it('fills null name with default when encoding to CharInfo', () => {
      // Ver3StoreData with an all-zero name field.
      const emptyNameVer3 = base64ToBytes('AwAAQAAAAAAAAAAAgAAAAOz/gtIAAAAAABBuAG8AIABuAGEAbQBlAAAAAAAAAEBAgQBEAAJoRBgGNEYUgRIXaA0AACkAUkhQAAAAAAAAAAAAAAAAAAAAAAAAAAAAALQV');
      const studio = conv.convertDataToType(emptyNameVer3, conv.studioFormat);
      const charInfo = conv.convertDataToType(studio, conv.charInfoFormat);

      const out = conv.createNewInstanceOfKaitaiStructFormat(conv.charInfoFormat, charInfo);
      expect(/** @type {string} */ (out.miiName).slice(0, 3)).toBe('Mii');
    });

    it('encodes Studio URL with seed byte and decodes back to same data', () => {
      // Fixed test vector: alternating 0xA5/0x5A pattern over 46 bytes.
      const studioRaw = new Uint8Array(46);
      TestUtility.fillPattern(studioRaw, 0, 46, 0xA5, 0x5A);

      // Encode with seed 42
      const encoded = conv.studioURLObfuscationEncode(studioRaw, undefined, 42);
      expect(encoded.length).toBe(47);
      expect(encoded[0]).toBe(42); // seed is first byte

      // Decode back to raw
      const decoded = new Uint8Array(46);
      conv.studioURLObfuscationDecode(decoded, encoded);
      TestUtility.expectBuffersEqual(decoded, studioRaw);
    });
  });

  describe('nn::mii::CharInfo pedantic tests', () => {
    it('generates valid createid from all-zero CoreData', () => {
      const emptyCore = new Uint8Array(48); // Empty nn::mii::CoreData
      const charInfo = conv.convertDataToType(emptyCore, conv.charInfoFormat, 'Gen3Switch');

      // CreateID should be 16 random bytes with proper UUIDv4 bits
      const out = conv.createNewInstanceOfKaitaiStructFormat(conv.charInfoFormat, charInfo);
      const createId = /** @type {Uint8Array} */ (out.unknownData).slice(0, 16);

      // Version 4 UUID: bits 12-15 of first octet should be 0100
      // NOTE: nn::mii does NOT STRICTLY check this
      // expect((createId[6] & 0xF0) >> 4).toBe(4);

      // clock_seq_hi_and_reserved: two high bits must be 10 (RFC 4122 / nn::mii::CreateId::IsValid).
      expect(createId[8] & 0xC0).toBe(0x80);
    });

    it('continuously terminates name after first null character', () => {
      const input = 'Should\u0000Not';

      // Ver3StoreData with an all-zero name field.
      const emptyNameVer3 = base64ToBytes('AwAAQAAAAAAAAAAAgAAAAOz/gtIAAAAAABBuAG8AIABuAGEAbQBlAAAAAAAAAEBAgQBEAAJoRBgGNEYUgRIXaA0AACkAUkhQAAAAAAAAAAAAAAAAAAAAAAAAAAAAALQV');

      const nameBuffer = new Uint16Array(emptyNameVer3.buffer, 0x1A, 0x20);
      for (let i = 0; i < input.length; i++) {
        nameBuffer[i] = input.charCodeAt(i);
      }

      const charInfo = conv.convertDataToType(emptyNameVer3, conv.charInfoFormat);
      const out = conv.createNewInstanceOfKaitaiStructFormat(conv.charInfoFormat, charInfo);

      // Every character from the null onward must be replaced with null.
      expect(out.miiName).toBe('Should\u0000\u0000\u0000\u0000');
    });
  });

  // describe
});
