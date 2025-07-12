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

// Utility: Base64 -> U8, Hex -> U8, U8 -> Hex

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
 * Data for testing conversion from Ver3StoreData
 * to studio URL data, obfuscated with seed 0.
 * Every array is an array with two elements
 * element 1 = Base64 Ver3StoreData, element 2 = hex studio data
 * @type {Array<{src: string, dst: string}>}
 */
const testVer3StoreDataToStudioSeed0 = [
  // "Jasmine", from NNID: JasmineChlora
  {
    src: 'AwAAQKBBOMSghAAA27iHMb5gKyoqQgAAWS1KAGEAcwBtAGkAbgBlAAAAAAAAABw3EhB7ASFuQxwNZMcYAAgegg0AMEGzW4JtAABvAHMAaQBnAG8AbgBhAGwAAAAAAJA6',
    dst: '000d142a303f434b717a7b84939ba6b2bbbec5cbc9d0e2ea010d15252b3250535960736f726870757f8289a0a7aeb1'
  },
  // "All" from Exzap's FFL_ODB.
  {
    src: 'AwAAQAAAAAAAAAAA2JXdtJBltjwAAAAAAEBBAGwAbAAAAEEATQBFAAAAAAAAAGN/RmVrASdogyX1NEYUoQAXijAABSk1UklQRQBYAAAAAAAAAAAAAAAAAAAAAAA=',
    dst: '000f11757d7c8689b5c0d9e1edf2fdeff4050e0f131d242b424d4f4c545b375b666e736e7169736b828d93a0acb4bb'
  },
  // "Aiueome" from Super Mario Maker Wii U binary.
  {
    src: 'AwEAMAAAAAAAAAAA2sZrOqTA4fgk3wAAABBBAGkAdQBlAG8AbQBlAAAAAAAAAH9/JwAuCXPOgxfsCIUfDyUY0GUAO0K2oxFSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGUq',
    // Glass Y is decoded incorrectly in gen2_wiiu_3ds_miitomo.ksy.
    dst: '000e14727b79818dc5d0e2e9f5f7061124323a4149505b6279858aa5abb1a6e0eff5ecff001a19081423273e3d3932'
  },
  // "ニッキーん" (Nikki) from Swapnote.
  {
    // Found in game memory.
    src: 'AwAAMAAAAAAAAAAAkPDiXNhr9xsyOQAAAUzLMMMwrTD8MAAAkzAAAAAAAAAAACMAAhB7BqFsZCQgE2YYABwFgg8AgDElgkhQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJVc',
    // Glass Y has same issue as Aiueome.
    dst: '000f161d253639466e746d7379868c9397a2a9afb5bcc6cec8d3ddd4d9e0a288939a9f929d959ba5b1bec5d0d7ded7'
  },
  // Guest A. Create ID may be inaccurate, but studio result is same.
  {
    // Converted by CFL, found in memory.
    src: 'AwEAMAAAAAAAAAAAgAAAAOz/gtIAAAAAABBuAG8AIABuAGEAbQBlAAAAAAAAAEBAgQBEAAJoRBgGNEYUgRIXaA0AACkAUkhQAAAAAAAAAAAAAAAAAAAAAAAAAAAAALQV',
    dst: '000f165d6574777a7f848f93a2abb6b7bcbdc0c7ced5d8dfdee1e8e9e8efb2f9040b100b0f232e4054575e5b666e6e'
  },
  // Character with mouth color 4, from Pretendo PID: 1242980662
  {
    src: 'AwAAQOlVognnx0GC2qjhdwOzuI0n2QAAAERGAHUAYwBrACAAWQBPAFUAIQAAAAB/DiBMARvOgAEmaIAlAQUB0Q0AACkAUkhQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFPo',
    // mii2studio.py, mii-js and derived conversion
    // snippets incorrectly map mouth color >= 4.
    dst: '000f16707d7c838b97a2a9b6bec5d4d9dcd5dce5e9f0f8fffe0108090f166168737a7f727b73828a8e91989998a0a9'
  }
];

describe('data-conversion.js tests', () => {
  describe('data conversion', () => {
    it('should convert from Ver3StoreData properly', () => {
      for (const [, { src, dst }] of testVer3StoreDataToStudioSeed0.entries()) {
        // Gather source and destination Uint8Arrays.
        const srcBytes = base64ToBytes(src);
        const expectedDstBytes = hexToBytes(dst);
        // Perform conversion with seed of 0.
        const studioData = conv.convertDataToType(srcBytes, conv.studioFormat, 'Gen2Wiiu3dsMiitomo', true);
        const actualDstBytes = new Uint8Array(47);
        conv.studioURLObfuscationEncode(studioData, actualDstBytes, 0);
        // Convert to hex.
        const actualHex = conv.bytesToHex(actualDstBytes);
        const expectedHex = conv.bytesToHex(expectedDstBytes);
        // Use assert to verify.
        expect(actualHex).toBe(expectedHex);
        // Validate shortcut function.
        const actualHexShortcut = conv.studioURLEncodeHex(studioData, actualDstBytes);
        expect(actualHex).toBe(actualHexShortcut);
      }
    });
  });
});
