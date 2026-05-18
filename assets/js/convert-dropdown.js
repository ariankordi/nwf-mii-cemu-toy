// @ts-check
import { base64ToBytes, bytesToBase64, bytesToHex, parseHexOrB64ToBytes } from './common.js';
import {
  DataConversionUtilityTodoMoveThis as ConvUtility,
  MiiDataSize,
  MiiDataType,
  MiiExtraInfo,
  MiiFormat,
  MiiVisualInfo,
  StudioObfuscation
} from './MiiDataLibrary.mjs';
import { MiiLogoQrCode } from './MiiLogoQrCode.js';
import { KeySlot0x31Keys, KeyType } from './WrapAesKeys.js';
import { WrappedMiiDataLength, WrappedMiiDataSubtle } from './WrappedMiiDataSubtle.js';

/**
 * Maps MiiDataType values to display strings and legacy class names.
 * technicalName is shown in the UI; className is used for download filenames.
 * @type {Record<number, {technicalName: string, className: string}>}
 */
const MiiDataTypeInfo = {
  [MiiDataType.RFL_CORE]: { technicalName: 'RFLiHiddenCharData (Wii)', className: 'Gen1Wii' },
  [MiiDataType.RFL_DATA]: { technicalName: 'RFLCharData/RFLStoreData (Wii)', className: 'Gen1Wii' },
  [MiiDataType.RFL_STORE_DATA]: { technicalName: 'RFLCharData/RFLStoreData (Wii)', className: 'Gen1Wii' },
  [MiiDataType.VER3_CORE]: { technicalName: 'CFL/FFL/AFL/Ver3 (3DS/Wii U) StoreData', className: 'Gen2Wiiu3dsMiitomo' },
  [MiiDataType.VER3_DATA]: { technicalName: 'CFL/FFL/AFL/Ver3 (3DS/Wii U) StoreData', className: 'Gen2Wiiu3dsMiitomo' },
  [MiiDataType.VER3_STORE_DATA]: { technicalName: 'CFL/FFL/AFL/Ver3 (3DS/Wii U) StoreData', className: 'Gen2Wiiu3dsMiitomo' },
  [MiiDataType.NX_CHAR_INFO]: { technicalName: 'nn::mii::CharInfo (Switch)', className: 'Gen3Switchgame' },
  [MiiDataType.NX_CORE]: { technicalName: 'nn::mii::StoreData/nn::mii::CoreData (Switch)', className: 'Gen3Switch' },
  [MiiDataType.NX_STORE_DATA]: { technicalName: 'nn::mii::StoreData/nn::mii::CoreData (Switch)', className: 'Gen3Switch' },
  [MiiDataType.NX_CORE_PARAM]: { technicalName: 'nn::mii::CoreData (no name) (Switch)', className: 'Gen3Switch' },
  [MiiDataType.STUDIO_DATA]: { technicalName: 'Mii Studio Data', className: 'Gen3Studio' },
  [MiiDataType.STUDIO_URL_DATA]: { technicalName: 'Mii Studio Data', className: 'Gen3Studio' },
};

/**
 * Converts inputData to VER3_STORE_DATA with QR-specific overrides:
 * birthPlatform=3 (CTR) so it scans on 3DS/Wii U, and copyable=true.
 * @param {Uint8Array} inputData
 * @param {number} inputType - A MiiDataType value.
 * @returns {Uint8Array}
 */
const convertToVer3ForQR = (inputData, inputType) => {
  const info = new MiiVisualInfo(), ex = new MiiExtraInfo();
  ConvUtility.decodeDataType(inputData, inputType, info, ex);
  ConvUtility.adjustExtra(ex, MiiDataType.VER3_STORE_DATA);
  // Always override these for QR regardless of what adjustExtra set.
  ex.birthPlatform = 3; // FFL_BIRTH_PLATFORM_CTR — required to scan on 3DS/Wii U
  ex.copyable = true;
  const dst = new Uint8Array(MiiDataSize.VER3_STORE_DATA);
  ConvUtility.encodeDataType(dst, MiiDataType.VER3_STORE_DATA, info, ex);
  return dst;
};

