// @ts-check
import { base64ToBytes, bytesToBase64, bytesToHex, parseHexOrB64ToBytes } from './common.js';
import {
  DataConversionUtilityTodoMoveThis as ConvUtility,
  Crc16Ccitt,
  Fnv1a,
  MiiDataSize,
  MiiDataType,
  MiiDecoder,
  MiiEncoder,
  MiiExtraFlag,
  MiiExtraInfo,
  MiiFormat,
  MiiVisualInfo,
  StudioObfuscation
} from './MiiDataLibrary.mjs';
import Tomo3dsExtraAccessor from './Tomo3dsExtraAccessor.js';
import { KeySlot0x31Keys, KeyType } from './WrapAesKeys.js';
import { WrappedMiiDataLength, WrappedMiiDataSubtle } from './WrappedMiiDataSubtle.js';
import { MiiLogoQrCode } from './MiiLogoQrCode.js';

const wrappedMiiData = new WrappedMiiDataSubtle(KeySlot0x31Keys[KeyType.Production]);

const DATA_TYPE_NFP = MiiDataType.VER3_STORE_DATA + 30;
const DATA_TYPE_TOMO3DS = MiiDataType.VER3_STORE_DATA + 31;

/**
 * Maps MiiDataType values to display strings.
 * @type {Record<number, string>}
 */
const MiiDataTypeNames = {
  [MiiDataType.RFL_CORE]: 'RFLiHiddenCharData (Wii)',
  [MiiDataType.RFL_DATA]: 'RFLCharData (Wii)',
  [MiiDataType.RFL_STORE_DATA]: 'RFLStoreData (Wii)',
  [MiiDataType.VER3_CORE]: '3DS/Wii U MiiDataCore',
  [MiiDataType.VER3_DATA]: '3DS/Wii U MiiDataOfficial',
  [MiiDataType.VER3_STORE_DATA]: '{CFL/FFL/Ver3}StoreData (3DS/Wii U)',
  [MiiDataType.NX_CHAR_INFO]: 'nn::mii::CharInfo (Switch)',
  [MiiDataType.NX_CORE]: 'nn::mii::CoreData (Switch)',
  [MiiDataType.NX_STORE_DATA]: 'nn::mii::StoreData (Switch)',
  [MiiDataType.NX_CORE_PARAM]: 'nn::mii::CoreData (Minimal, Switch)',
  [MiiDataType.STUDIO_DATA]: 'Mii Studio Data',
  [MiiDataType.STUDIO_URL_DATA]: 'Mii Studio URL Data',
  [DATA_TYPE_NFP]: 'Ver3StoreData + NfpStoreDataExtention (amiibo Data)',
  [DATA_TYPE_TOMO3DS]: 'CFLiMiiDataPacket + Tomodachi Life 3DS QR Data'
};

