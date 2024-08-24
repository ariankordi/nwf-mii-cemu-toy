//! maboii.js: https://github.com/Entrivax/maboii.js
//! generated with tsc to ES6, and adapted for SubtleCrypto
//! maboii export
var maboii = {};
// "exports." replaced with "maboii."

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



//! maboii.js ends here
const b64ToBuffer = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

let keys;
function ensureMaboiiKeysLoaded() {
    if(keys) return; // do not load keys again if it is already loaded
    // key_retail.bin
    const keyBuffer = b64ToBuffer('HRZLN1typVcouR1ktqPCBXVuZml4ZWQgaW5mb3MAAA7bS54/RSePOX7/m0+5kwAABEkX3Ha0lkDW+Dk5lg+u1O85L6qyFCiqIftU5UUFR2Z/dS0oc6IAF/74XAV1kEttbG9ja2VkIHNlY3JldAAAEP3IoHaUuJ5MR9N96M5cdMEESRfcdrSWQNb4OTmWD67U7zkvqrIUKKoh+1TlRQVHZg==');
    keys = maboii.loadMasterKeys([...keyBuffer]);
}

// using hardcoded offsets here rather
// than parsing the structure properly (kaitai struct?)
// NOTE: i think what we need is actually defined in yuzu here:
// nfp_types.h, EncryptedAmiiboFile and NTAG215File (decrypted)
const NFP_STOREDATA_OFFSET = 0x4C;
const NFP_STOREDATA_SIZE = 0x60;
const NFP_NFPSTOREDATAEXTENTIONRAW_OFFSET = 0xBC;
const NFP_NFPSTOREDATAEXTENTIONRAW_SIZE = 0x8;
const NFP_COUNTRY_CODE_OFFSET = 0x2D;
const NFP_NAME_OFFSET = 0x38;
const NFP_MII_NAME_OFFSET = 0x66;
//const NFP_AND_MII_NAME_LENGTH = 0x14;

