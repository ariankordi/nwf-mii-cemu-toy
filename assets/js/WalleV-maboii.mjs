/**
 * @file WalleV-maboii.mjs
 * Fork of maboii.js by WalleV on GitHub: https://github.com/WalleV/maboii.js/tree/codex/remove-node.js-dependencies-for-browser-api
 * Branch "remove-node.js-dependencies-for-browser-api"
 * with functions modified to be async and use SubtleCrypto.
 * Transpiled with jm-ts-to-js-jsdoc and deps. were inlined.
 */

// import { MasterKeys, MasterKey } from './MasterKeys';
export class MasterKeys {
    data;
    tag;
    /**
   * @param {MasterKey} data
   * @param {MasterKey} tag
   */
    constructor(data, tag) {
        this.data = data;
        this.tag = tag;
    }
}

export class MasterKey {
    hmacKey;
    typeString;
    rfu;
    magicBytesSize;
    magicBytes;
    xorPad;
    /**
   * @param {number[]} hmacKey
   * @param {number[]} typeString
   * @param {number} rfu
   * @param {number} magicBytesSize
   * @param {number[]} magicBytes
   * @param {number[]} xorPad
   */
    constructor(hmacKey, typeString, rfu, magicBytesSize, magicBytes, xorPad) {
        this.hmacKey = hmacKey;
        this.typeString = typeString;
        this.rfu = rfu;
        this.magicBytesSize = magicBytesSize;
        this.magicBytes = magicBytes;
        this.xorPad = xorPad;
    }
}
// import { DerivedKeys } from './DerivedKeys';
export class DerivedKeys {
    /**
   * @type {number[]}
   */
    aesKey = [];
    /**
   * @type {number[]}
   */
    aesIV = [];
    /**
   * @type {number[]}
   */
    hmacKey = [];

    constructor() { }

    /**
   * @param {number} i
   */
    getByte(i) {
        if (i < 16) {
            return this.aesKey[i];
        }
        else if (i < 32) {
            return this.aesIV[i - 16];
        }
        else {
            return this.hmacKey[i - 32];
        }
    }
    /**
   * @param {number} i
   * @param {number} val
   */
    setByte(i, val) {
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
    }
}
// import * as plainDataUtils from './PlainDataUtils';
/**
 * @param {number[]} plainData
 * @returns {string}
 */
export function getAmiiboId(plainData) {
    return plainData.slice(0x1DC, 0x1E3 + 1).map((a) => a.toString(16).padStart(2, '0')).join('');
}

/**
 * @param {number[]} plainData
 * @returns {string}
 */
export function getCharacterId(plainData) {
    return plainData.slice(0x1DC, 0x1DD + 1).map((a) => a.toString(16).padStart(2, '0')).join('');
}

/**
 * @param {number[]} plainData
 * @returns {string}
 */
export function getGameSeriesId(plainData) {
    return plainData.slice(0x1DC, 0x1DD + 1).map((a) => a.toString(16).padStart(2, '0')).join('').substr(0, 3);
}


//https://gist.github.com/also/912792
/**
 * @param {Uint16Array} w
 * @returns {string}
 */
function decodeUtf16(w) {
    let i = 0;
    let len = w.length;
    let charCodes = [];
    while (i < len) {
        let w1 = w[i++];
        if (w1 === 0x0)
            break;
        if ((w1 & 0xF800) !== 0xD800) { // w1 < 0xD800 || w1 > 0xDFFF
            charCodes.push(w1);
            continue;
        }
        if ((w1 & 0xFC00) === 0xD800) { // w1 >= 0xD800 && w1 <= 0xDBFF
            throw new RangeError('Invalid octet 0x' + w1.toString(16) + ' at offset ' + (i - 1));
        }
        if (i === len) {
            throw new RangeError('Expected additional octet');
        }
        let w2 = w[i++];
        if ((w2 & 0xFC00) !== 0xDC00) { // w2 < 0xDC00 || w2 > 0xDFFF)
            throw new RangeError('Invalid octet 0x' + w2.toString(16) + ' at offset ' + (i - 1));
        }
        charCodes.push(((w1 & 0x3ff) << 10) + (w2 & 0x3ff) + 0x10000);
    }
    return String.fromCharCode.apply(String, charCodes);
}

/**
 * @typedef {(id: string) => any} NodeRequireFn
 */

const HMAC_POS_DATA = 0x008;
const HMAC_POS_TAG = 0x1B4;
const NFC3D_AMIIBO_SIZE = 540;

