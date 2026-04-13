/**
 * @file QR Code handler component for the site.
 * Sets up event listeners for QR Code scanning.
 * @author Arian Kordi <ariankordi@ariankordi.net>
 */

import sjcl from 'sjcl';
import QrScanner from '@getify-as-is/qr-scanner';
/** Used in {@link handleTomodachiLife3DSData} */
import { parseTomodachiLifeQRCodeData } from './data-conversion.js';
import {
  // CRC-16/CCITT/XMODEM implementation.
  crc16,
  findSupportedTypeBySize
} from './common.js';

// AES keys encoded in sjcl 32-bit format.
// https://www.3dbrew.org/wiki/PSPXI:EncryptDecryptAes#Key_Types
// Type 2, slot 0x31
/** 59FC817E6446EA6190347B20E9BDCE52 */
const AES_CCM_KEYSLOT_0x31_BITS = [1509720446, 1682369121, -1875608800, -373436846];

const AES_CTR_KEY = new Uint8Array([0x30, 0x81, 0x9F, 0x30, 0x0D,
  0x06, 0x09, 0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x01, 0x01, 0x01]);

// Length of raw encrypted Mii QR code data.
/** 0x70 */
const CFLI_WRAPPED_MII_DATA_SIZE = 112;
// Size of entire encrypted QR Code created by certain titles:
const TOMODACHI_LIFE_3DS_QR_DATA_SIZE = 372;
// const MIITOPIA_3DS_QR_DATA_SIZE       = 324; // idk the structure
// const MIITOMO_QR_DATA_SIZE            = 172; // not decodable
// TBD miitopia

// // ---------------------------------------------------------------------
// //  AES-CCM Encryption
// // ---------------------------------------------------------------------

/**
 * Decrypts the AES-CCM portion of the QR code, using sjcl's private ctrMode function.
 * The default AES-CCM decryption function in sjcl does not work
 * due to the following errata: https://www.3dbrew.org/wiki/AES_Registers#CCM_mode_pitfall
 * @param {Uint8Array} encryptedData - Input QR code data (CFLiWrappedMiiData)
 * @param {Array<number>} [key] - The key to pass into sjcl.
 * @returns {Uint8Array} The encrypted StoreData.
 * @throws {Error}
 */
function decryptAesCcm(encryptedData, key = AES_CCM_KEYSLOT_0x31_BITS) {
  // key = [1509720446, 1682369121, -1875608800, -373436846]) {
  // if the length is smaller than the standard mii qr code size
  if (encryptedData.length < CFLI_WRAPPED_MII_DATA_SIZE) {
    throw new Error(`decryptAesCcm: Input size is ${encryptedData.length}, expected ${CFLI_WRAPPED_MII_DATA_SIZE} or longer.`);
  }

  /** Extracted nonce */
  const nonce = encryptedData.subarray(0, 8);
  const encryptedContent = encryptedData.subarray(8);

  const cipher = new sjcl.cipher.aes(key);

  // Convert nonce and encrypted content to bits, adjusting the nonce to full size
  const encryptedBits = sjcl.codec.bytes.toBits(Array.from(encryptedContent));
  const nonceBits = sjcl.codec.bytes.toBits([...nonce, 0, 0, 0, 0]);

  // Isolate the actual ciphertext from the tag and adjust IV.
  /** Tag length in bits */
  const tlen = 128;
  const out = sjcl.bitArray.clamp(encryptedBits,
    // remove tag from out, tag length = 128
    sjcl.bitArray.bitLength(encryptedBits) - tlen);

  /** regex to find the _ctrMode function: 6 arguments and calls "bitSlice" */
  const ctrModeFuncRegex = /\([^)]*,[^)]*,[^)]*,[^)]*,[^)]*,[^)]*\)\s*.*?bitSlice/;
  /**
   * Closure to find the _ctrMode function by matching its string representation.
   * @param {[string, Function]} entry - A [key, function] pair from Object.entries.
   * @returns {Array<string>|null} Match if function signature matches ctrMode.
   */
  // eslint-disable-next-line no-unused-vars -- key is not needed
  const ctrModeFuncMatch = ([_, fn]) => fn.toString().match(ctrModeFuncRegex);

  /**
   * The sjcl.mode.ccm._ctrMode private function.
   * @typedef {(prf: { encrypt: (input: sjcl.BitArray) => sjcl.BitArray },
   * data: sjcl.BitArray, iv: sjcl.BitArray,
   * tag: sjcl.BitArray, tlen: number, L: number
   * ) => { tag: sjcl.BitArray, data: sjcl.BitArray }} _ctrMode
   */
  const ccm = /** @type {Object<string, *>} */ (sjcl.mode.ccm);
  /**
   * jsdelivr (1.0.8 sjcl.min.js) minifies this function name to "C"
   * @type {_ctrMode}
   */
  let ctrDecrypt = /** @type {_ctrMode} */ (ccm._ctrMode) || /** @type {_ctrMode} */ (ccm.C);
  if (!ctrDecrypt) {
    // attempt to find the private _ctrMode func using our regex
    const match = Object.entries(sjcl.mode.ccm).find(ctrModeFuncMatch);
    // may throw IndexError??
    if (match) {
      ctrDecrypt = match[1];
    } else {
      throw new Error('decryptAesCcm: cannot find PRIVATE sjcl.mode.ccm._ctrMode DECRYPT FUNCTION!!!!!!');
    }
  }
  /** harcoding 3 as "L" / length; */
  const decryptedBits = ctrDecrypt(cipher, out, nonceBits, [], tlen, 3);
  // NOTE: the CBC-MAC of the qr code is NOT verified here

  /** Final output with nonce in the middle */
  const decryptedBytes = sjcl.codec.bytes.fromBits(decryptedBits.data);
  const decryptedSlice = new Uint8Array(decryptedBytes).subarray(0, 88);

  return new Uint8Array([
    ...decryptedSlice.subarray(0, 12),
    ...nonce,
    ...decryptedSlice.subarray(12)
  ]);
}