const handleConvertDetailsToggle = (/** @type {ToggleEvent} */ event) => {
  const target = /** @type {HTMLDetailsElement|null} */ (event.target);
  if (!target || !target.open || // not toggled open? ignore
    // or already revealed, we do not need to do anything
    target.dataset.revealed) {
    return;
  }

  const dataValue = target.dataset.data;
  if (!dataValue) {
    throw new Error('data-data attribute on <details> is undefined, it is supposed to contain the data for this result');
  }
  const name = target.dataset.name || 'Mii';

  // the name of the input type will be put in this element
  const inputTypeElement = target.getElementsByClassName('input-type')[0];
  const inputData = parseHexOrB64ToBytes(dataValue);

  const studioImageElement = /** @type {HTMLElement} */ (target.getElementsByClassName('image-80')[0]);
  const studioCodeElement = target.getElementsByClassName('studio-code')[0];

  const inputType = MiiFormat.getTypeFromSize(inputData.length);
  if (inputType === MiiDataType.UNKNOWN) {
    throw new Error('Input format is an unknown size of: ' + inputData.length);
  }

  // run the function to convert the data from the image to raw studio data
  const studioData = ConvUtility.convertDataType(inputData, inputType, MiiDataType.STUDIO_DATA);
  if (!studioData) throw new Error('data conversion failure (possible CRC mismatch)');

  const studioCode = bytesToHex(studioData);
  studioCodeElement.textContent = studioCode;

  const miiInstructionsLinkElement = /** @type {HTMLAnchorElement} */ (target.getElementsByClassName('mii-instructions-link')[0]);
  miiInstructionsLinkElement.href += studioCode;

  const studioURLBytes = new Uint8Array(47);
  StudioObfuscation.encode(studioURLBytes, studioData, 0);
  studioImageElement.setAttribute('src', studioImageElement.dataset.src + bytesToHex(studioURLBytes));

  const typeInfo = MiiDataTypeInfo[inputType];
  if (typeInfo) {
    inputTypeElement.textContent = typeInfo.technicalName;
  }

  const ver3StoreDataElement = target.getElementsByClassName('ver3storedata')[0];
  const ver3StoreData = ConvUtility.convertDataType(inputData, inputType, MiiDataType.VER3_STORE_DATA);
  if (!ver3StoreData) throw new Error('data conversion failure (possible CRC mismatch)');
  const ver3StoreDataB64 = bytesToBase64(ver3StoreData);
  ver3StoreDataElement.textContent = ver3StoreDataB64;
  // finally make a qr code

  const ver3ForQR = convertToVer3ForQR(inputData, inputType);
  const qrCodeImage = target.getElementsByClassName('image-qr')[0];
  const wrappedOut = new Uint8Array(WrappedMiiDataLength);
  (new WrappedMiiDataSubtle(KeySlot0x31Keys[KeyType.Production]))
    .encrypt(wrappedOut, ver3ForQR)
    .then(() => MiiLogoQrCode.generatePng(wrappedOut, name))
    .then((src) => { /** @type {HTMLImageElement} */ (qrCodeImage).src = src; });

  const modelDownloadButtons = target.getElementsByClassName('model-download-button');
  const imgSearchIfItExists = target.parentElement.getElementsByTagName('img');
  if (modelDownloadButtons.length && imgSearchIfItExists.length) {
    const linkButWithGlbInsteadOfPng = imgSearchIfItExists[0].src
    // switch shader has transparent faceline
    // texture which will look wrong here
    // so just remove it in order to avoid
    // ppl who use that and don't know that
      .replace('&shaderType=1', '')
      .replace('.png?', '.glb?');
    modelDownloadButtons[0].setAttribute('action', // actually a form lmao
      linkButWithGlbInsteadOfPng);
  }

  // base name will be name if it is defined
  let fileBaseName = name;
  if (!fileBaseName) {
    /**
     * Pads a number with a leading zero if it's less than 10.
     * @param {number} num - The number to pad.
     * @returns {string} Padded string representation of the number.
     */
    const pad2 = num => (num < 10 ? '0' : '') + num;
    // otherwise compose a base name from the date and type
    const now = new Date();
    const formattedTime = now.getFullYear() + '-' +
      pad2(now.getMonth() + 1) + '-' +
      pad2(now.getDate()) + '_' +
      pad2(now.getHours()) + '-' +
      pad2(now.getMinutes()) + '-' +
      pad2(now.getSeconds());
    fileBaseName = formattedTime + '-' + (typeInfo?.className ?? 'Unknown');
  }

  const switchCharInfoDownloadButton = /** @type {HTMLButtonElement} */ (target.getElementsByClassName('download-switch-charinfo')[0]);
  convertDataAndBindToDLButton(switchCharInfoDownloadButton, inputData, MiiDataType.NX_CHAR_INFO, inputType);
  switchCharInfoDownloadButton.dataset.filename = fileBaseName + '.charinfo';

  const studioDataDownloadButton = /** @type {HTMLButtonElement} */ (target.getElementsByClassName('download-studio-data')[0]);
  convertDataAndBindToDLButton(studioDataDownloadButton, inputData, MiiDataType.STUDIO_DATA, inputType);
  studioDataDownloadButton.dataset.filename = fileBaseName + '.mnms';

  const ffsdDownloadButton = /** @type {HTMLButtonElement} */ (target.getElementsByClassName('download-ffsd')[0]);
  ffsdDownloadButton.dataset.data = ver3StoreDataB64;
  ffsdDownloadButton.dataset.filename = fileBaseName + '.ffsd';

  // mark as revealed at the end, i.e. do NOT RUN THE HANDLER ANYMORE
  target.dataset.revealed = '1';
};