// export { plainDataUtils };

/**
   * @param {number[]} key
   * @returns {MasterKeys|null}
   */
export function loadMasterKeys(key) {
    let dataKey = readMasterKey(key, 0);
    let tagKey = readMasterKey(key, 80);

    if (dataKey.magicBytesSize > 16
        || tagKey.magicBytesSize > 16) {
        return null;
    }

    return new MasterKeys(dataKey, tagKey);
}


/**
 * @type {SubtleCrypto | null}
 */
let cachedSubtleCrypto = null;

/**
 * @returns {SubtleCrypto}
 */
function getSubtleCrypto() {
    if (cachedSubtleCrypto) {
        return cachedSubtleCrypto;
    }

    const fromGlobalScope = getGlobalScopeSubtle();
    if (fromGlobalScope) {
        cachedSubtleCrypto = fromGlobalScope;
        return fromGlobalScope;
    }

    const fromNode = getNodeSubtle();
    if (fromNode) {
        cachedSubtleCrypto = fromNode;
        return fromNode;
    }

    throw new Error('Web Crypto API is not available in this environment.');
}

/**
 * @returns {SubtleCrypto | null}
 */
function getGlobalScopeSubtle() {
    const scope = typeof globalThis !== 'undefined' ? globalThis
        : typeof self !== 'undefined' ? self
            : typeof window !== 'undefined' ? window
                : undefined;

    const availableCrypto = scope && scope.crypto ? scope.crypto : undefined;

    if (availableCrypto && availableCrypto.subtle) {
        return availableCrypto.subtle;
    }

    return null;
}

/**
 * @returns {SubtleCrypto | null}
 */
function getNodeSubtle() {
    if (!isNodeEnvironment()) {
        return null;
    }

    const requireFn = getNodeRequire();
    if (!requireFn) {
        return null;
    }

    const nodeCrypto = tryRequire(requireFn, 'node:crypto') ?? tryRequire(requireFn, 'crypto');
    const subtle = nodeCrypto && nodeCrypto.webcrypto && nodeCrypto.webcrypto.subtle
        ? nodeCrypto.webcrypto.subtle
        : null;

    return subtle;
}

/**
 * @returns {NodeRequireFn | null}
 */
function getNodeRequire() {
    try {
        const requireFn = Function('return typeof require === "function" ? require : null;')();
        return requireFn;
    }
    catch (error) {
        return null;
    }
}

/**
 * @param {NodeRequireFn} requireFn
 * @param {string} id
 * @returns {any | null}
 */
function tryRequire(requireFn, id) {
    try {
        return requireFn(id);
    }
    catch (error) {
        return null;
    }
}

/**
 * @returns {boolean}
 */
function isNodeEnvironment() {
    const scope = typeof globalThis !== 'undefined' ? globalThis : undefined;
    const processCandidate = scope && typeof scope.process === 'object' ? scope.process : undefined;

    return !!(processCandidate && processCandidate.versions && typeof processCandidate.versions.node === 'string');
}


/**
 * @param {number[]} buffer
 * @param {number} offset
 * @returns {MasterKey}
 */
function readMasterKey(buffer, offset) {
    let hmacKey = [];
    let typeString = [];
    let rfu;
    let magicBytesSize;
    let magicBytes = [];
    let xorPad = [];

    let reader = new ArrayReader(buffer);

    for (let i = 0; i < 16; i++)
        hmacKey[i] = reader.readUInt8(offset + i);
    for (let i = 0; i < 14; i++)
        typeString[i] = reader.readInt8(offset + i + 16);
    rfu = reader.readUInt8(offset + 16 + 14);
    magicBytesSize = reader.readUInt8(offset + 16 + 14 + 1);
    for (let i = 0; i < 16; i++)
        magicBytes[i] = reader.readUInt8(offset + i + 16 + 14 + 1 + 1);
    for (let i = 0; i < 32; i++)
        xorPad[i] = reader.readUInt8(offset + i + 16 + 14 + 1 + 1 + 16);

    return {
        hmacKey,
        typeString,
        rfu,
        magicBytesSize,
        magicBytes,
        xorPad,
    };
}

class ArrayReader {
    /**
   * @private
   * @type {Uint8Array}
   */
    uint8;
    /**
   * @private
   * @type {Int8Array}
   */
    int8;
    /**
   * @param {number[]} buffer
   */
    constructor(buffer) {
        this.uint8 = new Uint8Array(buffer);
        this.int8 = new Int8Array(buffer);
    }