// // ---------------------------------------------------------------------
// //  AES-CTR Encryption
// // ---------------------------------------------------------------------

/**
 * Decrypts AES-CTR-128.
 * @param {Uint8Array} encryptedData - The encrypted data.
 * @param {Uint8Array} iv - The IV for the data.
 * @param {Uint8Array} [keyData] - The key for the data.
 * @returns {Promise<Uint8Array>} The decrypted data.
 */
async function decryptAesCtr(encryptedData, iv, keyData = AES_CTR_KEY) {
  // Calls to SubtleCr*pto (window.cr*pto.subtle):
  const key = await crypto.subtle.importKey('raw', keyData, { name: 'AES-CTR' }, false, ['decrypt']);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-CTR', counter: iv, length: 128 }, key, encryptedData.buffer);
  return new Uint8Array(decrypted);
}

const qrFileInput = document.getElementById('qr-file');
const video = document.getElementById('qr-video');
const camList = document.getElementById('cam-list');
const videoGroup = document.getElementById('qr-camera-group');
const startCameraButton = document.getElementById('start-camera');
const startCameraLabel = document.getElementById('start-camera-label');
const stopCameraButton = document.getElementById('stop-camera');
const stopCameraLabel = document.getElementById('stop-camera-label');

/**
 * show a status by selectively picking specific id on the dom
 * @param {string} statusId
 * @param {string} message
 */
function showStatus(statusId, message = '') {
  // hide all statuses first, all ids beginning with qr-status-
  for (const element of document.querySelectorAll('[id^=qr-status-]')) {
    element.style.display = 'none';
  }
  const statusElement = document.getElementById('qr-status-' + statusId);
  if (statusElement) {
    statusElement.style.display = ''; // Make it visible
    if (message) {
      // set first span to message
      statusElement.firstElementChild.textContent =
        message; // Append additional message if provided
    }
  }
}

// base64 mii data will go into here
const qrCodeDataInput = document.getElementById('qrcode-data');
const qrCodeDataReal = document.getElementById('qrcode-data-real');

// Initialize QR Scanner
// QrScanner.WORKER_PATH = 'https://debian.local:8443/assets/qr-scanner-worker.min.js';
// const qrScanner = new QrScanner(video, result => handleDecryption(result));
// only defined when actually needed
let scanner;

