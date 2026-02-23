// @ts-check

/* eslint-disable no-undef -- Need to define globalThis as a HACK for data-conversion.js. */
globalThis.structsObj = {
  Gen1Wii: require('./kaitai-structs/js/Gen1Wii.js'),
  Gen3Switch: require('./kaitai-structs/js/Gen3Switch.js'),
  Gen3Switchgame: require('./kaitai-structs/js/Gen3Switchgame.js'),
  Gen2Wiiu3dsMiitomo: require('./kaitai-structs/js/Gen2Wiiu3dsMiitomo.js'),
  Gen3Studio: require('./kaitai-structs/js/Gen3Studio.js')
};
/* eslint-enable no-undef -- Re-enabling */

const conv = require('./data-conversion.js');

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
  parseInt(hex.slice(i << 1, (i << 1) + 2), 16));

/**
 * U8 -> Hex / https://www.xaymar.com/articles/2020/12/08/fastest-uint8array-to-hex-string-conversion-in-javascript/
 * @param {Array<number>|Uint8Array} bytes - Input data to encode.
 * @returns {string} Hexadecimal representation of `buffer`.
 */
// const bytesToHex = bytes => Array.prototype.map.call(bytes,
//   (/** @type {{ toString: (arg0: number) => string; }} */ x) =>
//     x.toString(16).padStart(2, '0')).join(''); // padStart: ES2017

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

/**
 * Represents one character for test data.
 * Includes representations of the character, converted
 * across all formats using official tooling.
 * Exceptions:
 * - The only official conversions TO Studio are from Ver3. Others are by existing JS.
 * - RFLCharData is optional since it cannot be downgraded to.
 * - nn::mii::CoreData -> nn::mii::CharInfo is NOT official (TBD, use NintendoSDK?)
 * - TODO: CharInfo shall be included later or covered in a separate test.
 * @typedef {Object} TestDataTableElementt
 * @property {string} ver3StoreData - Base64
 * @property {string} nnmiiCoreData - Base64
 * @property {string} studioCharInfo - Hex
 * @property {string} studioURLSeed0 - Hex
 * @property {string} [rflCharData] - Hex
 */ // @property {string} nnmiiCharInfo
//*/

/** @type {Array<TestDataTableElement>} */
// const testDataTablee = [
// "Jasmine", from NNID: JasmineChlora