    /**
   * @param {number} index
   */
    readUInt8(index) {
        return this.uint8[index];
    }

    /**
   * @param {number} index
   */
    readInt8(index) {
        return this.int8[index];
    }
}

/**
 * @param {MasterKeys} amiiboKeys
 * @param {number[]} tag
 * @returns {Promise<{ unpacked: number[]; result: boolean }>}
 */
export async function unpack(amiiboKeys, tag) {
    let unpacked = new Array(NFC3D_AMIIBO_SIZE).fill(0);
    let result = false;
    let internal = new Array(NFC3D_AMIIBO_SIZE).fill(0);
    let dataKeys = new DerivedKeys();
    let tagKeys = new DerivedKeys();

    // Convert format
    tagToInternal(tag, internal);

    // Generate keys
    await amiiboKeygen(amiiboKeys.data, internal, dataKeys);
    await amiiboKeygen(amiiboKeys.tag, internal, tagKeys);

    // Decrypt
    await amiiboCipher('decrypt', dataKeys, internal, unpacked);

    // Regenerate tag HMAC. Note: order matters, data HMAC depends on tag HMAC!
    await computeHmac(tagKeys.hmacKey, unpacked, 0x1D4, 0x34, unpacked, HMAC_POS_TAG);

    // Regenerate data HMAC
    await computeHmac(dataKeys.hmacKey, unpacked, 0x029, 0x1DF, unpacked, HMAC_POS_DATA);

    memcpy(unpacked, 0x208, tag, 0x208, 0x14);

    result = memcmp(unpacked, HMAC_POS_DATA, internal, HMAC_POS_DATA, 32) == 0 &&
        memcmp(unpacked, HMAC_POS_TAG, internal, HMAC_POS_TAG, 32) == 0;

    return {
        unpacked,
        result,
    };
}

/**
 * @param {MasterKeys} amiiboKeys
 * @param {number[]} plain
 * @returns {Promise<number[]>}
 */
export async function pack(amiiboKeys, plain) {
    let packed = new Array(NFC3D_AMIIBO_SIZE).fill(0);
    let cipher = new Array(NFC3D_AMIIBO_SIZE).fill(0);
    let dataKeys = new DerivedKeys();
    let tagKeys = new DerivedKeys();

    // Generate keys
    await amiiboKeygen(amiiboKeys.tag, plain, tagKeys);
    await amiiboKeygen(amiiboKeys.data, plain, dataKeys);

    // Generated tag HMAC
    await computeHmac(tagKeys.hmacKey, plain, 0x1D4, 0x34, cipher, HMAC_POS_TAG);

    // Generate data HMAC
    let hmacBuffer = [].concat(plain.slice(0x029, 0x029 + 0x18B), cipher.slice(HMAC_POS_TAG, HMAC_POS_TAG + 0x20), plain.slice(0x1D4, 0x1D4 + 0x34));
    await computeHmac(dataKeys.hmacKey, hmacBuffer, 0, hmacBuffer.length, cipher, HMAC_POS_DATA);

    // Encrypt
    await amiiboCipher('encrypt', dataKeys, plain, cipher);

    // Convert back to hardware
    internalToTag(cipher, packed);

    memcpy(packed, 0x208, plain, 0x208, 0x14);

    return packed;
}

/**
 * @param {*[]} s1
 * @param {number} s1Offset
 * @param {*[]} s2
 * @param {number} s2Offset
 * @param {number} size
 * @returns {number}
 */
function memcmp(s1, s1Offset, s2, s2Offset, size) {
    for (let i = 0; i < size; i++) {
        if (s1[s1Offset + i] !== s2[s2Offset + i]) {
            return s1[s1Offset + i] - s2[s2Offset + i];
        }
    }
    return 0;
}

/**
 * @param {number[]|DerivedKeys|Uint8Array} destination
 * @param {number} destinationOffset
 * @param {number[]|DerivedKeys|Uint8Array} source
 * @param {number} sourceOffset
 * @param {number} length
 */
function memcpy(destination, destinationOffset, source, sourceOffset, length) {
    const setDestinationByte = (dest, index, value) => {
        if (dest instanceof DerivedKeys) {
            dest.setByte(index, value);
        }
        else {
            dest[index] = value;
        }
    };

    const getSourceByte = (src, index) => {
        if (src instanceof DerivedKeys) {
            return src.getByte(index);
        }
        return src[index];
    };

    for (let i = 0; i < length; i++) {
        setDestinationByte(destination, destinationOffset + i, getSourceByte(source, sourceOffset + i));
    }
}

