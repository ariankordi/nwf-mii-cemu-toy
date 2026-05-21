// @ts-check
import { base64ToBytes, bytesToBase64, bytesToHex, parseHexOrB64ToBytes } from './common.js';
import {
  DataConversionUtilityTodoMoveThis as ConvUtility,
  MiiDataSize,
  MiiDataType,
  MiiDecoder,
  MiiEncoder,
  MiiExtraInfo,
  MiiFormat,
  MiiVisualInfo,
  StudioObfuscation
} from './MiiDataLibrary.mjs';
import { MiiLogoQrCode } from './MiiLogoQrCode.js';
import Tomo3dsExtraAccessor from './Tomo3dsExtraAccessor.js';
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
 * @typedef {Object} MiiConversionResult
 * @property {number} inputType - MiiDataType of the detected input.
 * @property {{technicalName: string, className: string}|undefined} typeInfo - Display info for input format.
 * @property {Uint8Array} studioData - 46-byte Mii Studio raw data.
 * @property {Uint8Array} ver3StoreData - 96-byte Ver3StoreData.
 * @property {Uint8Array} ver3ForQR - 96-byte Ver3StoreData with QR overrides (birthPlatform=CTR, copyable=true).
 * @property {Uint8Array} charInfoData - 88-byte nn::mii::CharInfo.
 */

/**
 * Converts raw Mii bytes to all output formats at once.
 * For NfpStoreDataExtension (amiibo, 104 bytes) the extension fields
 * are applied manually so that studio/charinfo use the NX colors from
 * the extension while ver3/QR use the original Ver3 bytes.
 * @param {Uint8Array} rawInput
 * @returns {MiiConversionResult}
 * @throws {Error} If the input size is not recognized or conversion fails.
 */
const convertMiiData = (rawInput) => {
  /** sizeof(VER3_STORE_DATA) + sizeof(NfpStoreDataExtention) */
  const NFP_SIZE = MiiDataSize.VER3_STORE_DATA + 8;

  const TOMO3DS_SIZE = MiiDataSize.VER3_STORE_DATA + 240;

  /**
   * @param {MiiVisualInfo} info
   * @param {MiiExtraInfo} extra
   * @param {Uint8Array} ver3Raw
   * @returns {MiiConversionResult}
   */
  const postVer3Extension = (info, extra, ver3Raw) => {
    const studioData = new Uint8Array(MiiDataSize.STUDIO_DATA);
    MiiEncoder.toStudioData(studioData, info);

    const charInfoData = new Uint8Array(MiiDataSize.NX_CHAR_INFO);
    ConvUtility.adjustExtra(extra, MiiDataType.NX_CHAR_INFO);
    MiiEncoder.toNxCharInfo(charInfoData, info, extra);

    // The embedded Ver3 bytes already have correct Ver3 colors; copy them.
    const ver3StoreData = new Uint8Array(ver3Raw);
    const ver3ForQR = buildVer3ForQR(ver3Raw);

    const inputType = MiiDataType.VER3_STORE_DATA;
    return { inputType, typeInfo: MiiDataTypeInfo[inputType], studioData, ver3StoreData, ver3ForQR, charInfoData };
  };

  if (rawInput.length === NFP_SIZE) {
    const ver3Raw = rawInput.subarray(0, MiiDataSize.VER3_STORE_DATA);
    const info = new MiiVisualInfo(), extra = new MiiExtraInfo();
    // CRC return value is intentionally ignored — amiibo data may have an invalid CRC.
    MiiDecoder.fromVer3StoreData(ver3Raw, info, extra);
    // Overwrite visual colors with the NX common colors from the extension.
    ConvUtility.applyNfpExtension(info, rawInput, MiiDataSize.VER3_STORE_DATA);

    return postVer3Extension(info, extra, ver3Raw);
  } else if (rawInput.length === TOMO3DS_SIZE) {
    const ver3Raw = rawInput.subarray(0, MiiDataSize.VER3_STORE_DATA);
    const extraRaw = rawInput.subarray(MiiDataSize.VER3_STORE_DATA);
    const info = new MiiVisualInfo(), extra = new MiiExtraInfo();
    MiiDecoder.fromVer3StoreData(ver3Raw, info, extra);

    const accessor = new Tomo3dsExtraAccessor(extraRaw);
    Tomo3dsExtraAccessor.applyHairDye(info,
      accessor.getHairDyeMode(), accessor.getHairDye());

    return postVer3Extension(info, extra, ver3Raw);
  }

  const inputType = MiiFormat.getTypeFromSize(rawInput.length);
  if (inputType === MiiDataType.UNKNOWN) {
    throw new Error('Input format is an unknown size of: ' + rawInput.length);
  }

  const studioData = ConvUtility.convertDataType(rawInput, inputType, MiiDataType.STUDIO_DATA);
  const ver3StoreData = ConvUtility.convertDataType(rawInput, inputType, MiiDataType.VER3_STORE_DATA);
  const charInfoData = ConvUtility.convertDataType(rawInput, inputType, MiiDataType.NX_CHAR_INFO);
  if (!ver3StoreData || !studioData || !charInfoData) throw new Error('data conversion failure (possible CRC mismatch)');

  // Build QR from the already-converted ver3 to avoid an extra full decode cycle.
  const ver3ForQR = buildVer3ForQR(ver3StoreData);

  return { inputType, typeInfo: MiiDataTypeInfo[inputType], studioData, ver3StoreData, ver3ForQR, charInfoData };
};

