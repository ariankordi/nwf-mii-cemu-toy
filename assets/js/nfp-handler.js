import * as maboiiImport from './maboii-from-ts-browser-port.cjs';
import { extractUTF16Text, bytesToBase64 } from './common.js';

/* eslint-disable no-self-assign -- Get TypeScript to identify global imports. */
globalThis.maboii = ((globalThis).maboii);
// eslint-disable-next-line @stylistic/max-statements-per-line --  Hack to use either UMD or browser ESM import.
let maboii = globalThis.maboii; maboii = maboii || (maboiiImport).default || maboiiImport;
/* eslint-enable no-self-assign -- Get TypeScript to identify global imports. */

const b64ToBuffer = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

let keys;
/** Loads keys for maboii.js, ignoring if they are already loaded. */
function loadMaboiiKeys() {
  if (keys) {
    return; // do not load keys again if it is already loaded
  }
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
// const NFP_MII_NAME_OFFSET = 0x66;
// const NFP_AND_MII_NAME_LENGTH = 0x14;

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

  const afterStoreDataExtensionWithinAppDataShouldBeZero =
    unpacked.slice(NFP_NFPSTOREDATAEXTENTIONRAW_OFFSET+NFP_NFPSTOREDATAEXTENTIONRAW_SIZE,
  NFP_NFPSTOREDATAEXTENTIONRAW_OFFSET+NFP_NFPSTOREDATAEXTENTIONRAW_SIZE+0x14);

  const afterStoreDataExtensionWithinAppDataIsZero =
    afterStoreDataExtensionWithinAppDataShouldBeZero.every(number => number === 0)

  const useStoreDataExtension = afterStoreDataExtensionWithinAppDataIsZero
  // As well as an area of AppData after the extension being zero...
  // I found that if you write to an amiibo on (new) 3DS...
  // ... it will leave the extension there. Wii U doesn't.

  // This is the country code, which I found is zero from my Switch.
  && unpacked[NFP_COUNTRY_CODE_OFFSET] === 0;

  if(useStoreDataExtension) {
    const storeDataExtension =
      unpacked.slice(NFP_NFPSTOREDATAEXTENTIONRAW_OFFSET,
      NFP_NFPSTOREDATAEXTENTIONRAW_OFFSET+NFP_NFPSTOREDATAEXTENTIONRAW_SIZE);
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
    newLi.getElementsByClassName('studio-code')[0].textContent =
      [...new Uint8Array(Object.values(studioMii))].map(x => x.toString(16).padStart(2, '0')).join('');
    newLi.getElementsByClassName('mii')[0].src = `https://mii-unsecure.ariankordi.net/miis/image.png?width=270&data=${encodeURIComponent(storeDataB64)}`;
    return;
  }

  const studioURLCode = miiMap2Studio(Object.values(studioMii));
  newLi.getElementsByClassName('studio-url-data')[0].textContent = studioURLCode;
  newLi.getElementsByClassName('studio-code')[0].textContent =
    [...new Uint8Array(Object.values(studioMii))].map(x => x.toString(16).padStart(2, '0')).join('');
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
    const unpackedU8 = new Uint8Array(unpacked);
    const figureName = extractUTF16Text(unpackedU8, NFP_NAME_OFFSET, true);

    let storeData =
      unpackedU8.slice(NFP_STOREDATA_OFFSET, NFP_STOREDATA_OFFSET + NFP_STOREDATA_SIZE);

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

    // NOW apply store data extension
    /** Data after the StoreData extension within app data. This should be zero. */
    const checkShouldBeZero =
      unpacked.slice(NFP_NFPSTOREDATAEXTENTIONRAW_OFFSET + NFP_NFPSTOREDATAEXTENTIONRAW_SIZE,
        NFP_NFPSTOREDATAEXTENTIONRAW_OFFSET + NFP_NFPSTOREDATAEXTENTIONRAW_SIZE + 0x14);

    const checkIfIsZero =
      checkShouldBeZero.every(number => number === 0);

    const useStoreDataExtension = checkIfIsZero &&
    // As well as an area of AppData after the extension being zero...
    // I found that if you write to an amiibo on (new) 3DS...
    // ... it will leave the extension there. Wii U doesn't.

    // This is the country code, which I found is zero from my Switch.
      unpacked[NFP_COUNTRY_CODE_OFFSET] === 0;

    // console.log('storedata:', storeData)
    if (useStoreDataExtension) {
      const storeDataExtension =
        unpacked.slice(NFP_NFPSTOREDATAEXTENTIONRAW_OFFSET,
          NFP_NFPSTOREDATAEXTENTIONRAW_OFFSET + NFP_NFPSTOREDATAEXTENTIONRAW_SIZE);
      // console.log('nfpstoredataextention (this data uses it):', storeDataExtension)
      // nn::mii::detail::NfpStoreDataExtentionRaw (sic)
      // this struct should also be defined in Citra or Yuzu, forgot which at this point

      // make new buffer for it,
      const storeDataCopy = storeData;
      storeData = new Uint8Array(
        storeData.length + NFP_NFPSTOREDATAEXTENTIONRAW_SIZE);
      storeData.set(storeDataCopy, 0);
      storeData.set(storeDataExtension, NFP_STOREDATA_SIZE);
    } else {
      nfpFileDataInput.value = bytesToBase64(storeData);
      // if this IS using extension then setDataConvertInline will set the value
    }

    globalThis.nfpDidLoadCallback(storeData, nfpFileDataInput, nfpFileDataInputReal, nfpDataLoaded);
    // only show figure name after crc16 was successful
    nfpFigureLoaded.firstElementChild.textContent = figureName;
    nfpFigureLoaded.style.display = '';
  };

  const unpackCallback = function (originalBuffer) {
    return (unpackResult) => {
      // console.log(unpackResult)
      if (!unpackResult.result) { // decrypt FAILED!!!
        // TODO: REMOVE THIS HACK:
        // IDEALLY we should check if this is a decrypted amiibo by verifying the mii CRC16.
        // however a quicker solution is...
        // ... making sure the "0xA5" constant is in the same place as the decrypted format
        const originalU8 = new Uint8Array(originalBuffer);
        if (originalU8[0x28] === 0xA5) {
          console.log('assuming this amiibo is decrypted and parsing it');
          return parseStoreDataFromNfpDecrypted(originalU8);
        }
        console.warn('AAAAAAAAAAAAAAAAAAAAAAAAAAAAA unpackResult.result FAILED');
        throw new Error('unpackResult.result is false, failed to decrypt this amiibo or detect it as an amiibo file (it may be decrypted)');
      }
      // think this is an arraybuffer or uint8array
      const unpacked = unpackResult.unpacked;

      parseStoreDataFromNfpDecrypted(unpacked);
    };
  };

  // nfpFileInput.setCustomValidity('');

  reader.onload = function () {
    const arrayBuffer = reader.result;
    loadMaboiiKeys(); // load keys if needed
    // wrap THIS FUNCTION!!! to catch any decrypt errors
    maboii.unpack(keys, [...new Uint8Array(arrayBuffer)])
      .then(unpackCallback(arrayBuffer))
    // this should catch decryption errors
      .catch((error) => {
        nfpError.firstElementChild.textContent = error.message;
        nfpError.style.display = '';
        // Create and append the error message
        /* nfpFileInput.setCustomValidity(error.message);
              nfpFileInput.reportValidity();
              /*const errorLiOriginal = document.getElementsByClassName('load-error');
              const errorLi = errorLiOriginal[errorLiOriginal.length - 1].cloneNode(true);
              errorLi.style.display = '';
              errorLi.textContent = error.message;
              resultList.insertBefore(errorLi, resultList.firstChild);
              */
      });
  };
  // the original base64 is not needed so this will
  // just be read directly as an arraybuffer
  reader.readAsArrayBuffer(nfpFileInput.files[0]);
  return;
});
