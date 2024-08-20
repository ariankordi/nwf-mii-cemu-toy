// Decrypt Mii QR code data from 3DS/Wii U/Miitomo (AES-CCM)
// NOTE: this includes NO VERIFICATION!!!! Check the CRC16.
// Using AES-CTR within SJCL: lightweight and fast JS crypto
function decryptAesCcm(encryptedData) {
  // if the length is smaller than the standard mii qr code size
  if(encryptedData.length < 112) {
    throw new Error('Mii QR codes should be 112 or more bytes long, yours is: ' + encryptedData.length);
  }
  // Extract nonce and encrypted content
  const nonce = encryptedData.slice(0, 8);
  const encryptedContent = encryptedData.slice(8);

  //const key = sjcl.codec.hex.toBits('59FC817E6446EA6190347B20E9BDCE52');
  // hardcoding the key, sjcl formats keys in these huge 32 bit ints
  const cipher = new sjcl.cipher.aes([1509720446, 1682369121, -1875608800, -373436846]);

  // Convert nonce and encrypted content to bits, adjusting the nonce to full size
  const encryptedBits = sjcl.codec.bytes.toBits(Array.from(encryptedContent));
  let nonceBits = sjcl.codec.bytes.toBits([...nonce, 0, 0, 0, 0]);

  // Isolate the actual ciphertext from the tag and adjust IV
  const tlen = 128; // Tag length in bits
  let out = sjcl.bitArray.clamp(encryptedBits,
    // remove tag from out, tag length = 128
    sjcl.bitArray.bitLength(encryptedBits) - tlen);

  // regex to find the _ctrMode function: 6 arguments and calls "bitSlice"
  const ctrModeFuncRegex = /\([^)]*,[^)]*,[^)]*,[^)]*,[^)]*,[^)]*\)\s*.*?bitSlice/;

  // jsdelivr (1.0.8 sjcl.min.js) minifies this function name to "C"
  const ctrDecrypt = sjcl.mode.ccm._ctrMode || sjcl.mode.ccm.C ||
    // attempt to find the private _ctrMode func using our regex
    Object.entries(sjcl.mode.ccm).find(
      // match string representation of the function
      ([_, fn]) => fn.toString().match(ctrModeFuncRegex)
    )[1];
  // may throw IndexError??
  if (!ctrDecrypt) throw new Error('WE CANNOT FIND HIDDEN sjcl.mode.ccm._ctrMode DECRYPT FUNCTION!!!!!!');
  const decryptedBits = ctrDecrypt(cipher, out, nonceBits, [], tlen, 3) // harcoding 3 as "L" / length;
  // NOTE: the CBC-MAC of the qr code is NOT verified here
  // Construct the final output with nonce in the middle
  const decryptedBytes = sjcl.codec.bytes.fromBits(decryptedBits.data);
  const decryptedSlice = new Uint8Array(decryptedBytes).slice(0, 0x58);
  const finalResult = new Uint8Array([
    ...decryptedSlice.slice(0, 12),
    ...nonce,
    ...decryptedSlice.slice(12)
  ]);

  // Convert to base64 and log the output
  /*
  console.log("Decrypted Data (Base64):", btoa(String.fromCharCode.apply(null, finalResult)));
  console.log("Decrypted Data (Hex):", [...new Uint8Array(finalResult)].map(x => x.toString(16).padStart(2, '0')).join(''));
  */
  return finalResult;
}

const qrFileInput = document.getElementById('qr-file');
const video = document.getElementById('qr-video');
const camList = document.getElementById('cam-list');
const videoGroup = document.getElementById('qr-camera-group');
const startCameraButton = document.getElementById('start-camera');
const stopCameraButton = document.getElementById('stop-camera');

// show a status by selectively picking specific id on the dom
function showStatus(statusId, message = '') {
  // hide all statuses first, all ids beginning with qr-status-
  document.querySelectorAll('[id^=qr-status-]').forEach(element => {
      element.style.display = 'none';
  });
  const statusElement = document.getElementById('qr-status-' + statusId);
  if(statusElement) {
      statusElement.style.display = ''; // Make it visible
      if(message) {
          // set first span to message
          statusElement.firstElementChild.textContent = message; // Append additional message if provided
      }
  }
}

// base64 mii data will go into here
const qrCodeInputField = document.getElementById('qrcode');

// Initialize QR Scanner
//QrScanner.WORKER_PATH = 'https://debian.local:8443/assets/qr-scanner-worker.min.js';
//const qrScanner = new QrScanner(video, result => handleDecryption(result));
// only defined when actually needed
let scanner;