/**
 * Takes existing Ver3StoreData bytes and returns a copy with QR-specific
 * overrides applied: birthPlatform=3 (CTR) and copyable=true.
 * Accepting already-converted Ver3 avoids re-converting from the original input.
 * @param {Uint8Array} ver3Raw - 96-byte Ver3StoreData.
 * @returns {Uint8Array}
 */
const buildVer3ForQR = (ver3Raw) => {
  const info = new MiiVisualInfo(), ex = new MiiExtraInfo();
  // decodeDataType may return false on CRC mismatch but still fills info/ex.
  ConvUtility.decodeDataType(ver3Raw, MiiDataType.VER3_STORE_DATA, info, ex);
  ConvUtility.adjustExtra(ex, MiiDataType.VER3_STORE_DATA);
  ex.birthPlatform = 3; // FFL_BIRTH_PLATFORM_CTR — required to scan on 3DS/Wii U
  ex.copyable = true;
  const dst = new Uint8Array(MiiDataSize.VER3_STORE_DATA);
  ConvUtility.encodeDataType(dst, MiiDataType.VER3_STORE_DATA, info, ex);
  return dst;
};

/**
 * Derives a base name for download files.
 * Uses the Mii name if non-empty, otherwise a timestamp + format class.
 * @param {string} name
 * @param {{technicalName: string, className: string}|undefined} typeInfo
 * @returns {string}
 */
const buildFileBaseName = (name, typeInfo) => {
  if (name) return name;
  /** @param {number} n */
  const pad2 = n => (n < 10 ? '0' : '') + n;
  const now = new Date();
  return now.getFullYear() + '-' +
    pad2(now.getMonth() + 1) + '-' +
    pad2(now.getDate()) + '_' +
    pad2(now.getHours()) + '-' +
    pad2(now.getMinutes()) + '-' +
    pad2(now.getSeconds()) + '-' +
    (typeInfo?.className ?? 'Unknown');
};

const handleConvertDetailsToggle = (/** @type {ToggleEvent} */ event) => {
  const target = /** @type {HTMLDetailsElement|null} */ (event.target);
  if (!target || !target.open || target.dataset.revealed) {
    return;
  }

  const dataValue = target.dataset.data;
  if (!dataValue) {
    throw new Error('data-data attribute on <details> is undefined, it is supposed to contain the data for this result');
  }

  const rawInput = parseHexOrB64ToBytes(dataValue);
  const name = target.dataset.name || 'Mii';
  const result = convertMiiData(rawInput);
  applyConversionToDetails(target, result, name);
  target.dataset.revealed = '1';
};