/**
 * Each element is an instance of a test character
 * with multiple data representations for conversion.
 * Data conversion methods:
 * - Ver3StoreData -> Studio: Using NA Mii Studio import from NNID.
 * - Ver3StoreData -> CoreData: Miitomo from QR code
 * -  (Or, import to Studio, and see Nintendo Account API "coreData")
 * - Studio Seed 0: Using own obfuscation function from raw.
 * - Studio -> Ver3StoreData: Set Studio Mii as primary, see Nintendo Account API
 * - Switch (StoreData) -> Ver3StoreData: From amiibo (NfpStoreData)
 * - RFLCharData -> Ver3StoreData: Wii U vWii to Mii Maker import
 * Unofficial methods:
 * - Switch (StoreData) -> Studio: data-conversion.js
 * - nn::mii::CharInfo -> CoreData: In C with mii_ext.h headers
 * -  (SHOULD USE nn::mii::detail::StoreDataRaw::BuildWithCharInfo)
 * @typedef {Object} TestDataTableElement
 * @property {string} [label] - Name and source for this character.
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

/** @type {TestDataTableElement[]} */
const testDataTable = [
  // 1) "Jasmine" from NNID: JasmineChlora
  {
    ver3StoreData: 'AwAAQKBBOMSghAAA27iHMb5gKyoqQgAAWS1KAGEAcwBtAGkAbgBlAAAAAAAAABw3EhB7ASFuQxwNZMcYAAgegg0AMEGzW4JtAABvAHMAaQBnAG8AbgBhAGwAAAAAAJA6',
    nnmiiCoreData: 'exw3AYgIEwYQIR7uDQCEzXBr7BsDmwAhdJYQFEoAYQBzAG0AaQBuAGUAAAAAAAAA',
    studioCharInfo: '0600370308030721020e060807040d060c000109000b011007030b01007b1c01000c1b0413011e0d040010000004',
    studioURLSeed0: '000d142a303f434b717a7b84939ba6b2bbbec5cbc9d0e2ea010d15252b3250535960736f726870757f8289a0a7aeb1',
    details: 'Standard NNID import; no known anomalies.'
  },

  // 2) "All" from Exzap’s FFL_ODB (identical dual samples)
  {
    ver3StoreData: 'AwAAQAAAAAAAAAAA2JXdtJBltjwAAAAAAEBBAGwAbAAAAEEATQBFAAAAAAAAAGN/RmVrASdogyX1NEYUoQAXijAABSk1UklQRQBYAAAAAAAAAAAAAAAAAAAAAAA=',
    nnmiiCoreData: 'a-N_AQgHEwgQJxeSNaGAcGpqghQFMFLGZHJVREEAbABsAAAAAAAAAAAAAAAAAAAA',
    studioCharInfo: '08057f03080304270c120307060415020a0206030500001004050a01006b6304010214041305171004010a050100',
    studioURLSeed0: '000f11757d7c8689b5c0d9e1edf2fdeff4050e0f131d242b424d4f4c545b375b666e736e7169736b828d93a0acb4bb',
    details: 'Exzap’s FFL meaning dual identical seeds; tests both branches.'
  },

  // 3) "Aiueome" from Super Mario Maker (Wii U): glass‑Y issue in Kaitai
  {
    ver3StoreData: 'AwEAMAAAAAAAAAAA2sZrOqTA4fgk3wAAABBBAGkAdQBlAG8AbQBlAAAAAAAAAH9/JwAuCXPOgxfsCIUfDyUY0GUAO0K2oxFSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGUq',
    nnmiiCoreData: 'Lv__AQkHEwcQMxjrbG_SBXDU8BQGNAHAWMyIiEEAaQB1AGUAbwBtAGUAAAAAAAAA',
    studioCharInfo: '07037f06090307330c0b000705080c0c0f0100030004001007061401012e7f080110140613081805080310080f12',
    studioURLSeed0: '000e14727b79818dc5d0e2e9f5f7061124323a4149505b6279858aa5abb1a6e0eff5ecff001a19081423273e3d3932',
    details: 'Known glass‑Y byte misorder in Gen2 Kaitai (@ lines ~145–147).'
  },

  // 4) "ニッキーん" (Nikki) from Swapnote memory
  {
    ver3StoreData: 'AwAAMAAAAAAAAAAAkPDiXNhr9xsyOQAAAUzLMMMwrTD8MAAAkzAAAAAAAAAAACMAAhB7BqFsZCQgE2YYABwFgg8AgDElgkhQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJVc',
    nnmiiCoreData: 'eyMABooBEwgPIQWSAACOL4xwwhQFEwAxY5MQRsswwzCtMPwwAAAAAAAAAAAAAAAA',
    studioCharInfo: '080000030a04062103120101060300030c0001010003010f04051006007b2304000214041301050f06000c00000e',
    studioURLSeed0: '000f161d253639466e746d7379868c9397a2a9afb5bcc6cec8d3ddd4d9e0a288939a9f929d959ba5b1bec5d0d7ded7',
    details: 'Japanese multibyte name; tests UTF-8 ↔ UCS‑2 edge cases.'
  },

  // 5) "Guest A" converted by CFL (missing CreateID fallback)
  {
    ver3StoreData: 'AwEAMAAAAAAAAAAAgAAAAOz/gtIAAAAAABBuAG8AIABuAGEAbQBlAAAAAAAAAEBAgQBEAAJoRBgGNEYUgRIXaA0AACkAUkhQAAAAAAAAAAAAAAAAAAAAAAAAAAAAALQV',
    nnmiiCoreData: 'REBACAgIEwgIAheMBgFpbYpqghQABAQgZHJERG4AbwAgAG4AYQBtAGUAAAAAAAAA',
    studioCharInfo: '0800400308040402020c0308060406020a0400000004000804000a0800444004000214031304170d04000a040109',
    studioURLSeed0: '000f165d6574777a7f848f93a2abb6b7bcbdc0c7ced5d8dfdee1e8e9e8efb2f9040b100b0f232e4054575e5b666e6e',
    details: 'No CreateID → tests default‑ID branch.'
  },

  // 6) “fuckyou” — mouth color 4 from Pretendo PID 1242980662
  {
    ver3StoreData: 'AwAAQOlVognnx0GC2qjhdwOzuI0n2QAAAERGAHUAYwBrACAAWQBPAFUAIQAAAAB/DiBMARvOgAEmaIAlAQUB0Q0AACkAUkhQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFPo',
    nnmiiCoreData: 'TAB_AQgBFwgIGwGABgHCzQrK4hQAcQDCCPyIREYAdQBjAGsAIABZAE8AVQAhAAAA',
    studioCharInfo: '08007f060800071b0c0006010008060c120002070001000804000a01004c0004000214061708010d04000a080102',
    studioURLSeed0: '000f16707d7c838b97a2a9b6bec5d4d9dcd5dce5e9f0f8fffe0108090f166168737a7f727b73828a8e91989998a0a9',
    details: 'Mouth‑color=4 branch; checks palette‑index path.'
  },

  // 7) Switch: “bro mole high” (multi‑platform consistency)
  {
    ver3StoreData: 'AwAAQN9uZ0eqxkc022v7dby8sBv4ogAAAARiAHIAbwAAAAAAAAAAAAAAAAAAAEBALJI5AgKJRBZmNEYQzRINSE8A4igiQolZAAAAAAAAAAAAAAAAAAAAAAAAAAAAACpP', // not applicable
    // Switch amiibo -> Ver3StoreData -> NNID to Studio -> CoreData (Nintendo Account API)
    //nnmiiCoreData: 'OcBAAgwDEwQPAg2LRk1Jb4qIjBYCYSEpZFJGQ2IAcgBvAAAAAAAAAAAAAAAAAAAA', // Name edited to "bro" like above
    // nfp -> charinfo -> coredata-conv.c
    nnmiiCoreData: 'OcBAAjEKEwQUAg2LRk1Jb4qIjBYCYScpZFJGQ2IAcgBvAAAAAAAAAAAAAAAAAAAA',
    studioCharInfo: '040240040c040402020b030306040602080109060201000f0402080200394004010c160213040d0f03020a060d09',
    studioURLSeed0: '000b10575a5d606b70797981899699a6abaab2c2cbd0d8dfd7dadfdee3eadaa1acb4bfb0b9b1bcb8bec4cdcecfc9c7',
    nnmiiCharInfo: '4a5cff0139882c43b96038e1d52db9fc620072006f000000000000000000000000000000000000010040400000060702093902000231040404020b060a04030602080d06090d1304020f040202030a0214040801040c1600',
    nfpStoreData: 'AwAAQBBIBC0Mr1zc32CnLCF3b7Mg9wAAAARiAHIAbwAAAAAAAAAAAAAAAAAAAEBALJI5AgKJRBZmNEYQzRINSE8A4igiQolZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIitBwIxChMEFAI=',
    details: 'Switch‑only sample; skip Ver3 tests, validate Studio → CoreData only.'
  },

  // 8) Wii RFLCharData: Guest A from original Wii
  {
    ver3StoreData: 'AwAAEOiHu+XgBGBQgAAAAOz/gtLmWwAAABBuAG8AIABuAGEAbQBlAAAAAAAAAEBAgQBEAAJoRBgGNEYUgRIXaA0AACkAUkhQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEd+',
    nnmiiCoreData: undefined,
    studioCharInfo: undefined,
    studioURLSeed0: undefined,
    rflCharData: '0008006E006F0020006E0061006D0065000000000000404080000000ECFF82D210048800318008A2088C0858144AB88D008A008A25040000000000000000000000000000000000000000',
    details: 'Legacy Wii → RFL conversion; test CreateID‑CRC logic.'
  }
];