/**
 * @param {*[]} destination
 * @param {number} destinationOffset
 * @param {*[]} source
 * @param {number} sourceOffset
 * @param {*} character
 * @param {number} length
 * @returns {number}
 */
function memccpy(destination, destinationOffset, source, sourceOffset, character, length) {
    for (let i = 0; i < length; i++) {
        destination[destinationOffset + i] = source[sourceOffset + i];
        if (source[sourceOffset + i] == character) {
            return destinationOffset + i + 1;
        }
    }
    return null;
}

/**
 * @param {*[]} destination
 * @param {number} destinationOffset
 * @param {*} data
 * @param {number} length
 */
function memset(destination, destinationOffset, data, length) {
    for (let i = 0; i < length; i++) {
        destination[destinationOffset + i] = data;
    }
}

/**
 * @param {MasterKey} masterKey
 * @param {number[]} internalDump
 * @param {DerivedKeys} derivedKeys
 * @returns {Promise<void>}
 */
async function amiiboKeygen(masterKey, internalDump, derivedKeys) {
    let seed = [];

    amiiboCalcSeed(internalDump, seed);
    await keygen(masterKey, seed, derivedKeys);
}

/**
 * @param {number[]} internaldump
 * @param {number[]} seed
 */
function amiiboCalcSeed(internaldump, seed) {
    memcpy(seed, 0x00, internaldump, 0x029, 0x02);
    memset(seed, 0x02, 0x00, 0x0E);
    memcpy(seed, 0x10, internaldump, 0x1D4, 0x08);
    memcpy(seed, 0x18, internaldump, 0x1D4, 0x08);
    memcpy(seed, 0x20, internaldump, 0x1E8, 0x20);
}

/**
 * @param {number[]} tag
 * @param {number[]} internal
 */
function tagToInternal(tag, internal) {
    memcpy(internal, 0x000, tag, 0x008, 0x008);
    memcpy(internal, 0x008, tag, 0x080, 0x020);
    memcpy(internal, 0x028, tag, 0x010, 0x024);
    memcpy(internal, 0x04C, tag, 0x0A0, 0x168);
    memcpy(internal, 0x1B4, tag, 0x034, 0x020);
    memcpy(internal, 0x1D4, tag, 0x000, 0x008);
    memcpy(internal, 0x1DC, tag, 0x054, 0x02C);
}

/**
 * @param {number[]} internal
 * @param {number[]} tag
 */
function internalToTag(internal, tag) {
    memcpy(tag, 0x008, internal, 0x000, 0x008);
    memcpy(tag, 0x080, internal, 0x008, 0x020);
    memcpy(tag, 0x010, internal, 0x028, 0x024);
    memcpy(tag, 0x0A0, internal, 0x04C, 0x168);
    memcpy(tag, 0x034, internal, 0x1B4, 0x020);
    memcpy(tag, 0x000, internal, 0x1D4, 0x008);
    memcpy(tag, 0x054, internal, 0x1DC, 0x02C);
}

/**
 * @param {MasterKey} baseKey
 * @param {number[]} baseSeed
 * @param {DerivedKeys} derivedKeys
 * @returns {Promise<void>}
 */
async function keygen(baseKey, baseSeed, derivedKeys) {
    let preparedSeed = [];
    keygenPrepareSeed(baseKey, baseSeed, preparedSeed);
    await drbgGenerateBytes(baseKey.hmacKey, preparedSeed, derivedKeys);
}

/**
 * @param {MasterKey} baseKey
 * @param {number[]} baseSeed
 * @param {number[]} output
 * @returns {number}
 */
function keygenPrepareSeed(baseKey, baseSeed, output) {
    // 1: Copy whole type string
    let outputOffset = memccpy(output, 0, baseKey.typeString, 0, 0, 14);

    // 2: Append (16 - magicBytesSize) from the input seed
    let leadingSeedBytes = 16 - baseKey.magicBytesSize;
    memcpy(output, outputOffset, baseSeed, 0, leadingSeedBytes);
    outputOffset += leadingSeedBytes;

    // 3: Append all bytes from magicBytes
    memcpy(output, outputOffset, baseKey.magicBytes, 0, baseKey.magicBytesSize);
    outputOffset += baseKey.magicBytesSize;

    // 4: Append bytes 0x10-0x1F from input seed
    memcpy(output, outputOffset, baseSeed, 0x10, 16);
    outputOffset += 16;

    // 5: Xor last bytes 0x20-0x3F of input seed with AES XOR pad and append them
    for (let i = 0; i < 32; i++) {
        output[outputOffset + i] = baseSeed[i + 32] ^ baseKey.xorPad[i];
    }
    outputOffset += 32;

    return outputOffset;
}