/**
 * Wires a MiiConversionResult into a <details> element's child nodes.
 * All data is already converted; this function only does DOM writes.
 * @param {HTMLDetailsElement} target
 * @param {MiiConversionResult} result
 * @param {string} name - Mii name for the QR code and file base name.
 */
const applyConversionToDetails = (target, result, name) => {
  const { studioData, ver3StoreData, ver3ForQR, charInfoData, typeInfo } = result;

  if (typeInfo) {
    target.getElementsByClassName('input-type')[0].textContent = typeInfo.technicalName;
  }

  const studioCode = bytesToHex(studioData);
  target.getElementsByClassName('studio-code')[0].textContent = studioCode;
  /** @type {HTMLAnchorElement} */ (target.getElementsByClassName('mii-instructions-link')[0]).href += studioCode;

  const studioImageElement = /** @type {HTMLElement} */ (target.getElementsByClassName('image-80')[0]);
  const studioURLBytes = new Uint8Array(47);
  StudioObfuscation.encode(studioURLBytes, studioData, 0);
  studioImageElement.setAttribute('src', studioImageElement.dataset.src + bytesToHex(studioURLBytes));

  const ver3StoreDataB64 = bytesToBase64(ver3StoreData);
  target.getElementsByClassName('ver3storedata')[0].textContent = ver3StoreDataB64;

  const fileBaseName = buildFileBaseName(name, typeInfo);

  const ffsdBtn = /** @type {HTMLButtonElement} */ (target.getElementsByClassName('download-ffsd')[0]);
  ffsdBtn.dataset.data = ver3StoreDataB64;
  ffsdBtn.dataset.filename = fileBaseName + '.ffsd';

  const charInfoBtn = /** @type {HTMLButtonElement} */ (target.getElementsByClassName('download-switch-charinfo')[0]);
  charInfoBtn.dataset.data = bytesToBase64(charInfoData);
  charInfoBtn.dataset.filename = fileBaseName + '.charinfo';

  const studioBtn = /** @type {HTMLButtonElement} */ (target.getElementsByClassName('download-studio-data')[0]);
  studioBtn.dataset.data = bytesToBase64(studioData);
  studioBtn.dataset.filename = fileBaseName + '.mnms';

  const modelDownloadButtons = target.getElementsByClassName('model-download-button');
  const imgSearchIfItExists = target.parentElement.getElementsByTagName('img');
  if (modelDownloadButtons.length && imgSearchIfItExists.length) {
    const linkButWithGlbInsteadOfPng = imgSearchIfItExists[0].src
      .replace('&shaderType=switch', '')
      .replace('.png?', '.glb?');
    modelDownloadButtons[0].setAttribute('action', linkButWithGlbInsteadOfPng);
  }

  // QR code is async (AES-wrap + PNG generation).
  const qrCodeImage = target.getElementsByClassName('image-qr')[0];
  const qrData = new Uint8Array(WrappedMiiDataLength);
  (new WrappedMiiDataSubtle(KeySlot0x31Keys[KeyType.Production]))
    .encrypt(qrData, ver3ForQR)
    .then(() => MiiLogoQrCode.generatePng(qrData, name))
    .then((src) => { /** @type {HTMLImageElement} */ (qrCodeImage).src = src; });
};

const handleDownloadDataFileButton = (/** @type {MouseEvent} */ event) => {
  event.preventDefault();
  if (!event.target) return;

  const el = /** @type {HTMLElement} */ (event.target);
  const filename = el.dataset.filename;
  if (!filename) throw new Error('download button does not have data-filename attribute');
  const dataText = el.dataset.data;
  if (!dataText) throw new Error('download button does not have data-data attribute');

  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([base64ToBytes(dataText)]));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
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

export { bindResultTemplateHandlers, convertMiiData, applyConversionToDetails };
