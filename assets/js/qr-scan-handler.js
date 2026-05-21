/**
 * @file QR Code handler component for the site.
 * Sets up event listeners for QR Code scanning.
 * @author Arian Kordi <ariankordi@ariankordi.net>
 */

import QrScanner from 'qr-scanner';
import { findSupportedTypeBySize } from './common.js';
import { WrappedMiiDataLength, WrappedMiiDataSubtle } from './WrappedMiiDataSubtle.js';
import TomoExtraData from './TomoExtraData.js';
import { KeySlot0x31Keys, KeyType } from './WrapAesKeys.js';
import { Char16, Crc16Ccitt } from './MiiDataLibrary.mjs';

// disable BarcodeDetector api as it does not support binary data
QrScanner.setBarcodeDetectorDisabled !== undefined && QrScanner.setBarcodeDetectorDisabled();

const qrFileInput = document.getElementById('qr-file');
const video = document.getElementById('qr-video');
const camList = document.getElementById('cam-list');
const videoGroup = document.getElementById('qr-camera-group');
const startCameraButton = document.getElementById('start-camera');
const startCameraLabel = document.getElementById('start-camera-label');
const stopCameraButton = document.getElementById('stop-camera');
const stopCameraLabel = document.getElementById('stop-camera-label');

const wrapCipher = new WrappedMiiDataSubtle(KeySlot0x31Keys[KeyType.Production]);

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

  // https://github.com/nimiq/qr-scanner/issues/139
  const playPromise = scanner.start();
  if (!playPromise) {
    return; // play operation was cancelled
  }

  // unhide video element (camera)
  video.style.height = '';
  videoGroup.style.display = '';
  startCameraButton.style.display = 'none'; // Hide start button
  startCameraLabel.style.display = 'none'; // Hide start label
  stopCameraButton.style.display = ''; // Unhide stop button
  stopCameraLabel.style.display = ''; // Unhide stop label

  playPromise.then(() => {
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
  let extra = await TomoExtraData.decryptFromWrappedData(bytes);
  if (!extra) {
    return extra;
  }

  throw new Error('implement this');
  extra = new Uint8Array([...data, ...extra]);
  const dataObj = {};
  // NOTE may not be defined:
  // parseTomodachiLifeQRCodeData(extra, dataObj);
  // TODO check if that worked and props are there

  qrLoadedTL.children[0].textContent = dataObj.firstName;
  qrLoadedTL.children[1].textContent = dataObj.lastName;
  qrLoadedTL.children[2].textContent = dataObj.islandName;
  qrLoadedTLHairDye.style.display = dataObj.hairDyeMode ? '' : 'none';

  return extra;
}

/**
 * TODO: if you want to streamline stuff
 * you may want to make handleDecryption throw
 * an error of a "no mii" type and handle showing status separately
 * also the function name is not very accurate
 * it's more like, handle scanning
 * @param {{binaryData: Uint8Array<ArrayBufer>}} result - The result object received from QrScanner.
 */
async function handleDecryption(result) {
  // ^^ only async because of decryptAesCtr/SubtleCr*pto

  // QR CODE EMPTY or does not contain binary
  // let bytes = result.bytes;
  const bytes = result.binaryData;
  if (!bytes.length) {
    showStatus('no-mii', 'QR code is empty or does not have binary data.');
    return;
  } else if (bytes.length < WrappedMiiDataLength) {
    // NOTE: this is actually REDUNDANT because it is ALSO
    // checked within decryptAesCcm though then it will be caught like a generic err
    showStatus('no-mii', 'QR code needs to be 112 bytes or longer, but length is: ' + bytes.length);
    return;
  }
  // bytes = new Uint8Array(result.bytes);
  // const inputData = new Uint8Array(result.bytes);
  let decryptedData = new Uint8Array(96);
  try {
    const result = await wrapCipher.decrypt(decryptedData, bytes);
    if (!result) {
      showStatus('no-mii', 'CBC-MAC of encrypted data is invalid.');
      return;
    }
  } catch (error) {
    console.error(error);
    // not including "Error:" string because the js error will begin with its type
    showStatus('error', error);
    return;
  }

  // tomodachi life, miitomo = 172
  // const isTomodachi3ds = bytes.length === TOMODACHI_LIFE_3DS_QR_DATA_SIZE;
  const isTomodachi3ds = TomoExtraData.getDataName(bytes.length - WrappedMiiDataLength - 16 /* iv */ - 4 /* crc */) === 'tomodachi-life-data';

  if (isTomodachi3ds) {
    const ret = await handleTomodachiLife3DSData(bytes, decryptedData);
    if (ret) {
      decryptedData = ret;
    }
  } else if (bytes.length == 122) { // miic
    const extra = bytes.slice(WrappedMiiDataLength);
    decryptedData = new Uint8Array([...decryptedData, ...extra]);
  }

  const miiName = Char16.toString(new Uint16Array(decryptedData, 0x1A), 10);
  if (Crc16Ccitt.calculate(decryptedData.subarray(0, 96), 96) !== 0) {
    showStatus('no-mii', 'CRC16 checksum failed.');
    // scanning should continue then
    return;
  }

  showStatus('loaded', miiName);
  if (isTomodachi3ds) {
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

  const type = findSupportedTypeBySize(decryptedData.length);

  qrCodeDataInput.value = btoa(String.fromCharCode(...decryptedData));
  qrCodeDataReal.disabled = true;
  globalThis.setDataConvertInline(decryptedData, type, qrCodeDataInput, qrCodeDataReal);
}