startCameraButton.addEventListener('click', () => {
  // initialize scanner only if it is not already initialized
  if (!scanner) {
    scanner = new QrScanner(video, result => handleDecryption(result), {
      onDecodeError: (error) => {
        if (error === QrScanner.NO_QR_CODE_FOUND) { // return;
          /* status.textContent = 'Status: No QR code found.';
          status.style.color = '';
          */
          // the above handler will override if there is a legitimate error
          return;
        }
        console.error(error);
        showStatus('error', error);
      },
      highlightScanRegion: true,
      highlightCodeOutline: true
    });
  }
  // unhide video element (camera)
  video.style.height = '';
  videoGroup.style.display = '';
  startCameraButton.style.display = 'none'; // Hide start button
  startCameraLabel.style.display = 'none'; // Hide start label
  stopCameraButton.style.display = ''; // Unhide stop button
  stopCameraLabel.style.display = ''; // Unhide stop label
  scanner.start().then(() => {
    // List cameras after the scanner started to avoid listCamera's stream and the scanner's stream being requested
    // at the same time which can result in listCamera's unconstrained stream also being offered to the scanner.
    // Note that we can also start the scanner after listCameras, we just have it this way around in the demo to
    // start the scanner earlier.
    const existingCameras = document.getElementsByClassName('device-camera');
    for (const camera of existingCameras) {
      // go ahead and remove all existing cameras to repopulate camera list
      camera.remove();
    }
    QrScanner.listCameras(true).then((cameras) => {
      for (const camera of cameras) {
        const option = document.createElement('option');
        option.value = camera.id;
        option.text = camera.label;
        option.className = 'device-camera';
        camList.add(option);
      }
    });
    showStatus('scanning');
  })
    .catch((error) => {
      console.error(error);
      // Camera not found.
      video.style.height = '0px';
      videoGroup.style.display = 'none';
      startCameraButton.style.display = ''; // Unhide start button
      startCameraLabel.style.display = ''; // Unhide start label
      stopCameraButton.style.display = 'none'; // Hide stop button
      stopCameraLabel.style.display = 'none'; // Hide stop label
      if (error === 'Camera not found.') {
        showStatus('no-camera');
      } else {
        showStatus('error', error);
      }
    });
});

stopCameraButton.addEventListener('click', () => {
  if (scanner) {
    scanner.stop();
  }
  // hide video element
  video.style.height = '0px';
  videoGroup.style.display = 'none';
  startCameraButton.style.display = ''; // Unhide start button
  startCameraLabel.style.display = ''; // Unhide start label
  stopCameraButton.style.display = 'none'; // Hide stop button
  stopCameraLabel.style.display = 'none'; // Hide stop label
  showStatus('ready');
});

camList.addEventListener('change', (event) => {
  scanner.setCamera(event.target.value);
});

qrFileInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  scanFile(file);
});

const qrCodeGroup = document.getElementById('qrcode-group');

// NOTE: handles drag/leave/drop for ENTIRE document
// and just ignores it if qrcode group is not active:

document.addEventListener('dragover', (event) => {
  if (!qrCodeGroup.offsetParent) {
    return;
  } // group is not visible, do not handle.
  event.preventDefault();
  qrCodeGroup.classList.add('dashed');
  showStatus('drop');
});

document.addEventListener('dragleave', (event) => {
  if (!qrCodeGroup.offsetParent) {
    return;
  } // group is not visible, do not handle.
  event.preventDefault();
  qrCodeGroup.classList.remove('dashed');
  showStatus('ready');
});

document.addEventListener('drop', (event) => {
  if (!qrCodeGroup.offsetParent) {
    return;
  } // group is not visible, do not handle.

  event.preventDefault();
  qrCodeGroup.classList.remove('dashed');

  const items = event.dataTransfer.items;

  for (const item of items) {
    const file = item.getAsFile();
    scanFile(file);
  }
});

/** @param {File} file */
function scanFile(file) {
  if (file) {
    // NOTE: depends on QrScanner actually mf existing
    QrScanner.scanImage(file, {
      returnDetailedScanResult: true
    })
      .then(result => handleDecryption(result))
      .catch((error) => {
        console.error(error);
        if (error === QrScanner.NO_QR_CODE_FOUND) { // return;
          showStatus('no-qr');
        } else {
          showStatus('error', error);
        }
      });
    // TODO: if they scanned ANOTHER code WHILE this
    // one is waiting it will OVERRIDE WITH THE ERROR MESSAGE
    showStatus('waiting');
  }
}

const qrLoadedTL = document.getElementById('qr-status-loaded-tomodachilife');
const qrLoadedTLHairDye = document.getElementById('qr-tomodachilife-hair-dye');

/**
 * @param {Uint8Array} bytes
 * @param {Uint8Array} data
 * @returns {Promise<Uint8Array>}
 */
