/**
 * @file MiiLogoQrCode.js
 * @author Arian Kordi <https://github.com/ariankordi>
 * @license Zlib
 * Draws QR codes in the style of the 3DS/Wii U
 * Mii Maker's JPEGs that have the "Mii" logo and name.
 */
// @ts-check

import QRCode from 'qrjs';

class MiiLogoQrCode {
  /** Size of the QR code canvas. */
  static CanvasSize = 176;

  /** Main draw routine. @private */
  static _draw(/** @type {CanvasRenderingContext2D} */ ctx,
    /** @type {HTMLCanvasElement} */ qrCanvas,
    /** @type {CanvasImageSource} */ logoImg,
    /** @type {string} */ text) {
    const cSize = MiiLogoQrCode.CanvasSize;
    // Constants for positioning.
    const frameSize = 130;
    const frameOffY = 5; // translate Y +5 px
    const textShiftY = 75; // translate Y "down" +75px

    // Clear background to white.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, cSize, cSize);

    // Frame: 1px, black, using half-pixel offset.
    const frameX = (cSize - frameSize) >> 1; // centered: 23
    const frameY = frameX - frameOffY; // 28
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(frameX + 0.5, frameY + 0.5, frameSize - 1, frameSize - 1);

    // QR code pattern: smaller than frame, needs to be centered.
    // Expected dimensions: 114x114 (Version 10, high ECC)
    const qrX = frameX + ((frameSize - qrCanvas.width) >> 1);
    const qrY = frameY + ((frameSize - qrCanvas.height) >> 1);
    // Copy the pre-rendered QR code onto the frame.
    ctx.drawImage(qrCanvas, qrX, qrY);

    // Logo: Above QR code, centered inside code, no scaling.
    // Original logo dimensions: 43x43
    const logoWidth = 43;
    const lx = frameX + ((frameSize - logoWidth) >> 1);
    const ly = frameY + ((frameSize - logoWidth) >> 1);
    ctx.drawImage(logoImg, lx, ly);

    // Text: 176x26 box (full width), centered horizontally, translate -75px.
    ctx.font = '17px nintendo_NTLG, sans-serif'; // ≈17 x 22.44 from spec
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textY = (cSize >> 1) + textShiftY; // 88 + 75 = 163
    ctx.fillText(text, cSize >> 1, textY, cSize);
  }

  static async generatePng(/** @type {ArrayLike<number>} */ data, /** @type {string} */ text,
    /** @type {Promise<ImageBitmap>} */ logoPromise = MiiLogoQrCode.getLogoImg()) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = MiiLogoQrCode.CanvasSize;
    const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
    console.assert(ctx != null, 'canvas context is unexpectedly null');
    MiiLogoQrCode._draw(ctx,
      // modulesize 2, no margin: matches the original 114x114 (Version 10, high ECC) code exactly.
      QRCode.generateCanvas(data, { modulesize: 2, margin: 0, ecclevel: 'H' }),
      await logoPromise, text);

    return canvas.toDataURL('image/png'); // png compresses better than jpeg for this
  }

  /** @type {Promise<ImageBitmap>|undefined} @private */ static logoBmp;
  /** @private */
  static getLogoImg = async () => await (MiiLogoQrCode.logoBmp ??= createImageBitmap(/* @__PURE__ */ new Blob([/* @__PURE__ */new Int32Array([1196314761, 169478669, 218103808, 1380206665, 721420288, 721420288, 4, -1010433792, 29, 1094994425, -711907244, -1035059246, -247070720, 174751623, -1912546301, -727947552, -2143468075, 1296664873, -568030836, -2140256830, -976973769, -801668923, 1275183123, 1478578472, 1659401160, 938143450, 2020583166, 2139403864, 1561554886, 658305678, -1837275856, -1414497696, -774292806, -510793669, -600915672, -407851094, -1468185551, -1165830105, 1838843610, 859970232, 917151809, -1559464928, -1134172041, -1173345879, -338347206, 1732653891, 938735680, 426361024, -796848569, 1660728911, -1703025875, -99522122, 1250091073, 912940486, -2114329368, 2033125728, -1489853314, 167371922, 1007290782, -1387417496, 1503665608, 353378788, 400296569, -463993223, -666225132, -298658538, -1908808429, 1953410631, -2001051874, -406430673, 1607278975, -851808284, 1636121263, 6450, 1162412032, 1118717006, 33376])], { type: 'image/png' })));
}

const getQrCodePng = async (/** @type {ArrayLike<number>} */ data,
  /** @type {string} */ name, enableLogo = true) =>
  data.length === 112 && enableLogo
    ? await MiiLogoQrCode.generatePng(data, name)
    // TODO: empty margin not supported, must fix
    : QRCode.generatePNG(data, { ecclevel: 'H', margin: null });

export {
  MiiLogoQrCode,
  getQrCodePng
};
