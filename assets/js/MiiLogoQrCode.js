/**
 * @file MiiLogoQrCode.js
 * @author Arian Kordi <https://github.com/ariankordi>
 * Draws QR codes in the style of the 3DS/Wii U
 * Mii Maker's JPEGs that have the "Mii" logo and name.
 */
// @ts-check

import QRCode from 'qrjs';

class MiiLogoQrCode {
  /** @private */
  static getQrSize(/** @type {Array<Array<number>>} */ matrix, /** @type {number} */ modsize) {
    return modsize * (matrix.length); // + 2 * margin);
  }

  /**
   * https://github.com/educastellano/qr.js/blob/e530abedf060d98ea101abef5300ccd6ecac17b9/qr.js#L779
   * @param {CanvasRenderingContext2D} context
   * @param {Array<Array<number>>} matrix
   * @param {number} modsize
   * @param {number} [x]
   * @param {number} [y]
   * @private
   */
  static drawQrMatrix(context, matrix, modsize, x = 0, y = 0) {
    for (let i = 0; i < matrix.length; ++i) {
      for (let j = 0; j < matrix.length; ++j) {
        if (!matrix[i][j]) {
          continue;
        }
        context.fillRect(x + (modsize * (/* margin + */j)),
          y + (modsize * (/* margin + */i)),
          modsize, modsize);
      }
    }
  }

  /** Size of the QR code canvas. */
  static CanvasSize = 176;

  /**
   * Main draw routine.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Array<Array<number>>} qrMatrix
   * @param {CanvasImageSource} logoImg
   * @param {string} textStr
   * @private
   */
  static drawQrCodeWithText(ctx, qrMatrix, logoImg, textStr) {
    const canvasSize = 176;
    // Constants for positioning.
    const frameSize = 130;
    const frameOffY = 5; // translate Y +5 px
    const textShiftY = 75; // "translate Y DOWN -74px" -> +74 in Canvas coords

    // Clear background to white.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // Frame: 1px, black, using half-pixel offset.
    const frameX = (canvasSize - frameSize) >> 1; // centred: 23
    const frameY = frameX - frameOffY; // 28
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(frameX + 0.5, frameY + 0.5, frameSize - 1, frameSize - 1);

    // QR code pattern: smaller than frame, needs to be centered.
    // Expected dimensions: 114x114 (Version 10, high ECC)
    const modsize = 2;
    const barcodeSize = MiiLogoQrCode.getQrSize(qrMatrix, modsize);

    const qrX = frameX + ((frameSize - barcodeSize) >> 1);
    const qrY = frameY + ((frameSize - barcodeSize) >> 1);
    ctx.fillStyle = '#000';
    // Draw the QR code matrix.
    MiiLogoQrCode.drawQrMatrix(ctx, qrMatrix, modsize, qrX, qrY);

    // Logo: Above QR code, centered inside code, no scaling.
    // Original logo dimensions: 43x43
    const logoWidth = 43;
    const lx = frameX + ((frameSize - logoWidth) >> 1);
    const ly = frameY + ((frameSize - logoWidth) >> 1);
    ctx.drawImage(logoImg, lx, ly);

    // Text: 176x26 box (full width), centered horizontally, translate -74px.
    ctx.font = '17px nintendo_NTLG, sans-serif'; // ≈17 x 22.44 from spec
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textY = (canvasSize >> 1) + textShiftY; // 88 + 74 = 162
    ctx.fillText(textStr, canvasSize >> 1, textY, canvasSize);
  }

  static drawToCanvas = (/** @type {CanvasRenderingContext2D} */ ctx,
    /** @type {ArrayLike<number>} */ qrBytes, /** @type {string} */ textStr,
    /** @type {CanvasImageSource} */ logoImg) =>
    MiiLogoQrCode.drawQrCodeWithText(ctx,
      QRCode.generate(qrBytes, { ecclevel: 'H' }), logoImg, textStr);

  static async generatePng(/** @type {ArrayLike<number>} */ data, /** @type {string} */ name) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = MiiLogoQrCode.CanvasSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('canvas context Is null.');
    }
    MiiLogoQrCode.drawToCanvas(ctx, data, name,
      await MiiLogoQrCode.getLogoImg());
    return canvas.toDataURL('image/png'); // png compresses better than jpeg for this
  }

  /** @private @type {Promise<ImageBitmap>|undefined} */ static logoBmp;
  /** @private */
  static getLogoImg = async () => await (MiiLogoQrCode.logoBmp ??= createImageBitmap(/* @__PURE__ */ new Blob([/* @__PURE__ */new Int32Array([1196314761, 169478669, 218103808, 1380206665, 721420288, 721420288, 4, -1010433792, 29, 1094994425, -711907244, -1035059246, -247070720, 174751623, -1912546301, -727947552, -2143468075, 1296664873, -568030836, -2140256830, -976973769, -801668923, 1275183123, 1478578472, 1659401160, 938143450, 2020583166, 2139403864, 1561554886, 658305678, -1837275856, -1414497696, -774292806, -510793669, -600915672, -407851094, -1468185551, -1165830105, 1838843610, 859970232, 917151809, -1559464928, -1134172041, -1173345879, -338347206, 1732653891, 938735680, 426361024, -796848569, 1660728911, -1703025875, -99522122, 1250091073, 912940486, -2114329368, 2033125728, -1489853314, 167371922, 1007290782, -1387417496, 1503665608, 353378788, 400296569, -463993223, -666225132, -298658538, -1908808429, 1953410631, -2001051874, -406430673, 1607278975, -851808284, 1636121263, 6450, 1162412032, 1118717006, 33376])], { type: 'image/png' })));
}

// const getQrCodePng = (/** @type {ArrayLike<number>} */ data) =>
//  // 112 byte WrappedMiiData QR codes are version 10 and have high error correction.
//  // Matches the original QR code images 1:1.
//  // QRCode.generatePNG(encryptedBytes, { margin: 0, modulesize: 2, ecclevel: 'H' });
//  QRCode.generatePNG(data, { margin: null, ecclevel: 'H' });

const getQrCodePng = async (/** @type {ArrayLike<number>} */ data,
  /** @type {string} */ name, enableLogo = true) =>
  data.length === 112 && enableLogo
    ? await MiiLogoQrCode.generatePng(data, name)
    : QRCode.generatePNG(data, { margin: null, ecclevel: 'H' });

export {
  MiiLogoQrCode,
  getQrCodePng
};