/*
// html stuff
const resultList = document.getElementById('results');
const miiTemplate = document.getElementById('mii-template');

const parseMiiFromDecryptedAmiibo = unpacked => {
  const firstLi = miiTemplate.cloneNode(true);
  firstLi.id = '';
  // Append the cloned <li> to the top of the <ul>
  resultList.insertBefore(firstLi, resultList.firstChild);
  const newLi = resultList.children[0];
  // show it
  newLi.style.display = '';

	const amiiboName = extractUTF16FromU8(unpacked, NFP_NAME_OFFSET, NFP_AND_MII_NAME_LENGTH, false);
  newLi.getElementsByClassName('figure-name')[0].textContent = amiiboName;
  const miiName = extractUTF16FromU8(unpacked, NFP_MII_NAME_OFFSET, NFP_AND_MII_NAME_LENGTH, true);
  newLi.getElementsByClassName('mii-name')[0].textContent = miiName;

  const storeData = unpacked.slice(NFP_STOREDATA_OFFSET, NFP_STOREDATA_OFFSET+NFP_STOREDATA_SIZE);
  
  const storeDataB64 = btoa(String.fromCharCode.apply(null, storeData));
  newLi.getElementsByClassName('base64-mii')[0].textContent = storeDataB64;

  const storeDataArrayBuffer = new Uint8Array(storeData).buffer;
  const origMii = new Gen2Wiiu3dsMiitomo(new KaitaiStream(storeDataArrayBuffer));

  // TODO: VERIFY CRC16 OF FFLSTOREDATA STRUCT
  // TODO: SUPPORT DECRYPTED AMIIBO? (DETECT BY CRC16?)
  // TODO: VERIFY NfpStoreDataExtentionRaw::IsValid 
  // TODO: CATCH ALL ERRORS IN JS, PRESENT THEM

	const studioMii = map3DSMiiToStudio(origMii);  
  
  // determine whether this amiibo data was registered on a switch
  // and judge if NFPStoreDataExtentionRaw should be used
  // based on that. TODO: I DON'T KNOW HOW TO DO THIS!!!!!!!
  
  // I looked into using a bitwise operation on the u64 application ID
  // as done in NfcDevice::GetAdminInfo in Citra and Yuzu
  // ... however I couldn't get that to work reliably
  // maybe I was just doing something wrong
  // here I'm going to use the fact that the
  // beginning of app data seems to be blank on Switch
  
  const afterStoreDataExtensionWithinAppDataShouldBeZero = unpacked.slice(NFP_NFPSTOREDATAEXTENTIONRAW_OFFSET+NFP_NFPSTOREDATAEXTENTIONRAW_SIZE,
  NFP_NFPSTOREDATAEXTENTIONRAW_OFFSET+NFP_NFPSTOREDATAEXTENTIONRAW_SIZE+0x14);
  
  const afterStoreDataExtensionWithinAppDataIsZero = afterStoreDataExtensionWithinAppDataShouldBeZero.every(number => number === 0)
    
  const useStoreDataExtension = afterStoreDataExtensionWithinAppDataIsZero
  // As well as an area of AppData after the extension being zero...
  // I found that if you write to an amiibo on (new) 3DS...
  // ... it will leave the extension there. Wii U doesn't.
  
  // This is the country code, which I found is zero from my Switch.
  && unpacked[NFP_COUNTRY_CODE_OFFSET] === 0;

  if(useStoreDataExtension) {
    const storeDataExtension = unpacked.slice(NFP_NFPSTOREDATAEXTENTIONRAW_OFFSET, NFP_NFPSTOREDATAEXTENTIONRAW_OFFSET+NFP_NFPSTOREDATAEXTENTIONRAW_SIZE);
    // nn::mii::detail::NFPStoreDataExtentionRaw (sic)
    // this struct should also be defined in Citra or Yuzu, forgot which at this point
    studioMii.faceColor = storeDataExtension[0];
    studioMii.hairColor = storeDataExtension[1];
    studioMii.eyeColor = storeDataExtension[2];
    studioMii.eyebrowColor = storeDataExtension[3];
    studioMii.mouthColor = storeDataExtension[4];
    studioMii.facialHairColor = storeDataExtension[5];
    studioMii.glassesColor = storeDataExtension[6];
    studioMii.glassesType = storeDataExtension[7];
  } else {
  	// use mii-unsecure api lmao???
    const studioURLCode = miiMap2Studio(Object.values(studioMii));
    newLi.getElementsByClassName('studio-url-data')[0].textContent = studioURLCode;
    newLi.getElementsByClassName('studio-code')[0].textContent = [...new Uint8Array(Object.values(studioMii))].map(x => x.toString(16).padStart(2, '0')).join('');
    newLi.getElementsByClassName('mii')[0].src = `https://mii-unsecure.ariankordi.net/miis/image.png?width=270&data=${encodeURIComponent(storeDataB64)}`;
	  return;
  }

	const studioURLCode = miiMap2Studio(Object.values(studioMii));
  newLi.getElementsByClassName('studio-url-data')[0].textContent = studioURLCode;
  newLi.getElementsByClassName('studio-code')[0].textContent = [...new Uint8Array(Object.values(studioMii))].map(x => x.toString(16).padStart(2, '0')).join('');
	newLi.getElementsByClassName('mii')[0].src = `https://studio.mii.nintendo.com/miis/image.png?type=face&width=270&data=${studioURLCode}`;  
};
*/

/*
document.querySelector('input').addEventListener('change', event => {
  const reader = new FileReader();
  reader.onload = () => {
    const arrayBuffer = reader.result;
    ensureMaboiiKeysLoaded(); // load keys if needed
    maboii.unpack(keys, [...new Uint8Array(arrayBuffer)]).then(unpackCallback(arrayBuffer));
  }
  reader.readAsArrayBuffer(event.target.files[0]);
});
*/
// NOTE: wait for everything in maboii at the bottom to be loaded before calling into it