/**
 * @typedef {Object} MiiConversionResult
 * @property {number} inputType - MiiDataType of the detected input.
 * @property {string=} typeName - Display name for input format.
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
  const info = new MiiVisualInfo(), extra = new MiiExtraInfo();
  let inputType = MiiFormat.getTypeFromSize(rawInput.length);

  /** sizeof(VER3_STORE_DATA) + sizeof(NfpStoreDataExtention) */
  const NFP_SIZE = MiiDataSize.VER3_STORE_DATA + 8;

  const TOMO3DS_SIZE = MiiDataSize.VER3_STORE_DATA + 240;

  const newId = Fnv1a.create128(rawInput, rawInput.length);

  const postVer3Extension = (/** @type {MiiVisualInfo} */ info,
    /** @type {MiiExtraInfo} */ extra, /** @type {Uint8Array} */ ver3Raw,
    /** @type {number} */ inputType) => {
    const studioData = new Uint8Array(MiiDataSize.STUDIO_DATA);
    MiiEncoder.toStudioData(studioData, info);

    const charInfoData = new Uint8Array(MiiDataSize.NX_CHAR_INFO);
    ConvUtility.adjustExtraForNx(extra, newId);
    MiiEncoder.toNxCharInfo(charInfoData, info, extra);

    return /** @type {MiiConversionResult} */ ({
      inputType,
      typeName: MiiDataTypeNames[inputType],
      studioData,
      // The embedded Ver3 bytes already have correct Ver3 colors; copy them.
      ver3StoreData: ver3Raw.slice(),
      ver3ForQR: buildVer3ForQR(ver3Raw),
      charInfoData
    });
  };

  // Always decode Ver3StoreData and ignore CRC (assumed correct).
  if (rawInput.length === NFP_SIZE) {
    const ver3Raw = rawInput.subarray(0, MiiDataSize.VER3_STORE_DATA);
    MiiDecoder.fromVer3Data(ver3Raw, info, extra);
    // Overwrite visual colors with the NX common colors from the extension.
    ConvUtility.applyNfpExtension(info, rawInput, MiiDataSize.VER3_STORE_DATA);

    return postVer3Extension(info, extra, ver3Raw, DATA_TYPE_NFP);
  } else if (rawInput.length === TOMO3DS_SIZE) {
    const ver3Raw = rawInput.subarray(0, MiiDataSize.VER3_STORE_DATA);
    const extraRaw = rawInput.subarray(MiiDataSize.VER3_STORE_DATA);
    MiiDecoder.fromVer3Data(ver3Raw, info, extra);

    const accessor = new Tomo3dsExtraAccessor(extraRaw);
    // Apply hair/eyebrow/beard colors from hair dye.
    Tomo3dsExtraAccessor.applyHairDye(info,
      accessor.getHairDyeMode(), accessor.getHairDye());

    return postVer3Extension(info, extra, ver3Raw, DATA_TYPE_TOMO3DS);
  }

  if (inputType === MiiDataType.UNKNOWN) {
    throw new Error(`Input format is an unknown size of: ${rawInput.length}`);
  }

  if (!ConvUtility.decodeDataType(rawInput, inputType, info, extra)) {
    throw new Error('data conversion failure (CRC mismatch)');
  }

  // we need separate extra info instances for ver3 and for nx
  // NOTE: we can totally use ConvUtility.convertDataType,
  // but that method pulls in all encode/decode methods which is undesired
  const extraForVer3 = new MiiExtraInfo(), extraForNx = new MiiExtraInfo();
  ConvUtility.decodeDataType(rawInput, inputType, info, extraForVer3);
  ConvUtility.decodeDataType(rawInput, inputType, info, extraForNx);

  // set to convert to special!
  // extraForVer3.setFlag(MiiExtraFlag.SPECIAL); extraForVer3.isSpecial = true;

  ConvUtility.adjustExtra(extraForVer3, MiiDataType.VER3_STORE_DATA, newId);
  ConvUtility.adjustExtra(extraForNx, MiiDataType.NX_CHAR_INFO, newId);

  const ver3StoreData = new Uint8Array(MiiDataSize.VER3_STORE_DATA),
        studioData = new Uint8Array(MiiDataSize.STUDIO_DATA),
        charInfoData = new Uint8Array(MiiDataSize.NX_CHAR_INFO);
  // extraForVer3.authorId[0] = 1;
  MiiEncoder.toVer3StoreData(ver3StoreData, info, extraForVer3);
  MiiEncoder.toStudioData(studioData, info);
  MiiEncoder.toNxCharInfo(charInfoData, info, extraForNx);

  // Build QR from the already-converted ver3 to avoid an extra full decode cycle.
  const ver3ForQR = buildVer3ForQR(ver3StoreData);

  return {
    inputType,
    typeName: MiiDataTypeNames[inputType],
    studioData,
    ver3StoreData,
    ver3ForQR,
    charInfoData
  };
};

/**
 * Takes existing Ver3StoreData bytes and returns a copy with QR-specific
 * overrides applied: birthPlatform=3 (CTR) and copyable=true.
 * @param {Uint8Array} ver3StoreData - 96-byte Ver3StoreData.
 * @returns {Uint8Array}
 */
const buildVer3ForQR = (ver3StoreData) => {
  const dst = ver3StoreData.slice(); // Copy.
  // Mii data created on Wii U, Miitomo, and Switch
  // have birthPlatform set to 4 (= Wii U). That data is
  // not scannable as a QR code on 3DS because it will
  // fail verification if birthPlatform > 3.

  // Set birthPlatform bitfield to 3 (CFLi_BIRTH_PLATFORM_CTR)
  const birthPlatform = 3;
  dst[3] = dst[3] & 143 | (birthPlatform & 7) << 4;
  // Allow the Mii to be copied, for convenience.
  dst[1] |= 1; // copyable = 1
  Crc16Ccitt.updateBigEndian(dst, MiiDataSize.VER3_STORE_DATA);
  return dst;
};

/**
 * Derives a base name for download files.
 * Uses the Mii name if non-empty, otherwise a timestamp + format class.
 */