startCameraButton.addEventListener('click', () => {
  // initialize scanner only if it is not already initialized
  if(!scanner) {
    scanner = new QrScanner(video, result => handleDecryption(result), {
      onDecodeError: error => {
        if(error === QrScanner.NO_QR_CODE_FOUND) {//return;
          /*status.textContent = 'Status: No QR code found.';
          status.style.color = '';
          */
          // the above handler will override if there is a legitimate error
          return;
        }
        console.error(error);
        showStatus('error', error);
      },
      highlightScanRegion: true,
      highlightCodeOutline: true,
    });
  }
  // unhide video element (camera)
  video.style.height = '';
  videoGroup.style.display = '';
  startCameraButton.style.display = 'none';  // Hide start button
  stopCameraButton.style.display = '';  // Unhide stop button
  scanner.start().then(() => {
    // List cameras after the scanner started to avoid listCamera's stream and the scanner's stream being requested
    // at the same time which can result in listCamera's unconstrained stream also being offered to the scanner.
    // Note that we can also start the scanner after listCameras, we just have it this way around in the demo to
    // start the scanner earlier.
    const existingCameras = document.getElementsByClassName('device-camera');
    [...existingCameras].forEach(camera => {
      // go ahead and remove all existing cameras to repopulate camera list
      camera.remove();
    });
    QrScanner.listCameras(true).then(cameras => cameras.forEach(camera => {
      const option = document.createElement('option');
      option.value = camera.id;
      option.text = camera.label;
      option.className = 'device-camera';
      camList.add(option);
    }));
    showStatus('scanning');
  })
  .catch(error => {
    console.error(error);
    // Camera not found.
    video.style.height = '0px';
    videoGroup.style.display = 'none';
    startCameraButton.style.display = '';  // Unhide start button
    stopCameraButton.style.display = 'none';  // Hide stop button
    if(error === 'Camera not found.') {
      showStatus('no-camera');
    } else {
      showStatus('error', error);
    }
  });
});

stopCameraButton.addEventListener('click', () => {
  if(scanner) scanner.stop();
  // hide video element
  video.style.height = '0px';
  videoGroup.style.display = 'none';
  startCameraButton.style.display = '';  // Unhide start button
  stopCameraButton.style.display = 'none';  // Hide stop button
  showStatus('ready');
});

camList.addEventListener('change', event => {
  scanner.setCamera(event.target.value);
});

qrFileInput.addEventListener('change', event => {
  const file = event.target.files[0];
  scanFile(file);
});

// styled drag and drop zone
/*const dropZone = document.getElementById('qr-dragdrop-zone');

// TODO: THIS PASTE SHOULD ONLY BE ACTIVE WHEN THIS IS VISIBLE

document.addEventListener('paste', event => {
  const items = event.clipboardData.items;
  for (const item of items) {
    if (item.type.indexOf('image') === 0) {
      const blob = item.getAsFile();
      scanFile(blob);
    }
  }
});
*/

function scanFile(file) {
  if(file) {
    // NOTE: depends on QrScanner actually mf existing
    QrScanner.scanImage(file, {
        returnDetailedScanResult: true
      })
      .then(result => handleDecryption(result))
      .catch(error => {
      	console.error(error);
        if(error === QrScanner.NO_QR_CODE_FOUND) {//return;
          showStatus('no-qr');
        } else {
          showStatus('error', error);
        }
      });
      showStatus('waiting');
  }
}

// TODO: if you want to streamline stuff
// you may want to make handleDecryption throw
// an error of a "no mii" type and handle showing status separately
// also the function name is not very accurate
// it's more like, handle scanning
function handleDecryption(result) {
  // QR CODE EMPTY or does not contain binary
  if(!result.bytes.length) {
    showStatus('no-mii', 'QR code is empty or does not have binary data.');
    return;
  } else if(result.bytes.length < 112) {
    // NOTE: this is actually REDUNDANT because it is ALSO
    // checked within decryptAesCcm though then it will be caught like a generic err
    showStatus('no-mii', 'QR code needs to be 112 bytes or longer, but length is: ' + result.bytes.length);
    return;
  }
  const inputData = new Uint8Array(result.bytes);
  let decryptedData;
  try {
    decryptedData = decryptAesCcm(inputData); // Decrypt
  } catch(error) {
    console.error(error);
    // not including "Error:" string because the js error will begin with its type
    showStatus('error', error);
    return;
  }
  // Extract UTF-16 LE Mii name starting at 0x1A
  const startOffset = 0x1A;
  const nameLength = 0x14;
  // Find the position of the null terminator (0x00 0x00)
  let endPosition = startOffset;
  while(endPosition < startOffset + nameLength) {
    if(decryptedData[endPosition] === 0x00 && decryptedData[endPosition + 1] === 0x00) {
      break;
    }
    endPosition += 2; // Move in 2-byte increments (UTF-16 LE)
  }
  const utf16leBytes = decryptedData.slice(0x1A, endPosition);
  let utf16leMiiName = new TextDecoder('utf-16le').decode(utf16leBytes);

  // crc16 verify
  const dataCrc16 = decryptedData.slice(-2);
  // convert the decrypted qr crc16 to uint16
  const dataCrc16u16 = (dataCrc16[0] << 8) | dataCrc16[1];

  // now calculate the expected crc16 for the data
  const expectedCrc16 = crc16(decryptedData.slice(0, -2));

  if(expectedCrc16 !== dataCrc16u16) {
    showStatus('no-mii', 'CRC16 checksum failed.');
    // scanning should continue then
    return;
  }

  showStatus('loaded', utf16leMiiName);
  // finished, stop camera if it is open
  if(scanner) scanner.stop();
  // hide video element
  video.style.height = '0px';
  videoGroup.style.display = 'none';
  startCameraButton.style.display = '';  // Unhide start button
  stopCameraButton.style.display = 'none';  // Hide stop button

  qrCodeInputField.value = btoa(String.fromCharCode(...new Uint8Array(decryptedData)));
}

function crc16(data) {
  let crc = 0;
  let msb = crc >> 8;
  let lsb = crc & 0xFF;

  for(let i = 0; i < data.length; i++) {
    let c = data[i];
    let x = c ^ msb;
    x ^= (x >> 4);
    msb = (lsb ^ (x >> 3) ^ (x << 4)) & 0xFF;
    lsb = (x ^ (x << 5)) & 0xFF;
  }

  crc = (msb << 8) + lsb;
  return crc;
}