// file type input
const nfpFileInput = document.getElementById('nfp-file');
const nfpFileDataInput = document.getElementById('nfp-file-data');
const nfpFileDataInputWithExt = document.getElementById('nfp-file-data-with-ext');
// separate fields holding name and figure name
const nfpDataLoaded = document.getElementById('nfp-data-loaded');
const nfpFigureLoaded = document.getElementById('nfp-figure-loaded');
const nfpError = document.getElementById('nfp-error');

// assuming errorTextQuery is already defined (copying fileInput handler here)

// handle adding form input on file input, or fail
nfpFileInput.addEventListener('input', function() {
  if(!nfpFileInput || !nfpFileInput.files[0]) {
    return;
  }
  nfpDataLoaded.style.display = 'none';
  nfpFigureLoaded.style.display = 'none';
  nfpError.style.display = 'none';
  nfpFileDataInput.value = '';
  nfpFileDataInputWithExt.value = '';
  // clear validity
  nfpFileInput.setCustomValidity('');
  const reader = new FileReader();

  // NOTE: THIS. is what actually gets called back
  // when the decrypted amiibo is loaded.
  const parseMiiFromDecryptedAmiibo = unpacked => {
    // figure name is utf-16be
    const unpackedU8 = new Uint8Array(unpacked);
    const figureName = extractUTF16Text(unpackedU8, NFP_NAME_OFFSET, true);

    const storeData = unpackedU8.slice(NFP_STOREDATA_OFFSET, NFP_STOREDATA_OFFSET+NFP_STOREDATA_SIZE);

    // TODO: SUPPORT DECRYPTED AMIIBO? (DETECT BY CRC16?)
    // TODO: VERIFY NfpStoreDataExtentionRaw::IsValid

    // determine whether this amiibo data was registered on a switch
    // and judge if NFPStoreDataExtentionRaw should be used
    // based on that. TODO: I DON'T KNOW HOW TO DO THIS!!!!!!!

    // I looked into using a bitwise operation on the u64 application ID
    // as done in NfcDevice::GetAdminInfo in Citra and Yuzu
    // ... however I couldn't get that to work reliably
    // maybe I was just doing something wrong
    // here I'm going to use the fact that the
    // beginning of app data seems to be blank on Switch

    // TODO: stub
    const type = findSupportedTypeBySize(storeData.length);
    // NOTE: all of the below just serves to check storedata crc16
    // as well as display name. that is fiiinee for that but
    // not for either displaying or conversion

    // this function will handle errors, showing and returning false
    // if there are no errors it should pass tho
    const checkResult = checkSupportedTypeBySize(storeData, type, globalVerifyCRC16);
    if(!checkResult) {
      // remove file to invalidate the form
      const errorText = document.querySelector(errorTextQuery).textContent;
      if(errorText) nfpFileInput.setCustomValidity(errorText);
      // do not mark success
      return;
    }
    // only show figure name after crc16 was successful
    nfpFigureLoaded.firstElementChild.textContent = figureName;
    nfpFigureLoaded.style.display = '';
    // extract name and show loaded text
    displayNameFromSupportedType(storeData, nfpDataLoaded, type, (checkResult === 2));

    // NOW apply store data extension
    let storeDataWithExtension = storeData;

    const afterStoreDataExtensionWithinAppDataShouldBeZero = unpacked.slice(NFP_NFPSTOREDATAEXTENTIONRAW_OFFSET+NFP_NFPSTOREDATAEXTENTIONRAW_SIZE,
    NFP_NFPSTOREDATAEXTENTIONRAW_OFFSET+NFP_NFPSTOREDATAEXTENTIONRAW_SIZE+0x14);

    const afterStoreDataExtensionWithinAppDataIsZero = afterStoreDataExtensionWithinAppDataShouldBeZero.every(number => number === 0)

    const useStoreDataExtension = afterStoreDataExtensionWithinAppDataIsZero
    // As well as an area of AppData after the extension being zero...
    // I found that if you write to an amiibo on (new) 3DS...
    // ... it will leave the extension there. Wii U doesn't.

    // This is the country code, which I found is zero from my Switch.
    && unpacked[NFP_COUNTRY_CODE_OFFSET] === 0;

    //console.log('storedata:', storeData)
    if(useStoreDataExtension) {
      const storeDataExtension = unpacked.slice(NFP_NFPSTOREDATAEXTENTIONRAW_OFFSET, NFP_NFPSTOREDATAEXTENTIONRAW_OFFSET+NFP_NFPSTOREDATAEXTENTIONRAW_SIZE);
      //console.log('nfpstoredataextention (this data uses it):', storeDataExtension)
      // nn::mii::detail::NfpStoreDataExtentionRaw (sic)
      // this struct should also be defined in Citra or Yuzu, forgot which at this point

      // make new buffer for it,
      storeDataWithExtension = new Uint8Array(
        storeData.length + NFP_NFPSTOREDATAEXTENTIONRAW_SIZE);
      storeDataWithExtension.set(storeData, 0);
      storeDataWithExtension.set(storeDataExtension, storeData.length);

      // convert to stuuuuuudioooooo

      // run the function to convert the data from the image to raw studio data
      // NOTE: assuming function and studioFormat const are already defined
      const studioData = convertDataToType(storeDataWithExtension, studioFormat);
      // "studio code" = raw studio data in hex
      // NOTE: three dots are only required if it is a uint8array which
      // it is only one if the input data is studio data directly
      const studioCode = [...studioData].map(byteToHex).join('');

      nfpFileDataInput.value = studioCode;
      // set real value that will be read by conversion
      nfpFileDataInputWithExt.value = uint8ArrayToBase64(storeDataWithExtension);
    } else
      // if there is no storedata extension then just set to storedata
      nfpFileDataInput.value = uint8ArrayToBase64(storeData);
    // should be done
  };

  const unpackCallback = function(originalBuffer) {
    return unpackResult => {
      //console.log(unpackResult)
      if(!unpackResult.result) { // decrypt FAILED!!!
        // TODO: REMOVE THIS HACK:
        // IDEALLY we should check if this is a decrypted amiibo by verifying the mii CRC16.
        // however a quicker solution is...
        // ... making sure the "0xA5" constant is in the same place as the decrypted format
        const originalU8 = new Uint8Array(originalBuffer);
        if(originalU8[0x28] === 0xA5) {
          console.log('assuming this amiibo is decrypted and parsing it');
          return parseMiiFromDecryptedAmiibo(originalU8);
        }
        console.warn('AAAAAAAAAAAAAAAAAAAAAAAAAAAAA unpackResult.result FAILED');
        throw new Error('unpackResult.result is false, failed to decrypt this amiibo or detect it as an amiibo file (it may be decrypted)');
      }
      // think this is an arraybuffer or uint8array
      const unpacked = unpackResult.unpacked;

      parseMiiFromDecryptedAmiibo(unpacked);
    }
  }

  //nfpFileInput.setCustomValidity('');

  reader.onload = function() {
    const arrayBuffer = reader.result;
    ensureMaboiiKeysLoaded(); // load keys if needed
    // wrap THIS FUNCTION!!! to catch any decrypt errors
    maboii.unpack(keys, [...new Uint8Array(arrayBuffer)])
            .then(unpackCallback(arrayBuffer))
            // this should catch decryption errors
            .catch(error => {
              nfpError.firstElementChild.textContent = error.message;
              nfpError.style.display = '';
              // Create and append the error message
              /*nfpFileInput.setCustomValidity(error.message);
              nfpFileInput.reportValidity();
              /*const errorLiOriginal = document.getElementsByClassName('load-error');
              const errorLi = errorLiOriginal[errorLiOriginal.length - 1].cloneNode(true);
              errorLi.style.display = '';
              errorLi.textContent = error.message;
              resultList.insertBefore(errorLi, resultList.firstChild);
              */
            })
  };
  // the original base64 is not needed so this will
  // just be read directly as an arraybuffer
  reader.readAsArrayBuffer(nfpFileInput.files[0]);
  return;
});