/**
 * Base64-encoded wrapped/encrypted version of {@link testVer3StoreDataForWrap}.
 * "Miyamoto" Special Mii (CreateID is from 3DS, so it won't scan on Wii U)
 * found in manuals of some 3DS games. Source: https://nintendoeverything.com/shigeru-miyamoto-gold-mii-qr-code-for-3ds/
 * @type {string}
 */
const testWrappedStoreData = 'FQ++DaTA4XEELAe3dJG/VmELi17q3n9U6WxslpDpDBFvMmnPuh21+rkNSEhLIeYacekfvuETNiF7d+UHO/tvFqyv79MDlpOWtY4SMxgMkZpkWTpFpBNr3jp7RWigeSsW+DSJBDpBFMI/KcaXiTpPpw==';

/** Base64-encoded Ver3StoreData reflecting the decrypted version of {@link testWrappedStoreData} */
const testVer3StoreDataForWrap = 'AwAwMAAAAAAAAAAAFQ++DaTA4XF8tQAAAABNAGkAeQBhAG0AbwB0AG8AAAAAAD5AI5JCABdERBoWYkcURBIRSg0AACkAUkhQTgBpAG4AdABlAG4AZABvAAAAAAAAAOmh';

describe('data-conversion.js — full Mii format coverage', () => {
  /**
   * Compare two Uint8Array buffers as hex strings.
   * @param {Uint8Array} a - First buffer to compare.
   * @param {Uint8Array} b - Second buffer to compare.
   */
  function expectBuffersEqual(a, b) {
    const hexA = conv.bytesToHex(a);
    const hexB = conv.bytesToHex(b);
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
  function fillPattern(buffer, start, end,
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
  function zeroRange(buffer, start, end) {
    for (let i = start; i < end; i++) {
      buffer[i] = 0x00;
    }
  }

  /**
   * Gets the `className` of the format from an array of data.
   * @param {Array<number>|Uint8Array} data
   * @returns {string} The `className` of the data format.
   * @throws {Error} TODO find out what this throws on nulllll
   * @todo TODO: Handle nulls. OR just be fine with throwing error
   */
  // const formatFromData = data => conv.findInputFormatFromSize(data.length).className;

  /** @param {Uint8Array} buffer - Ver3StoreData to normalize. */
  function ver3NormalizeExclusiveFields(buffer) {
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
  function ver3NormalizeForNX(buffer) {
    ver3NormalizeExclusiveFields(buffer);
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
    fillPattern(buffer, 0x04, 0x16);
    // TODO: MAKE SURE CreateID IS NORMAL AND WII U, AND BASE IS NOT Nintendo MAC ADDRESS

    fillPattern(buffer, 0x5E, 0x60); // CRC-16 checksum.
  }

  /** @param {Uint8Array} buffer - nn::mii::CharInfo to normalize. */
  function nnmiiCharInfoNormalize(buffer) {
    // Set CreateID which gets normalized on destination.
    fillPattern(buffer, 0x0, 0x10);
  }

  testDataTable.forEach((entry) => {
    describe(entry.details, () => {
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
            ver3NormalizeExclusiveFields(buffer);

            // bitfield 0x01
            buffer[1] &= 0xCF; // fontRegion = 0 (jp_us_eu)

            // Zero out part of CreateID exlusive to Ver3StoreData.
            zeroRange(buffer, 0x14, 0x16); // CreateID last 2 bytes
            // TODO: Last 2 bytes are SUPPOSED TO BE a CRC-16 of the AuthorID.
            // Not sure how to implement this if we don't "know" what
            // the AuthorID is supposed to be. Perhaps let the RFL->Ver3
            // function specify the AuthorID in case they know it?
            fillPattern(buffer, 0x04, 0x0C); // AuthorID

            fillPattern(buffer, 0x5E, 0x60); // CRC-16 checksum.
          }

          const rawRfl = hexToBytes(/** @type {string} */ (entry.rflCharData));
          const roundTrip = conv.convertDataToType(rawRfl, conv.ver3Format, null, false);

          /** Source bytes copied for normalization. */
          const srcBytesForCompare = new Uint8Array(srcBytes.length);
          srcBytesForCompare.set(srcBytes);
          normalize(srcBytesForCompare);
          normalize(roundTrip);

          expectBuffersEqual(roundTrip, srcBytesForCompare);
        });
      }
      // rflCharData

      if (entry.studioCharInfo) {
        it('converts Ver3StoreData -> Studio CharInfo', () => {
          const studio = conv.convertDataToType(srcBytes, conv.studioFormat, null);

          expectBuffersEqual(studio, expectedStudio);
        });

        it('converts Studio CharInfo -> Ver3StoreData', () => {
          /**
           * Normalize converted from/to test data so that
           * fields not present on the source or destination
           * will not be compared against.
           * @param {Uint8Array} buffer - Ver3StoreData to normalize.
           */
          function normalize(buffer) {
            ver3NormalizeForNX(buffer);
            // Set name - gets overwritten with "Mii" on destination.
            fillPattern(buffer, 0x1A, 0x2E);
            fillPattern(buffer, 0x48, 0x5C); // Creator name.
          }

          const roundTrip = conv.convertDataToType(expectedStudio, conv.ver3Format, null, false);

          // Set copyable to 1 for source - always gets set to 1 in destinati

          /** Source bytes copied for normalization. */
          const srcBytesForCompare = new Uint8Array(srcBytes.length);
          srcBytesForCompare.set(srcBytes);
          normalize(srcBytesForCompare);
          normalize(roundTrip);

          expectBuffersEqual(roundTrip, srcBytesForCompare);
        });
      }
      // studioCharInfo

      if (entry.nnmiiCoreData) {
        it('converts nn::mii::CoreData -> Ver3StoreData', () => {
          /**
           * Normalize converted from/to test data so that
           * fields not present on the source or destination
           * will not be compared against.
           * @param {Uint8Array} buffer - Ver3StoreData to normalize.
           */
          function normalize(buffer) {
            ver3NormalizeForNX(buffer);

            // zero out AFTER NAME FIRST utf-16le character
            // account for continuity termination, all
            // names always have at least one character
            zeroRange(buffer, 0x1C, 0x2D);

            fillPattern(buffer, 0x48, 0x5C); // Creator name.
          }

          const roundTrip = conv.convertDataToType(expectedCore, conv.ver3Format, null, false);

          // TODO: Continuity Termination

          /** Source bytes copied for normalization. */
          const srcBytesForCompare = new Uint8Array(srcBytes.length);
          srcBytesForCompare.set(srcBytes);
          normalize(srcBytesForCompare);
          normalize(roundTrip);

          expectBuffersEqual(roundTrip, srcBytesForCompare);
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
          const obfuscatedBytes = hexToBytes(/** @type {string} */ (entry.studioURLSeed0));
          // Decode Studio URL back to raw studio data
          const studioRaw = conv.convertDataToType(obfuscatedBytes, conv.studioFormat, null);

          // Then obfuscate to URL bytes, and compare
          const expectedURLHex = conv.studioURLEncodeHex(studioRaw, 0);
          expect(expectedURLHex).toBe(entry.studioURLSeed0);
        });
      }
      // studioURLSeed0

      if (entry.nnmiiCharInfo) {
        it('converts nn::mii::CoreData -> nn::mii::CharInfo', () => {
          const expectedCharInfo = hexToBytes(/** @type {string} */ (entry.nnmiiCharInfo));
          const actualCharInfo = conv.convertDataToType(expectedCore,
            conv.charInfoFormat, null, false);
          nnmiiCharInfoNormalize(expectedCharInfo);
          nnmiiCharInfoNormalize(actualCharInfo);

          // TODO:
          // - create id, name, ACTUALLY FILL THIS IN LATER L OL
          expectBuffersEqual(actualCharInfo, expectedCharInfo);
        });
      }
      // cannot convert back to CharInfo, due to not being able to encode CoreData
      // nnmiiCharInfo

      if (entry.nfpStoreData && entry.nnmiiCharInfo) {
        it('converts NfpStoreData -> CharInfo', () => {
          const nfpBytes = base64ExToBytes(/** @type {string} */ (entry.nfpStoreData));
          const expectedCharInfo = hexToBytes(/** @type {string} */ (entry.nnmiiCharInfo));
          const actualCharInfo = conv.convertDataToType(nfpBytes, conv.charInfoFormat, null, false);
          nnmiiCharInfoNormalize(expectedCharInfo);
          nnmiiCharInfoNormalize(actualCharInfo);

          expectBuffersEqual(actualCharInfo, expectedCharInfo);
        });
      }
      // nfpStoreData
    });
    // describe
  });
  // testDataTable.forEach

  // Individual cases.
  describe('Miscellaneous one-shot tests', () => {
    it('wraps Ver3StoreData for QR code encryption correctly', () => {
      // Expected wrapped/encrypted QR code data.
      const expectedQR = base64ToBytes(testWrappedStoreData);
      // Get the raw Ver3StoreData.
      const rawData = base64ToBytes(testVer3StoreDataForWrap);
      // Convert to object, and then back to StoreData. Lol.
      const obj = /** @type {conv.MiiVisualParam} */ (conv
        .createNewInstanceOfKaitaiStructFormat(conv.ver3Format, rawData));
      const convData = conv.encode3DSStoreDataFromStruct(obj, true);
      // Wrap the raw Ver3StoreData
      const wrapped = new Uint8Array(conv.wrapVer3StoreDataForQR(convData));

      expectBuffersEqual(wrapped, expectedQR);
    });
  });
  // describe
});
