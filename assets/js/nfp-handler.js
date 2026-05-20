// @ts-check
import * as maboii from './WalleV-maboii.mjs';
import { extractUTF16Text, bytesToBase64, base64ToBytes } from './common.js';

/** @type {ReturnType<maboii.loadMasterKeys>} */ let keys;
/** Loads keys for maboii.js, ignoring if they are already loaded. */
function loadMaboiiKeys() {
  if (keys) {
    return; // do not load keys again if it is already loaded
  }
  // key_retail.bin
  const keyBuffer = base64ToBytes('HRZLN1typVcouR1ktqPCBXVuZml4ZWQgaW5mb3MAAA7bS54/RSePOX7/m0+5kwAABEkX3Ha0lkDW+Dk5lg+u1O85L6qyFCiqIftU5UUFR2Z/dS0oc6IAF/74XAV1kEttbG9ja2VkIHNlY3JldAAAEP3IoHaUuJ5MR9N96M5cdMEESRfcdrSWQNb4OTmWD67U7zkvqrIUKKoh+1TlRQVHZg==');
  keys = maboii.loadMasterKeys([...keyBuffer]);
}

// using hardcoded offsets here rather
// than parsing the structure properly (kaitai struct?)
// NOTE: i think what we need is actually defined in yuzu here:
// nfp_types.h, EncryptedAmiiboFile and NTAG215File (decrypted)

class NfpDataAccessor {
  constructor(/** @type {Uint8Array} */ bytes) {
    /** @private */ this._u8 = bytes;
  }

  static dataExtensionSize = 8;

  getStoreData = () => this._u8.subarray(0x4c, 0x4c + 0x60);
  getStoreDataExtension = () => this._u8.subarray(0xbc);
  getCountryCode = () => this._u8[0x2d];
  getName = () => this._u8.subarray(0x38, 0x38 + 20);
  // getNameString = () => new TextDecoder('utf-16').decode(this.getName()).slice('\0')[0]
}

// NOTE: wait for everything in maboii at the bottom to be loaded before calling into it

// Sample code ends.

// file type input
const nfpFileInput = document.getElementById('nfp-file');
const nfpFileDataInput = document.getElementById('nfp-file-data');
const nfpFileDataInputReal = document.getElementById('nfp-file-data-real');
// separate fields holding name and figure name
const nfpDataLoaded = document.getElementById('nfp-data-loaded');
const nfpFigureLoaded = document.getElementById('nfp-figure-loaded');
const nfpError = document.getElementById('nfp-error');

// assuming errorTextQuery is already defined (copying fileInput handler here)

// TODO: IMPORTS: uint8ArrayToBase64 findSupportedTypeBySize displayNameFromSupportedType setDataConvertInline

// handle adding form input on file input, or fail
nfpFileInput.addEventListener('input', function () {
  if (!nfpFileInput || !nfpFileInput.files[0]) {
    return;
  }
  nfpDataLoaded.style.display = 'none';
  nfpFigureLoaded.style.display = 'none';
  nfpError.style.display = 'none';
  nfpFileDataInput.value = '';
  nfpFileDataInputReal.disabled = true;
  // clear validity
  nfpFileInput.setCustomValidity('');
  const reader = new FileReader();

  /**
   * NOTE: THIS. is what actually gets called back
   * when the decrypted amiibo is loaded.
   * @param {Uint8Array} unpacked
   */
  const parseStoreDataFromNfpDecrypted = (unpacked) => {
    // figure name is utf-16be
    const accessor = new NfpDataAccessor(unpacked);
    const figureName = extractUTF16Text(accessor.getName(),
      0, /* isBigEndian */ true, /* nameLength */ 10);

    let storeData = accessor.getStoreData();

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

    const storeDataExtensionData = accessor.getStoreDataExtension();
    // NOW apply store data extension
    /** Data after the StoreData extension within app data. This should be zero. */
    const checkShouldBeZero =
      storeDataExtensionData.subarray(
        NfpDataAccessor.dataExtensionSize, NfpDataAccessor.dataExtensionSize + 0x14);

    const checkIfIsZero =
      checkShouldBeZero.every(number => number === 0);

    const useStoreDataExtension = checkIfIsZero &&
    // As well as an area of AppData after the extension being zero...
    // I found that if you write to an amiibo on (new) 3DS...
    // ... it will leave the extension there. Wii U doesn't.

    // This is the country code, which I found is zero from my Switch.
      accessor.getCountryCode() === 0;

    // console.log('storedata:', storeData)
    if (useStoreDataExtension) {
      // console.log('nfpstoredataextention (this data uses it):', storeDataExtension)
      // nn::mii::detail::NfpStoreDataExtentionRaw (sic)
      // this struct should also be defined in Citra or Yuzu, forgot which at this point

      // make new buffer for it,
      const extension = storeDataExtensionData
        .subarray(0, NfpDataAccessor.dataExtensionSize);
      const storeDataCopy = storeData;
      storeData = new Uint8Array(
        storeData.length + NfpDataAccessor.dataExtensionSize);
      storeData.set(storeDataCopy, 0);
      storeData.set(extension, 0x60);
    } else {
      nfpFileDataInput.value = bytesToBase64(storeData);
      // if this IS using extension then setDataConvertInline will set the value
    }

    globalThis.nfpDidLoadCallback(storeData, nfpFileDataInput, nfpFileDataInputReal, nfpDataLoaded);
    // only show figure name after crc16 was successful
    nfpFigureLoaded.firstElementChild.textContent = figureName;
    nfpFigureLoaded.style.display = '';
  };

  /**
   * @param {Uint8Array} buffer
   * @param {Array<number>} unpacked
   * @param {unknown} result
   */
  function unpackCallback(/** @type {Uint8Array} */ buffer, unpacked, result) {
    // console.log(unpackResult)
    if (!result) { // decrypt FAILED!!!
      // TODO: REMOVE THIS HACK:
      // IDEALLY we should check if this is a decrypted amiibo by verifying the mii CRC16.
      // however a quicker solution is...
      // ... making sure the "0xA5" constant is in the same place as the decrypted format
      const originalU8 = new Uint8Array(buffer);
      if (originalU8[0x28] === 0xA5) {
        console.log('assuming this amiibo is decrypted and parsing it');
        return parseStoreDataFromNfpDecrypted(originalU8);
      }
      console.warn('AAAAAAAAAAAAAAAAAAAAAAAAAAAAA unpackResult.result FAILED');
      throw new Error('unpackResult.result is false, failed to decrypt this amiibo or detect it as an amiibo file (it may be decrypted)');
    }

    parseStoreDataFromNfpDecrypted(
      new Uint8Array(unpacked));
  };

  // nfpFileInput.setCustomValidity('');

  reader.onload = async () => {
    const buffer = reader.result;
    loadMaboiiKeys(); // load keys if needed
    const u8 = new Uint8Array(buffer);
    // wrap THIS FUNCTION!!! to catch any decrypt errors
    const result = await maboii.unpack(keys, [...u8]);

    try {
      unpackCallback(u8, result.unpacked, result.result);
    }
    catch (error) {
      // this should catch decryption errors
      nfpError.firstElementChild.textContent = error.message;
      nfpError.style.display = '';
    }
  };

  // the original base64 is not needed so this will
  // just be read directly as an arraybuffer
  reader.readAsArrayBuffer(nfpFileInput.files[0]);
  return;
});