/**
 * Converts inputData to the given outputType and stores the result as base64
 * in button.dataset.data, ready for the download handler.
 * @param {HTMLButtonElement} button
 * @param {Uint8Array} inputData
 * @param {number} outputType - A MiiDataType value.
 * @param {number} inputType - A MiiDataType value.
 */
const convertDataAndBindToDLButton = (button, inputData, outputType, inputType) => {
  const data = ConvUtility.convertDataType(inputData, inputType, outputType);
  console.assert(data !== null);
  button.dataset.data = bytesToBase64(/** @type {Uint8Array} */ (data));
};

const handleDownloadDataFileButton = (/** @type {MouseEvent} */ event) => {
  event.preventDefault();
  if (!event.target) {
    return;
  }
  // define a filename with the name, TBD: if name is generic then prepend date maybe?
  const filename = /** @type {HTMLElement} */ (event.target).dataset.filename;
  if (!filename) {
    throw new Error('download button does not have data-filename attribute');
  }
  const dataText = /** @type {HTMLElement} */ (event.target).dataset.data;
  if (!dataText) {
    throw new Error('download button does not have data-data attribute, where base64 data is supposed to go');
  }

  // create and download a new blob from the uint8array we made
  const data = base64ToBytes(dataText);
  const blob = new Blob([data]);
  // create a fake anchor so we can set the filename
  const link = document.createElement('a');
  // create a url from the blob, download from here
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  // begin the download
  link.click();
  // revoke the object url after the download is complete ideally
  URL.revokeObjectURL(url);
};

/**
 * Binds all event handlers to a cloned result template element.
 * @param {HTMLElement} cloneEl - The cloned result template li element.
 * @param {function(MouseEvent, Uint8Array=, string=): void} copyHandler - handleCopyButtonAndUpdateText from main.js.
 */
const bindResultTemplateHandlers = (cloneEl, copyHandler) => {
  const topCopyButton = cloneEl.querySelector('.copy-image-url-top');
  if (topCopyButton) {
    topCopyButton.addEventListener('click', (e) => copyHandler(/** @type {MouseEvent} */ (e), undefined, 'erri'));
  }

  const details = cloneEl.querySelector('details');
  if (details) {
    details.addEventListener('toggle', handleConvertDetailsToggle);
  }

  const studioCopyButton = cloneEl.querySelector('.copy-studio-url');
  if (studioCopyButton) {
    studioCopyButton.addEventListener('click', copyHandler);
  }

  for (const btn of cloneEl.querySelectorAll('.download-studio-data, .download-switch-charinfo, .download-ffsd')) {
    btn.addEventListener('click', handleDownloadDataFileButton);
  }
};

export { bindResultTemplateHandlers };