async function handleTomodachiLife3DSData(bytes, data) {
  const iv = bytes.slice(CFLI_WRAPPED_MII_DATA_SIZE, 128);
  const encryptedExtra = new Uint8Array(bytes.slice(128, -4));
  // try {
  const decryptedExtraData = await decryptAesCtr(encryptedExtra, new Uint8Array(iv));
  // console.log(decryptedExtraData);
  data = new Uint8Array([...data, ...decryptedExtraData]);
  // } catch(error) {
  // TODO: miic EXTENSION?
  //  console.error(error);
  //  return;
  // }

  const dataObj = {};
  // NOTE may not be defined:
  parseTomodachiLifeQRCodeData(data, dataObj);
  // TODO check if that worked and props are there

  qrLoadedTL.children[0].textContent = dataObj.firstName;
  qrLoadedTL.children[1].textContent = dataObj.lastName;
  qrLoadedTL.children[2].textContent = dataObj.islandName;
  qrLoadedTLHairDye.style.display = dataObj.hairDyeMode ? '' : 'none';

  return data;
}

/**
 * TODO: if you want to streamline stuff
 * you may want to make handleDecryption throw
 * an error of a "no mii" type and handle showing status separately
 * also the function name is not very accurate
 * it's more like, handle scanning
 * @param {{bytes: Uint8Array}} result - The result object received from QrScanner.
 */
async function handleDecryption(result) {
  // ^^ only async because of decryptAesCtr/SubtleCr*pto

  // QR CODE EMPTY or does not contain binary
  // let bytes = result.bytes;
  const bytes = result.binaryData;
  if (!bytes.length) {
    showStatus('no-mii', 'QR code is empty or does not have binary data.');
    return;
  } else if (bytes.length < CFLI_WRAPPED_MII_DATA_SIZE) {
    // NOTE: this is actually REDUNDANT because it is ALSO
    // checked within decryptAesCcm though then it will be caught like a generic err
    showStatus('no-mii', 'QR code needs to be 112 bytes or longer, but length is: ' + bytes.length);
    return;
  }
  // bytes = new Uint8Array(result.bytes);
  // const inputData = new Uint8Array(result.bytes);
  let decryptedData;
  try {
    decryptedData = decryptAesCcm(bytes); // Decrypt
  } catch (error) {
    console.error(error);
    // not including "Error:" string because the js error will begin with its type
    showStatus('error', error);
    return;
  }

  if (bytes.length === TOMODACHI_LIFE_3DS_QR_DATA_SIZE) { // tomodachi life, miitomo = 172
    const ret = await handleTomodachiLife3DSData(bytes, decryptedData);
    if (ret) {
      decryptedData = ret;
    }
  } else if (bytes.length == 122) { // miic
    const extra = bytes.slice(CFLI_WRAPPED_MII_DATA_SIZE);
    decryptedData = new Uint8Array([...decryptedData, ...extra]);
  }

  // Extract UTF-16 LE Mii name starting at 0x1A
  const startOffset = 0x1A;
  const nameLength = 0x14;
  // Find the position of the null terminator (0x00 0x00)
  let endPosition = startOffset;
  while (endPosition < startOffset + nameLength) {
    if (decryptedData[endPosition] === 0x00 && decryptedData[endPosition + 1] === 0x00) {
      break;
    }
    endPosition += 2; // Move in 2-byte increments (UTF-16 LE)
  }
  const utf16leBytes = decryptedData.slice(0x1A, endPosition);
  const utf16leMiiName = new TextDecoder('utf-16le').decode(utf16leBytes);

  // crc16 verify
  const dataCrc16 = decryptedData.slice(94, 96);
  // convert the decrypted qr crc16 to uint16
  const dataCrc16u16 = (dataCrc16[0] << 8) | dataCrc16[1];

  // now calculate the expected crc16 for the data
  const expectedCrc16 = crc16(decryptedData.slice(0, 94));

  if (expectedCrc16 !== dataCrc16u16) {
    showStatus('no-mii', 'CRC16 checksum failed.');
    // scanning should continue then
    return;
  }

  showStatus('loaded', utf16leMiiName);
  if (bytes.length === TOMODACHI_LIFE_3DS_QR_DATA_SIZE) {
    qrLoadedTL.style.display = '';
  }

  // finished, stop camera if it is open
  if (scanner) {
    scanner.stop();
  }
  // hide video element
  video.style.height = '0px';
  videoGroup.style.display = 'none';
  startCameraButton.style.display = ''; // Unhide start button
  startCameraLabel.style.display = ''; // Unhide start label
  stopCameraButton.style.display = 'none'; // Hide stop button
  stopCameraLabel.style.display = 'none'; // Hide stop label

  const dataU8 = new Uint8Array(decryptedData);
  const type = findSupportedTypeBySize(dataU8.length);

  qrCodeDataInput.value = btoa(String.fromCharCode(...dataU8));
  qrCodeDataReal.disabled = true;
  globalThis.setDataConvertInline(dataU8, type, qrCodeDataInput, qrCodeDataReal);
}
