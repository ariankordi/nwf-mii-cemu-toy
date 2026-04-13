/**
 * @file Compiled version of maboii.js: https://github.com/Entrivax/maboii.js
 * Generated with tsc to ES6, and then adapted for SubtleCrypto.
 * Sets up event listeners for amiibo data scanning.
 * @author Arian Kordi <ariankordi@ariankordi.net>
 */

// @ts-check

// // ---------------------------------------------------------------------
// //  UMD / factory setup
// eslint-disable-next-line jsdoc/convert-to-jsdoc-comments -- not documenting the umd block
// // ---------------------------------------------------------------------

(function (root, factory) {
    // @ts-ignore - cannot find name define
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        // @ts-ignore
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        // Browser globals (root is window)

        // Assume TextEncoder/TextDecoder are either defined or undefined in window.
        /** @type {*} */ (root).maboii =
          factory();
    }
}(typeof self !== 'undefined' ? self : this,
    function () {
'use strict';

/* eslint-disable -- Ignore output from tsc. */

/** maboii export - "exports." was find/replaced with "maboii." below */
var maboii = {};

var HMAC_POS_DATA = 0x008;
var HMAC_POS_TAG = 0x1B4;
var NFC3D_NFP_SIZE = 540;
var DerivedKeys = /** @class */ (function () {
    function DerivedKeys() {
        this.aesKey = [];
        this.aesIV = [];
        this.hmacKey = [];
    }
    DerivedKeys.prototype.getByte = function (i) {
        if (i < 16) {
            return this.aesKey[i];
        }
        else if (i < 32) {
            return this.aesIV[i - 16];
        }
        else {
            return this.hmacKey[i - 32];
        }
    };
    DerivedKeys.prototype.setByte = function (i, val) {
        if (i < 16) {
            this.aesKey[i] = val;
            return;
        }
        else if (i < 32) {
            this.aesIV[i - 16] = val;
            return;
        }
        else {
            this.hmacKey[i - 32] = val;
            return;
        }
    };
    return DerivedKeys;
}());
var MasterKeys = /** @class */ (function () {
    function MasterKeys(data, tag) {
        this.data = data;
        this.tag = tag;
    }
    return MasterKeys;
}());
var MasterKey = /** @class */ (function () {
    function MasterKey(hmacKey, typeString, rfu, magicBytesSize, magicBytes, xorPad) {
        this.hmacKey = hmacKey;
        this.typeString = typeString;
        this.rfu = rfu;
        this.magicBytesSize = magicBytesSize;
        this.magicBytes = magicBytes;
        this.xorPad = xorPad;
    }
    return MasterKey;
}());
maboii.loadMasterKeys = loadMasterKeys;
function loadMasterKeys(key) {
    var dataKey = readMasterKey(key, 0);
    var tagKey = readMasterKey(key, 80);
    if (dataKey.magicBytesSize > 16
        || tagKey.magicBytesSize > 16) {
        return null;
    }
    return new MasterKeys(dataKey, tagKey);
}
function readMasterKey(buffer, offset) {
    var hmacKey = [];
    var typeString = [];
    var rfu;
    var magicBytesSize;
    var magicBytes = [];
    var xorPad = [];
    var reader = new ArrayReader(buffer);
    for (var i = 0; i < 16; i++)
        hmacKey[i] = reader.readUInt8(offset + i);
    for (var i = 0; i < 14; i++)
        typeString[i] = reader.readInt8(offset + i + 16);
    rfu = reader.readUInt8(offset + 16 + 14);
    magicBytesSize = reader.readUInt8(offset + 16 + 14 + 1);
    for (var i = 0; i < 16; i++)
        magicBytes[i] = reader.readUInt8(offset + i + 16 + 14 + 1 + 1);
    for (var i = 0; i < 32; i++)
        xorPad[i] = reader.readUInt8(offset + i + 16 + 14 + 1 + 1 + 16);
    return {
        hmacKey: hmacKey,
        typeString: typeString,
        rfu: rfu,
        magicBytesSize: magicBytesSize,
        magicBytes: magicBytes,
        xorPad: xorPad
    };
}
var ArrayReader = /** @class */ (function () {
    function ArrayReader(buffer) {
        this.uint8 = new Uint8Array(buffer);
        this.int8 = new Int8Array(buffer);
    }
    ArrayReader.prototype.readUInt8 = function (index) {
        return this.uint8[index];
    };
    ArrayReader.prototype.readInt8 = function (index) {
        return this.int8[index];
    };
    return ArrayReader;
}());
maboii.unpack = unpack;
async function unpack(amiiboKeys, tag) {
    var unpacked = new Array(NFC3D_NFP_SIZE).fill(0);
    var result = false;
    var internal = new Array(NFC3D_NFP_SIZE).fill(0);
    var dataKeys = new DerivedKeys();
    var tagKeys = new DerivedKeys();
    // Convert format
    tagToInternal(tag, internal);
    // Generate keys
    await amiiboKeygen(amiiboKeys.data, internal, dataKeys);
    await amiiboKeygen(amiiboKeys.tag, internal, tagKeys);
    // Decrypt
    await amiiboCipher(dataKeys, internal, unpacked);
    // Regenerate tag HMAC. Note: order matters, data HMAC depends on tag HMAC!
    await computeHmac(tagKeys.hmacKey, unpacked, 0x1D4, 0x34, unpacked, HMAC_POS_TAG);
    // Regenerate data HMAC
    await computeHmac(dataKeys.hmacKey, unpacked, 0x029, 0x1DF, unpacked, HMAC_POS_DATA);
    memcpy(unpacked, 0x208, tag, 0x208, 0x14);
    result = memcmp(unpacked, HMAC_POS_DATA, internal, HMAC_POS_DATA, 32) == 0 &&
        memcmp(unpacked, HMAC_POS_TAG, internal, HMAC_POS_TAG, 32) == 0;
    return {
        unpacked: unpacked,
        result: result
    };
}
maboii.pack = pack;
async function pack(amiiboKeys, plain) {
    var packed = new Array(NFC3D_NFP_SIZE).fill(0);
    var cipher = new Array(NFC3D_NFP_SIZE).fill(0);
    var dataKeys = new DerivedKeys();
    var tagKeys = new DerivedKeys();
    // Generate keys
    await amiiboKeygen(amiiboKeys.tag, plain, tagKeys);
    await amiiboKeygen(amiiboKeys.data, plain, dataKeys);
    // Generated tag HMAC
    await computeHmac(tagKeys.hmacKey, plain, 0x1D4, 0x34, cipher, HMAC_POS_TAG);
    // Generate data HMAC
    var hmacBuffer = [].concat(plain.slice(0x029, 0x029 + 0x18B), cipher.slice(HMAC_POS_TAG, HMAC_POS_TAG + 0x20), plain.slice(0x1D4, 0x1D4 + 0x34));
    await computeHmac(dataKeys.hmacKey, hmacBuffer, 0, hmacBuffer.length, cipher, HMAC_POS_DATA);
    // Encrypt
    await amiiboCipher(dataKeys, plain, cipher);
    // Convert back to hardware
    internalToTag(cipher, packed);
    memcpy(packed, 0x208, plain, 0x208, 0x14);
    return packed;
}
function memcmp(s1, s1Offset, s2, s2Offset, size) {
    for (var i = 0; i < size; i++) {
        if (s1[s1Offset + i] !== s2[s2Offset + i]) {
            return s1[s1Offset + i] - s2[s2Offset + i];
        }
    }
    return 0;
}
function memcpy(destination, destinationOffset, source, sourceOffset, length) {
    var setDestinationByte = Array.isArray(destination) ?
        function (destination, i, value) {
            destination[i] = value;
        } : function (destination, i, value) {
        destination.setByte(i, value);
    };
    var getSourceByte = Array.isArray(source) ?
        function (source, i) {
            return source[i];
        } : function (source, i) {
        return source.getByte(i);
    };
    for (var i = 0; i < length; i++) {
        setDestinationByte(destination, destinationOffset + i, getSourceByte(source, sourceOffset + i));
    }
}
function memccpy(destination, destinationOffset, source, sourceOffset, character, length) {
    for (var i = 0; i < length; i++) {
        destination[destinationOffset + i] = source[sourceOffset + i];
        if (source[sourceOffset + i] == character) {
            return destinationOffset + i + 1;
        }
    }
    return null;
}
function memset(destination, destinationOffset, data, length) {
    for (var i = 0; i < length; i++) {
        destination[destinationOffset + i] = data;
    }
}
async function amiiboKeygen(masterKey, internalDump, derivedKeys) {
    var seed = [];
    amiiboCalcSeed(internalDump, seed);
    await keygen(masterKey, seed, derivedKeys);
}
function amiiboCalcSeed(internaldump, seed) {
    memcpy(seed, 0x00, internaldump, 0x029, 0x02);
    memset(seed, 0x02, 0x00, 0x0E);
    memcpy(seed, 0x10, internaldump, 0x1D4, 0x08);
    memcpy(seed, 0x18, internaldump, 0x1D4, 0x08);
    memcpy(seed, 0x20, internaldump, 0x1E8, 0x20);
}
function tagToInternal(tag, internal) {
    memcpy(internal, 0x000, tag, 0x008, 0x008);
    memcpy(internal, 0x008, tag, 0x080, 0x020);
    memcpy(internal, 0x028, tag, 0x010, 0x024);
    memcpy(internal, 0x04C, tag, 0x0A0, 0x168);
    memcpy(internal, 0x1B4, tag, 0x034, 0x020);
    memcpy(internal, 0x1D4, tag, 0x000, 0x008);
    memcpy(internal, 0x1DC, tag, 0x054, 0x02C);
}
function internalToTag(internal, tag) {
    memcpy(tag, 0x008, internal, 0x000, 0x008);
    memcpy(tag, 0x080, internal, 0x008, 0x020);
    memcpy(tag, 0x010, internal, 0x028, 0x024);
    memcpy(tag, 0x0A0, internal, 0x04C, 0x168);
    memcpy(tag, 0x034, internal, 0x1B4, 0x020);
    memcpy(tag, 0x000, internal, 0x1D4, 0x008);
    memcpy(tag, 0x054, internal, 0x1DC, 0x02C);
}
async function keygen(baseKey, baseSeed, derivedKeys) {
    var preparedSeed = [];
    keygenPrepareSeed(baseKey, baseSeed, preparedSeed);
    await drbgGenerateBytes(baseKey.hmacKey, preparedSeed, derivedKeys);
}
function keygenPrepareSeed(baseKey, baseSeed, output) {
    // 1: Copy whole type string
    var outputOffset = memccpy(output, 0, baseKey.typeString, 0, 0, 14);
    // 2: Append (16 - magicBytesSize) from the input seed
    var leadingSeedBytes = 16 - baseKey.magicBytesSize;
    memcpy(output, outputOffset, baseSeed, 0, leadingSeedBytes);
    outputOffset += leadingSeedBytes;
    // 3: Append all bytes from magicBytes
    memcpy(output, outputOffset, baseKey.magicBytes, 0, baseKey.magicBytesSize);
    outputOffset += baseKey.magicBytesSize;
    // 4: Append bytes 0x10-0x1F from input seed
    memcpy(output, outputOffset, baseSeed, 0x10, 16);
    outputOffset += 16;
    // 5: Xor last bytes 0x20-0x3F of input seed with AES XOR pad and append them
    for (var i = 0; i < 32; i++) {
        output[outputOffset + i] = baseSeed[i + 32] ^ baseKey.xorPad[i];
    }
    outputOffset += 32;
    return outputOffset;
}
async function drbgGenerateBytes(hmacKey, seed, output) {
    var DRBG_OUTPUT_SIZE = 32;
    var outputSize = 48;
    var outputOffset = 0;
    var temp = [];
    var iterationCtx = { iteration: 0 };
    while (outputSize > 0) {
        if (outputSize < DRBG_OUTPUT_SIZE) {
            await drbgStep(await initHmac(hmacKey, iterationCtx.iteration, seed), temp, 0, iterationCtx);
            memcpy(output, outputOffset, temp, 0, outputSize);
            break;
        }
        await drbgStep(await initHmac(hmacKey, iterationCtx.iteration, seed), output, outputOffset, iterationCtx);
        outputOffset += DRBG_OUTPUT_SIZE;
        outputSize -= DRBG_OUTPUT_SIZE;
    }
}

// New functions below:

// Initializes an HMAC operation
async function initHmac(hmacKey, iteration, seed) {
    const key = await crypto.subtle.importKey(
        "raw",
        new Uint8Array(hmacKey),
        { name: "HMAC", hash: { name: "SHA-256" } },
        false,
        ["sign"]
    );
    const data = new Uint8Array([(iteration >> 8) & 0x0f, (iteration >> 0) & 0x0f, ...seed]);
    return { key, data };
}
// Performs an HMAC step
async function drbgStep(hmac, output, outputOffset, iterationCtx) {
    iterationCtx.iteration++;
    const buf = new Uint8Array(await crypto.subtle.sign("HMAC", hmac.key, hmac.data));
    memcpy(output, outputOffset, Array.from(buf), 0, buf.length);
}
// Compute HMAC
async function computeHmac(hmacKey, input, inputOffset, inputLength, output, outputOffset) {
    const key = await crypto.subtle.importKey(
        "raw",
        new Uint8Array(hmacKey),
        { name: "HMAC", hash: { name: "SHA-256" } },
        false,
        ["sign"]
    );
    const result = new Uint8Array(await crypto.subtle.sign(
        "HMAC",
        key,
        new Uint8Array(input).subarray(inputOffset, inputOffset + inputLength)
    ));
    memcpy(output, outputOffset, Array.from(result), 0, result.length);
}
// Encrypt data using AES-CTR
async function amiiboCipher(keys, input, output) {
    const key = await crypto.subtle.importKey(
        "raw",
        new Uint8Array(keys.aesKey),
        { name: "AES-CTR" },
        false,
        ["encrypt"]
    );
    const buf = new Uint8Array(await crypto.subtle.encrypt(
        { name: "AES-CTR", counter: new Uint8Array(keys.aesIV), length: 128 },
        key,
        new Uint8Array(input).subarray(0x02C, 0x02C + 0x188)
    ));

    memcpy(output, 0x02C, Array.from(buf), 0, 0x188);
    memcpy(output, 0, input, 0, 0x008);
    memcpy(output, 0x028, input, 0x028, 0x004);
    memcpy(output, 0x1D4, input, 0x1D4, 0x034);
}

/* eslint-enable -- Ignore output from tsc. */

// Return the object for whatever loader environment we're in.
return maboii;
}));
