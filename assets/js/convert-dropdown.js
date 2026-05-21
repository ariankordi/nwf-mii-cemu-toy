// @ts-check
import { base64ToBytes, parseHexOrB64ToBytes, bytesToBase64 } from './common.js';
import { bytesToHex, convertDataToType, DEFAULT_NAME_IF_NONE, findInputFormatFromSize, studioFormat, studioURLEncodeHex, supportedFormats, ver3Format, wrapVer3StoreDataForQR } from './data-conversion.js';
import { MiiLogoQrCode } from './MiiLogoQrCode.js';

const handleConvertDetailsToggle = (/** @type {ToggleEvent} */ event) => {
  const target = /** @type {HTMLDetailsElement|null} */ (event.target);
  if (!target || !target.open || // not toggled open? ignore
    // or already revealed, we do not need to do anything
    target.dataset.revealed) {
    return;
  }

  // NOTE: routine to find data in image, replaced by fetching from data attribute
  /*
  // we need to find the data
  // .. for now, take this from the parent's image url
  const hopefullyImage = event.target.parentElement.getElementsByTagName('img')[0];
  const imageSrc = hopefullyImage.getAttribute('src');
  if(!imageSrc)
    // image src should not be undefined
    throw new Error('why is the image\'s src undefined...???');

  // get data param, if it even exists
  const imageURLParams = new URLSearchParams(new URL(imageSrc).search);
  const dataValue = imageURLParams.get('data');
  if(!dataValue)
    throw new Error('image\'s source doesn\'t have data query parameter');
  */
  const dataValue = target.dataset.data;
  if (!dataValue) {
    throw new Error('data-data attribute on <details> is undefined, it is supposed to contain the data for this result');
  }
  const name = target.dataset.name || DEFAULT_NAME_IF_NONE;
  // will be undefined if data-name is not there

  // the name of the input type will be put in this element
  const inputTypeElement = target.getElementsByClassName('input-type')[0];

  const inputData = parseHexOrB64ToBytes(dataValue);

  // const studioURLDataElement = event.target.getElementsByClassName('studio-url-data')[0];
  const studioImageElement = /** @type {HTMLElement} */ (target.getElementsByClassName('image-80')[0]);
  const studioCodeElement = target.getElementsByClassName('studio-code')[0];

  // run the function to convert the data from the image to raw studio data
  const studioData = convertDataToType(inputData, studioFormat);
  // "studio code" = raw studio data in hex
  // NOTE: three dots are only required if it is a uint8array which
  // it is only one if the input data is studio data directly
  const studioCode = bytesToHex(studioData);
  studioCodeElement.textContent = studioCode;

  // TODO 2024-11-04: while the mii instructions site accepts studio
  // data as well as charinfo which would be more convenient... for
  // the time being charinfo will be used
  /*
  const switchCharInfoData = convertDataToType(inputData, supportedFormats.find(f => f.className === 'Gen3Switchgame'));
  const switchCharInfoHex = [...switchCharInfoData].map(byteToHex).join('');
  */
  const miiInstructionsLinkElement = /** @type {HTMLAnchorElement} */ (target.getElementsByClassName('mii-instructions-link')[0]);
  miiInstructionsLinkElement.href += studioCode; // switchCharInfoHex;

  const studioURLData = studioURLEncodeHex(studioData);
  const studioURLRender = studioImageElement.dataset.src + studioURLData;
  // studioURLDataElement.textContent = studioURLData;
  studioImageElement.setAttribute('src', studioURLRender);

  // do this at the end bc it is most likely to fail
  const ver3StoreDataElement = target.getElementsByClassName('ver3storedata')[0];
  const inputFormat = findInputFormatFromSize(inputData.length);

  if (inputFormat !== undefined &&
    typeof inputFormat.technicalName === 'string') {
    inputTypeElement.textContent = inputFormat.technicalName;
  }

  const ver3StoreData = convertDataToType(inputData, ver3Format, inputFormat);
  const ver3StoreDataB64 = bytesToBase64(ver3StoreData);
  ver3StoreDataElement.textContent = ver3StoreDataB64;
  // finally make a qr code
  const ver3StoreDataForQR = convertDataToType(inputData, ver3Format, inputFormat, true);
  const qrCodeImage = target.getElementsByClassName('image-qr')[0];
  wrapVer3StoreDataForQR(ver3StoreDataForQR).then((data) => {
    MiiLogoQrCode.generatePng(data, name).then((src) => {
      /** @type {HTMLImageElement} */ (qrCodeImage).src = src;
    });
  });

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

    fileBaseName = formattedTime + '-' + inputFormat.className;
  }

  const switchCharInfoDownloadButton = /** @type {HTMLButtonElement} */ (target.getElementsByClassName('download-switch-charinfo')[0]);
  convertDataAndBindToDLButton(switchCharInfoDownloadButton, inputData, 'Gen3Switchgame', inputFormat);
  switchCharInfoDownloadButton.dataset.filename = fileBaseName + '.charinfo';

  const studioDataDownloadButton = /** @type {HTMLButtonElement} */ (target.getElementsByClassName('download-studio-data')[0]);
  convertDataAndBindToDLButton(studioDataDownloadButton, inputData, 'Gen3Studio', inputFormat);
  studioDataDownloadButton.dataset.filename = fileBaseName + '.mnms';

  const ffsdDownloadButton = /** @type {HTMLButtonElement} */ (target.getElementsByClassName('download-ffsd')[0]);
  ffsdDownloadButton.dataset.data = ver3StoreDataB64;
  ffsdDownloadButton.dataset.filename = fileBaseName + '.ffsd';

  // mark as revealed at the end, i.e. do NOT RUN THE HANDLER ANYMORE
  target.dataset.revealed = '1';
};

/**
 * @param {HTMLButtonElement} button
 * @param {Uint8Array} inputData
 * @param {string} formatName
 * @param {import('./data-conversion.js').FormatDefinition} inputFormat
 */
const convertDataAndBindToDLButton = (button, inputData, formatName, inputFormat) => {
  const format = supportedFormats.find(f => f.className === formatName);
  console.assert(format !== undefined);
  const data = convertDataToType(inputData,
    /** @type {import('./data-conversion.js').FormatDefinition} */ (format), inputFormat);

  const dataString = bytesToBase64(data);
  button.dataset.data = dataString;
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

  const data = base64ToBytes(dataText);

  // create and download a new blob from the uint8array we made
  const blob = new Blob([data]);
  // , {type: 'application/octet-stream'});

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
 * @param {HTMLElement} cloneEl - The cloned result template li element
 * @param {function(MouseEvent, Uint8Array=, string=): void} copyHandler - handleCopyButtonAndUpdateText from main.js
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