const buildFileBaseName = (/** @type {string} */ name,
  /** @type {string=} */ typeName) => {
  if (name) {
    return name;
  }

  const pad2 = (/** @type {number} */ n) => (n < 10 ? '0' : '') + n;
  const now = new Date();
  return now.getFullYear() + '-' +
    pad2(now.getMonth() + 1) + '-' +
    pad2(now.getDate()) + '_' +
    pad2(now.getHours()) + '-' +
    pad2(now.getMinutes()) + '-' +
    pad2(now.getSeconds()) + '-' +
    (typeName || 'Unknown');
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

  const rawInput = parseHexOrB64ToBytes(dataValue);
  const name = target.dataset.name || 'Mii';

  const t0 = performance.now();

  const result = convertMiiData(rawInput);

  const t1 = performance.now();
  console.log(`convertMiiData: ${t1 - t0} ms`);

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
  const { studioData, ver3StoreData, ver3ForQR, charInfoData, typeName } = result;

  if (typeName) {
    /** @type {HTMLElement} */ (target.querySelector('.input-type'))
      .textContent = typeName;
  }

  const studioCode = bytesToHex(studioData);
  /** @type {HTMLElement} */ (target.querySelector('.studio-code'))
    .textContent = studioCode;
  /** @type {HTMLAnchorElement} */ (target.querySelector('.mii-instructions-link'))
    .href += studioCode;

  const studioImageElement = /** @type {HTMLElement} */ (target.querySelector('.image-80'));
  const studioURLBytes = new Uint8Array(47);
  StudioObfuscation.encode(studioURLBytes, studioData, 0);
  studioImageElement.setAttribute('src', studioImageElement.dataset.src + bytesToHex(studioURLBytes));

  const ver3StoreDataB64 = bytesToBase64(ver3StoreData);
  /** @type {HTMLElement} */ (target.querySelector('.ver3storedata'))
    .textContent = ver3StoreDataB64;

  const fileBaseName = buildFileBaseName(name, typeName);

  const addButton = (/** @type {HTMLElement} */ el,
    /** @type {string} */ name, /** @type {string=} */ data) => {
    data && (el.dataset.data = data);
    el.dataset.filename = name;
  };

  addButton(/** @type {HTMLElement} */ (target.querySelector('button.download-ffsd')),
    `${fileBaseName}.ffsd`, ver3StoreDataB64);
  addButton(/** @type {HTMLElement} */ (target.querySelector('button.download-switch-charinfo')),
    `${fileBaseName}.charinfo`, bytesToBase64(charInfoData));
  addButton(/** @type {HTMLElement} */ (target.querySelector('button.download-studio-data')),
    `${fileBaseName}.mnms`, bytesToBase64(studioData));

  const modelButton = target.querySelector('.model-download-button');
  const imgElement = target.parentElement && target.parentElement.querySelector('img');
  if (modelButton && imgElement) {
    const linkAdjustGlb = imgElement.src
      // switch shader has transparent faceline
      // texture which will look wrong so we remove it
      .replace('&shaderType=switch', '')
      .replace('.png?', '.glb?');
    modelButton.setAttribute('action', linkAdjustGlb);
  }

  // QR code is async (AES encryption + PNG generation).
  const qrCodeImage = /** @type {HTMLImageElement} */ (target.querySelector('.image-qr'));
  const qrData = new Uint8Array(WrappedMiiDataLength);
  wrappedMiiData.encrypt(qrData, ver3ForQR)
    .then(() => MiiLogoQrCode.generatePng(qrData, name))
    .then((src) => {
      qrCodeImage.src = src;
    });
};

const handleDownloadDataFileButton = (/** @type {MouseEvent} */ event) => {
  event.preventDefault();
  if (!event.target) {
    return;
  }
  // define a filename with the name, TBD: if name is generic then prepend date maybe?
  const el = /** @type {HTMLElement} */ (event.target);
  const filename = el.dataset.filename;
  if (!filename) {
    throw new Error('download button does not have data-filename attribute');
  }
  const dataText = el.dataset.data;
  if (!dataText) {
    throw new Error('download button does not have data-data attribute, where base64 data is supposed to go');
  }

  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([base64ToBytes(dataText)]));
  link.download = filename;
  link.click();
  // revoke the object url after the download is complete
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
    topCopyButton.addEventListener('click', e => copyHandler(/** @type {MouseEvent} */ (e), undefined, 'erri'));
  }

  const details = cloneEl.querySelector('details');
  if (details) {
    details.addEventListener('toggle', handleConvertDetailsToggle);
  }

  const studioCopyButton = /** @type {HTMLButtonElement} */ (cloneEl.querySelector('.copy-studio-url'));
  if (studioCopyButton) {
    studioCopyButton.addEventListener('click', copyHandler);
  }

  for (const btn of /** @type {NodeListOf<HTMLButtonElement>} */
    (cloneEl.querySelectorAll('.download-studio-data, .download-switch-charinfo, .download-ffsd'))) {
    btn.addEventListener('click', handleDownloadDataFileButton);
  }
};

export { bindResultTemplateHandlers, convertMiiData, applyConversionToDetails };