/**
 * @param {number[]} hmacKey
 * @param {number[]} seed
 * @param {DerivedKeys} output
 * @returns {Promise<void>}
 */
async function drbgGenerateBytes(hmacKey, seed, output) {
    const DRBG_OUTPUT_SIZE = 32;
    let outputSize = 48;
    let outputOffset = 0;

    const subtle = getSubtleCrypto();
    const hmacImportParams = { name: 'HMAC', hash: 'SHA-256' };
    const cryptoKey = await subtle.importKey('raw', new Uint8Array(hmacKey), hmacImportParams, false, ['sign']);

    let iteration = 0;
    while (outputSize > 0) {
        const block = await drbgStep(subtle, cryptoKey, iteration, seed);
        iteration++;

        if (outputSize < DRBG_OUTPUT_SIZE) {
            memcpy(output, outputOffset, block, 0, outputSize);
            break;
        }

        memcpy(output, outputOffset, block, 0, DRBG_OUTPUT_SIZE);
        outputOffset += DRBG_OUTPUT_SIZE;
        outputSize -= DRBG_OUTPUT_SIZE;
    }
}

/**
 * @param {SubtleCrypto} subtle
 * @param {CryptoKey} key
 * @param {number} iteration
 * @param {number[]} seed
 * @returns {Promise<number[]>}
 */
async function drbgStep(subtle, key, iteration, seed) {
    const iterationBytes = new Uint8Array([(iteration >> 8) & 0x0f, (iteration >> 0) & 0x0f]);
    const data = new Uint8Array(iterationBytes.length + seed.length);
    data.set(iterationBytes, 0);
    data.set(seed, iterationBytes.length);

    const digest = await subtle.sign('HMAC', key, data);
    return Array.from(new Uint8Array(digest));
}

/**
 * @param {'encrypt' | 'decrypt'} mode
 * @param {DerivedKeys} keys
 * @param {number[]} input
 * @param {number[]} output
 * @returns {Promise<void>}
 */
async function amiiboCipher(mode, keys, input, output) {
    const subtle = getSubtleCrypto();
    const cryptoKey = await subtle.importKey('raw', new Uint8Array(keys.aesKey), { name: 'AES-CTR', length: 128 }, false, ['encrypt', 'decrypt']);
    const data = new Uint8Array(input).subarray(0x02C, 0x02C + 0x188);
    const algorithm = { name: 'AES-CTR', counter: new Uint8Array(keys.aesIV), length: 128 };
    const processedBuffer = mode === 'encrypt'
        ? await subtle.encrypt(algorithm, cryptoKey, data)
        : await subtle.decrypt(algorithm, cryptoKey, data);
    const processed = Array.from(new Uint8Array(processedBuffer));

    memcpy(output, 0x02C, processed, 0, 0x188);

    memcpy(output, 0, input, 0, 0x008);
    memcpy(output, 0x028, input, 0x028, 0x004);
    memcpy(output, 0x1D4, input, 0x1D4, 0x034);
}

/**
 * @param {number[]} hmacKey
 * @param {number[]|Uint8Array} input
 * @param {number} inputOffset
 * @param {number} inputLength
 * @param {number[]} output
 * @param {number} outputOffset
 * @returns {Promise<void>}
 */
async function computeHmac(hmacKey, input, inputOffset, inputLength, output, outputOffset) {
    const subtle = getSubtleCrypto();
    const hmacImportParams = { name: 'HMAC', hash: 'SHA-256' };
    const cryptoKey = await subtle.importKey('raw', new Uint8Array(hmacKey), hmacImportParams, false, ['sign']);
    const slice = Array.isArray(input)
        ? input.slice(inputOffset, inputOffset + inputLength)
        : Array.from(input.slice(inputOffset, inputOffset + inputLength));
    const data = new Uint8Array(slice);
    const digest = await subtle.sign('HMAC', cryptoKey, data);
    const result = Array.from(new Uint8Array(digest));
    memcpy(output, outputOffset, result, 0, result.length);
}
