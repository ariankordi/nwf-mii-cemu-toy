// Generated automatically with "fut". Do not edit.

/**
 * Utility for converting 16-bit strings to/from UTF-8.
 */
export class Char16
{

	/**
	 * Writes UTF-8 text from a buffer of 16-bit wide characters
	 * that are within the Unicode BMP, also known as UCS-2 encoded text.
	 * This does not support decoding UTF-16 surrogate pairs for
	 * characters beyond the Basic Multilingual Plane (emoji, etc.)
	 * @param dst Destination UTF-8 bytes to write to. Size MUST be 3 * characterCount.
	 * @param src Source array of 16-bit code points.
	 * @param characterCount Amount of characters from the original string to process.
	 */
	static toUtf8(dst, src, characterCount, srcOffset = 0, dstOffset = 0)
	{
		console.assert(characterCount > 0);
		let iDst = 0;
		for (let i = 0; i < characterCount && src[srcOffset + i] != 0; i++) {
			let chr = src[srcOffset + i];
			if (chr <= 127)
				dst[dstOffset + iDst++] = chr;
			else if (chr <= 2047) {
				dst[dstOffset + iDst + 0] = 192 | chr >> 6;
				dst[dstOffset + iDst + 1] = 128 | (chr & 63);
				iDst += 2;
			}
			else {
				if (chr >= 55296 && chr <= 57343) {
					chr = 65533;
				}
				dst[dstOffset + iDst + 0] = 224 | chr >> 12;
				dst[dstOffset + iDst + 1] = 128 | (chr >> 6 & 63);
				dst[dstOffset + iDst + 2] = 128 | (chr & 63);
				iDst += 3;
			}
		}
		return iDst;
	}

	static fromUtf8(dst, src, srcSize, srcOffset = 0, dstOffset = 0)
	{
		console.assert(srcSize > 0);
		let dstIndex = 0;
		for (let i = 0; i < srcSize && src[srcOffset + i] != 0; dstIndex++) {
			let current = src[srcOffset + i];
			let chr = 0;
			if ((current & 224) == 224 && (current & 16) == 0) {
				chr = (src[srcOffset + i] & 15) << 12 | (src[srcOffset + i + 1] & 63) << 6 | (src[srcOffset + i + 2] & 63) << 0;
				i += 3;
			}
			else if ((current & 192) == 192 && (current & 32) == 0) {
				chr = (src[srcOffset + i] & 31) << 6 | (src[srcOffset + i + 1] & 63) << 0;
				i += 2;
			}
			else
				chr = src[srcOffset + i++] & 127;
			dst[dstOffset + dstIndex] = chr;
		}
		return dstIndex;
	}

	static toString(src, characterCount, srcOffset = 0)
	{
		let buf = new Uint8Array(characterCount * 3);
		let length = Char16.toUtf8(buf, src, characterCount, srcOffset);
		return new TextDecoder().decode(buf.subarray(0, length));
	}
}

/**
 * Implements the CRC-16/CCITT checksum calculation.
 * This class provides a static method for computing
 * the CRC-16/CCITT checksum over an input byte array.
 * The algorithm uses the polynomial 0x1021, an initial
 * value of 0xFFFF, and a default context of 0x0000.
 */
export class Crc16Ccitt
{

	/**
	 * Calculates the CRC-16/CCITT checksum for the specified input data.
	 * Courtesy of Luciano Barcaro: https://stackoverflow.com/a/30357446
	 */
	static calculate(input, size)
	{
		let msb = 0;
		let lsb = 0;
		for (let i = 0; i < size; i++) {
			let x = input[i] ^ msb;
			x ^= x >> 4;
			msb = (lsb ^ x >> 3 ^ x << 4) & 255;
			lsb = (x ^ x << 5) & 255;
		}
		return msb << 8 | lsb;
	}

	static updateBigEndian(data, end, start = 0)
	{
		let offset = start + end - 2;
		data[offset] = data[offset + 1] = 0;
		for (let i = 0; i < end - 2; i++) {
			let x = data[start + i] ^ data[offset];
			x ^= x >> 4;
			data[offset] = (data[offset + 1] ^ x >> 3 ^ x << 4) & 255;
			data[offset + 1] = (x ^ x << 5) & 255;
		}
	}
}

export class MiiDecoder
{

	static #i2b(i)
	{
		return i == 1;
	}

	static #loadArrayU16LittleEndian(src, srcOffset, dst, dstOffset, count)
	{
		for (let i = 0; i < count; i++)
			dst[dstOffset + i] = (src[srcOffset + i * 2] & 255) | src[srcOffset + i * 2 + 1] << 8;
	}

	static #loadArrayU16BigEndian(src, srcOffset, dst, dstOffset, count)
	{
		for (let i = 0; i < count; i++)
			dst[dstOffset + i] = src[srcOffset + i * 2] << 8 | (src[srcOffset + i * 2 + 1] & 255);
	}

	static #convVer3ToNx(info)
	{
		if (info.hairColor == 0)
			info.hairColor = 8;
		if (info.beardColor == 0)
			info.beardColor = 8;
		if (info.eyebrowColor == 0)
			info.eyebrowColor = 8;
		info.mouthColor += 19;
		info.eyeColor += 8;
		if (info.glassColor == 0)
			info.glassColor = 8;
		else if (info.glassColor < 6)
			info.glassColor += 13;
		if (info.build > 127)
			info.build = 127;
		if (info.height > 127)
			info.height = 127;
	}

	static visualFromVer3Core(src, info)
	{
		info.beardColor = src[66] >> 3 & 7;
		info.beardType = src[66] & 7;
		info.build = src[47];
		info.eyeAspect = src[53] >> 5;
		info.eyeColor = (src[53] & 1) << 2 | src[52] >> 6;
		info.eyeRotate = src[54] & 31;
		info.eyeScale = src[53] >> 1 & 15;
		info.eyeType = src[52] & 63;
		info.eyeX = (src[55] & 1) << 3 | src[54] >> 5;
		info.eyeY = src[55] >> 1 & 31;
		info.eyebrowAspect = src[57] >> 4 & 7;
		info.eyebrowColor = src[56] >> 5;
		info.eyebrowRotate = src[58] & 31;
		info.eyebrowScale = src[57] & 15;
		info.eyebrowType = src[56] & 31;
		info.eyebrowX = (src[59] & 1) << 3 | src[58] >> 5;
		info.eyebrowY = src[59] >> 1 & 31;
		info.facelineColor = src[48] >> 5;
		info.facelineMake = src[49] >> 4;
		info.facelineType = src[48] >> 1 & 15;
		info.facelineWrinkle = src[49] & 15;
		info.favoriteColor = src[25] >> 2 & 15;
		info.gender = src[24] & 1;
		info.glassColor = src[68] >> 4 & 7;
		info.glassScale = (src[69] & 7) * 2 | src[68] >> 7;
		info.glassType = src[68] & 15;
		info.glassY = src[69] >> 3;
		info.hairColor = src[51] & 7;
		info.hairFlip = src[51] >> 3 & 1;
		info.hairType = src[50];
		info.height = src[46];
		info.moleScale = src[70] >> 1 & 15;
		info.moleType = src[70] & 1;
		info.moleX = (src[71] & 3) << 3 | src[70] >> 5;
		info.moleY = src[71] >> 2 & 31;
		info.mouthAspect = src[63] >> 5;
		info.mouthColor = (src[63] & 1) << 2 | src[62] >> 6;
		info.mouthScale = src[63] >> 1 & 15;
		info.mouthType = src[62] & 63;
		info.mouthY = src[64] & 31;
		info.mustacheScale = (src[67] & 3) << 2 | src[66] >> 6;
		info.mustacheType = src[64] >> 5;
		info.mustacheY = src[67] >> 2 & 31;
		info.noseScale = (src[61] & 1) << 3 | src[60] >> 5;
		info.noseType = src[60] & 31;
		info.noseY = src[61] >> 1 & 31;
		MiiDecoder.#convVer3ToNx(info);
	}

	static fromVer3Core(src, info, ex)
	{
		MiiDecoder.visualFromVer3Core(src, info);
		ex.clearFlag();
		ex.setFlag(MiiExtraFlag.NICKNAME);
		ex.setFlag(MiiExtraFlag.SPECIAL);
		ex.setFlag(MiiExtraFlag.FAVORITE_LOCAL_BIRTH);
		ex.setFlag(MiiExtraFlag.REGION_FONT_MOVE);
		ex.setFlag(MiiExtraFlag.VER3_PERSONAL);
		ex.copyable = MiiDecoder.#i2b(src[1] & 1);
		ex.ngWord = MiiDecoder.#i2b(src[1] >> 1 & 1);
		ex.regionMove = src[1] >> 2 & 3;
		ex.fontRegion = src[1] >> 4 & 3;
		ex.roomIndex = src[2] & 15;
		ex.positionInRoom = src[2] >> 4;
		ex.birthPlatform = src[3] >> 4 & 7;
		ex.birthMonth = src[24] >> 1 & 15;
		ex.birthDay = (src[25] & 3) << 3 | src[24] >> 5;
		ex.favorite = MiiDecoder.#i2b(src[25] >> 6 & 1);
		ex.localOnly = MiiDecoder.#i2b(src[48] & 1);
		ex.authorId.set(src.subarray(4, 12));
		ex.createId.set(src.subarray(12, 22));
		ex.isSpecial = !Ver3CreateId.isNormal(ex.createId[0]);
		MiiDecoder.#loadArrayU16LittleEndian(src, 26, ex.nickname, 0, 10);
	}

	static fromVer3Data(src, info, ex)
	{
		MiiDecoder.fromVer3Core(src, info, ex);
		ex.setFlag(MiiExtraFlag.CREATOR_NAME);
		MiiDecoder.#loadArrayU16LittleEndian(src, 72, ex.creatorName, 0, 10);
	}

	static fromVer3StoreData(src, info, ex)
	{
		MiiDecoder.fromVer3Data(src, info, ex);
		return Crc16Ccitt.calculate(src, MiiDataSize.VER3_STORE_DATA) == 0;
	}

	static visualFromNxCore(src, info)
	{
		info.beardColor = src[7] & 127;
		info.beardType = src[13] >> 5;
		info.build = src[2] & 127;
		info.eyeAspect = src[17] >> 5;
		info.eyeColor = src[4] & 127;
		info.eyeRotate = src[16] >> 5;
		info.eyeScale = src[18] >> 5;
		info.eyeType = src[9] & 63;
		info.eyeX = src[23] >> 4;
		info.eyeY = src[11] & 31;
		info.eyebrowAspect = src[15] >> 5;
		info.eyebrowColor = src[5] & 127;
		info.eyebrowRotate = src[24] >> 4;
		info.eyebrowScale = src[24] & 15;
		info.eyebrowType = src[12] & 31;
		info.eyebrowX = src[25] & 15;
		info.eyebrowY = (src[25] >> 4) + 3;
		info.facelineColor = src[22] & 15;
		info.facelineMake = src[23] & 15;
		info.facelineType = src[21] >> 4;
		info.facelineWrinkle = src[22] >> 4;
		info.favoriteColor = src[21] & 15;
		info.gender = src[4] >> 7;
		info.glassColor = src[8] & 127;
		info.glassScale = src[11] >> 5;
		info.glassType = src[20] & 31;
		info.glassY = src[17] & 31;
		info.hairColor = src[3] & 127;
		info.hairFlip = src[2] >> 7;
		info.hairType = src[0];
		info.height = src[1] & 127;
		info.moleScale = src[27] >> 4;
		info.moleType = src[1] >> 7;
		info.moleX = src[18] & 31;
		info.moleY = src[19] & 31;
		info.mouthAspect = src[14] >> 5;
		info.mouthColor = src[6] & 127;
		info.mouthScale = src[26] >> 4;
		info.mouthType = src[10] & 63;
		info.mouthY = src[15] & 31;
		info.mustacheScale = src[27] & 15;
		info.mustacheType = src[12] >> 5;
		info.mustacheY = src[16] & 31;
		info.noseScale = src[26] & 15;
		info.noseType = src[13] & 31;
		info.noseY = src[14] & 31;
	}

	static fromNxCoreParam(src, info, ex)
	{
		MiiDecoder.visualFromNxCore(src, info);
		ex.clearFlag();
		ex.setFlag(MiiExtraFlag.SPECIAL);
		ex.setFlag(MiiExtraFlag.REGION_FONT_MOVE);
		ex.isSpecial = MiiDecoder.#i2b(src[3] >> 7);
		ex.fontRegion = src[10] >> 6;
		ex.regionMove = src[9] >> 6;
	}

	static fromNxCore(src, info, ex)
	{
		MiiDecoder.fromNxCoreParam(src, info, ex);
		ex.setFlag(MiiExtraFlag.NICKNAME);
		MiiDecoder.#loadArrayU16LittleEndian(src, 28, ex.nickname, 0, 10);
	}

	static fromNxStoreData(src, info, ex)
	{
		MiiDecoder.fromNxCore(src, info, ex);
		ex.setFlag(MiiExtraFlag.NX_CREATE_ID);
		ex.setFlag(MiiExtraFlag.NX_DEVICE_CRC);
		ex.createId.set(src.subarray(48, 64));
		ex.authorId.set(src.subarray(66, 68));
		return Crc16Ccitt.calculate(src, 64) == 0;
	}

	static visualFromNxCharInfo(src, info)
	{
		info.beardColor = src[74];
		info.beardType = src[75];
		info.build = src[42];
		info.eyeAspect = src[55];
		info.eyeColor = src[53];
		info.eyeRotate = src[56];
		info.eyeScale = src[54];
		info.eyeType = src[52];
		info.eyeX = src[57];
		info.eyeY = src[58];
		info.eyebrowAspect = src[62];
		info.eyebrowColor = src[60];
		info.eyebrowRotate = src[63];
		info.eyebrowScale = src[61];
		info.eyebrowType = src[59];
		info.eyebrowX = src[64];
		info.eyebrowY = src[65];
		info.facelineColor = src[46];
		info.facelineMake = src[48];
		info.facelineType = src[45];
		info.facelineWrinkle = src[47];
		info.favoriteColor = src[39];
		info.gender = src[40];
		info.glassColor = src[80];
		info.glassScale = src[81];
		info.glassType = src[79];
		info.glassY = src[82];
		info.hairColor = src[50];
		info.hairFlip = src[51];
		info.hairType = src[49];
		info.height = src[41];
		info.moleScale = src[84];
		info.moleType = src[83];
		info.moleX = src[85];
		info.moleY = src[86];
		info.mouthAspect = src[72];
		info.mouthColor = src[70];
		info.mouthScale = src[71];
		info.mouthType = src[69];
		info.mouthY = src[73];
		info.mustacheScale = src[77];
		info.mustacheType = src[76];
		info.mustacheY = src[78];
		info.noseScale = src[67];
		info.noseType = src[66];
		info.noseY = src[68];
	}

	static fromNxCharInfo(src, info, ex)
	{
		MiiDecoder.visualFromNxCharInfo(src, info);
		ex.clearFlag();
		ex.setFlag(MiiExtraFlag.NICKNAME);
		ex.setFlag(MiiExtraFlag.SPECIAL);
		ex.setFlag(MiiExtraFlag.REGION_FONT_MOVE);
		ex.setFlag(MiiExtraFlag.NX_CREATE_ID);
		ex.isSpecial = MiiDecoder.#i2b(src[43]);
		ex.fontRegion = src[38];
		ex.regionMove = src[44];
		ex.createId.set(src.subarray(0, 16));
		MiiDecoder.#loadArrayU16LittleEndian(src, 16, ex.nickname, 0, 10);
	}

	static fromStudioData(src, info)
	{
		info.beardColor = src[0];
		info.beardType = src[1];
		info.build = src[2];
		info.eyeAspect = src[3];
		info.eyeColor = src[4];
		info.eyeRotate = src[5];
		info.eyeScale = src[6];
		info.eyeType = src[7];
		info.eyeX = src[8];
		info.eyeY = src[9];
		info.eyebrowAspect = src[10];
		info.eyebrowColor = src[11];
		info.eyebrowRotate = src[12];
		info.eyebrowScale = src[13];
		info.eyebrowType = src[14];
		info.eyebrowX = src[15];
		info.eyebrowY = src[16];
		info.facelineColor = src[17];
		info.facelineMake = src[18];
		info.facelineType = src[19];
		info.facelineWrinkle = src[20];
		info.favoriteColor = src[21];
		info.gender = src[22];
		info.glassColor = src[23];
		info.glassScale = src[24];
		info.glassType = src[25];
		info.glassY = src[26];
		info.hairColor = src[27];
		info.hairFlip = src[28];
		info.hairType = src[29];
		info.height = src[30];
		info.moleScale = src[31];
		info.moleType = src[32];
		info.moleX = src[33];
		info.moleY = src[34];
		info.mouthAspect = src[35];
		info.mouthColor = src[36];
		info.mouthScale = src[37];
		info.mouthType = src[38];
		info.mouthY = src[39];
		info.mustacheScale = src[40];
		info.mustacheType = src[41];
		info.mustacheY = src[42];
		info.noseScale = src[43];
		info.noseType = src[44];
		info.noseY = src[45];
	}

	static fromStudioUrlData(src, info)
	{
		const raw = new Uint8Array(46);
		StudioObfuscation.decode(raw, src);
		MiiDecoder.fromStudioData(raw, info);
	}

	static visualFromRflCore(src, info)
	{
		info.beardColor = src[50] >> 1 & 7;
		info.beardType = src[50] >> 4 & 3;
		info.build = src[23];
		info.eyeAspect = 3;
		info.eyeColor = src[42] >> 5;
		info.eyeRotate = src[41] >> 5 | (src[40] & 3) << 3;
		info.eyeScale = src[42] >> 1 & 15;
		info.eyeType = src[40] >> 2;
		info.eyeX = src[43] >> 5 | (src[42] & 1) << 3;
		info.eyeY = src[41] & 31;
		info.eyebrowAspect = 3;
		info.eyebrowColor = src[38] >> 5;
		info.eyebrowRotate = src[37] >> 6 | (src[36] & 7) << 2;
		info.eyebrowScale = src[38] >> 1 & 15;
		info.eyebrowType = src[36] >> 3;
		info.eyebrowX = src[39] & 15;
		info.eyebrowY = src[39] >> 4 | (src[38] & 1) << 4;
		info.facelineColor = src[32] >> 2 & 7;
		let faceTex = src[33] >> 6 | (src[32] & 3) << 2;
		info.facelineMake = MiiDecoder.#VISUAL_FROM_RFL_CORE_FACE_TEX_TABLE[faceTex * 2 + 1];
		info.facelineType = src[32] >> 5;
		info.facelineWrinkle = MiiDecoder.#VISUAL_FROM_RFL_CORE_FACE_TEX_TABLE[faceTex * 2];
		info.favoriteColor = src[1] >> 1 & 15;
		info.gender = src[0] >> 6 & 1;
		info.glassColor = src[48] >> 1 & 7;
		info.glassScale = src[49] >> 5 | (src[48] & 1) << 3;
		info.glassType = src[48] >> 4;
		info.glassY = src[49] & 31;
		info.hairColor = src[35] >> 6 | (src[34] & 1) << 2;
		info.hairFlip = src[35] >> 5 & 1;
		info.hairType = src[34] >> 1;
		info.height = src[22];
		info.moleScale = src[52] >> 3 & 15;
		info.moleType = src[52] >> 7;
		info.moleX = src[53] >> 1 & 31;
		info.moleY = src[53] >> 6 | (src[52] & 7) << 2;
		info.mouthAspect = 3;
		info.mouthColor = src[46] >> 1 & 3;
		info.mouthScale = src[47] >> 5 | (src[46] & 1) << 3;
		info.mouthType = src[46] >> 3;
		info.mouthY = src[47] & 31;
		info.mustacheScale = src[51] >> 5 | (src[50] & 1) << 3;
		info.mustacheType = src[50] >> 6;
		info.mustacheY = src[51] & 31;
		info.noseScale = src[44] & 15;
		info.noseType = src[44] >> 4;
		info.noseY = src[45] >> 3;
		MiiDecoder.#convVer3ToNx(info);
	}

	static fromRflCore(src, info, ex)
	{
		MiiDecoder.visualFromRflCore(src, info);
		ex.clearFlag();
		ex.setFlag(MiiExtraFlag.NICKNAME);
		ex.setFlag(MiiExtraFlag.SPECIAL);
		ex.setFlag(MiiExtraFlag.FAVORITE_LOCAL_BIRTH);
		ex.setFlag(MiiExtraFlag.RFL_CREATE_ID);
		ex.birthMonth = src[0] >> 2 & 15;
		ex.birthDay = src[1] >> 5 | (src[0] & 3) << 3;
		ex.favorite = MiiDecoder.#i2b(src[1] & 1);
		ex.localOnly = MiiDecoder.#i2b(src[33] >> 2 & 1);
		ex.createId.set(src.subarray(24, 32));
		ex.isSpecial = !Ver3CreateId.isNormal(ex.createId[0]);
		MiiDecoder.#loadArrayU16BigEndian(src, 2, ex.nickname, 0, 10);
	}

	static fromRflData(src, info, ex)
	{
		MiiDecoder.fromRflCore(src, info, ex);
		ex.setFlag(MiiExtraFlag.CREATOR_NAME);
		MiiDecoder.#loadArrayU16BigEndian(src, 54, ex.creatorName, 0, 10);
	}

	static fromRflStoreData(src, info, ex)
	{
		MiiDecoder.fromRflData(src, info, ex);
		return Crc16Ccitt.calculate(src, MiiDataSize.RFL_STORE_DATA) == 0;
	}

	static #VISUAL_FROM_RFL_CORE_FACE_TEX_TABLE = new Uint8Array([ 0, 0, 0, 1, 0, 6, 0, 9, 5, 0, 2, 0, 3, 0, 7, 0,
		8, 0, 0, 10, 9, 0, 11, 0 ]);
}

class NxToVer3
{

	static TO_VER3_HAIR_COLOR = new Uint8Array([ 0, 1, 2, 3, 4, 5, 6, 7, 0, 4, 3, 5, 4, 4, 6, 2,
		0, 6, 4, 3, 2, 2, 7, 3, 2, 2, 2, 2, 2, 2, 2, 2,
		2, 2, 2, 2, 2, 2, 2, 2, 2, 4, 4, 4, 4, 4, 4, 4,
		0, 0, 4, 4, 4, 4, 4, 4, 0, 0, 0, 4, 4, 4, 4, 4,
		4, 5, 5, 5, 4, 4, 4, 4, 4, 4, 4, 5, 7, 5, 7, 7,
		7, 7, 7, 6, 7, 7, 7, 7, 7, 3, 7, 7, 7, 7, 7, 0,
		4, 4, 4, 4 ]);

	static TO_VER3_EYE_COLOR = new Uint8Array([ 0, 2, 2, 2, 1, 3, 2, 3, 0, 1, 2, 3, 4, 5, 2, 2,
		4, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
		2, 2, 2, 2, 2, 2, 0, 0, 4, 4, 4, 4, 4, 4, 4, 1,
		0, 4, 4, 4, 4, 4, 4, 4, 0, 5, 5, 5, 5, 5, 5, 5,
		5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 3, 3, 3, 3, 3,
		3, 3, 3, 2, 2, 3, 3, 3, 3, 2, 2, 2, 2, 2, 1, 1,
		1, 1, 1, 1 ]);

	static TO_VER3_MOUTH_COLOR = new Uint8Array([ 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 1,
		4, 4, 4, 0, 1, 2, 3, 4, 4, 2, 3, 3, 4, 4, 4, 4,
		1, 4, 4, 2, 3, 3, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3,
		4, 4, 4, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 3, 3, 3,
		3, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 4, 4, 3, 3, 3,
		3, 3, 3, 4, 3, 3, 3, 3, 3, 4, 0, 3, 3, 3, 3, 4,
		3, 3, 3, 3 ]);

	static TO_VER3_GLASS_COLOR = new Uint8Array([ 0, 1, 1, 1, 5, 1, 1, 4, 0, 5, 1, 1, 3, 5, 1, 2,
		3, 4, 5, 4, 2, 2, 4, 4, 2, 2, 2, 2, 2, 2, 2, 2,
		2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
		3, 3, 3, 3, 3, 3, 3, 3, 0, 0, 0, 5, 5, 5, 5, 5,
		5, 0, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
		5, 5, 5, 1, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5,
		5, 5, 5, 5 ]);

	static TO_VER3_FACELINE_COLOR = new Uint8Array([ 0, 1, 2, 3, 4, 5, 0, 1, 5, 5 ]);

	static TO_VER3_GLASS_TYPE = new Uint8Array([ 0, 1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 1, 3, 7, 7, 6,
		7, 8, 7, 7 ]);
}

export class MiiEncoder
{

	static #b2i(b)
	{
		return b ? 1 : 0;
	}

	static #storeArrayU16LittleEndian(src, srcOffset, dst, dstOffset, count)
	{
		for (let i = 0; i < count; i++) {
			dst[dstOffset + i * 2] = src[srcOffset + i] & 255;
			dst[dstOffset + i * 2 + 1] = src[srcOffset + i] >> 8;
		}
	}

	static #storeArrayU16BigEndian(src, srcOffset, dst, dstOffset, count)
	{
		for (let i = 0; i < count; i++) {
			dst[dstOffset + i * 2] = src[srcOffset + i] >> 8;
			dst[dstOffset + i * 2 + 1] = src[srcOffset + i] & 255;
		}
	}

	static storeU16BigEndian(value, dst, dstOffset)
	{
		dst[dstOffset] = value >> 8;
		dst[dstOffset + 1] = value & 255;
	}

	static visualToVer3Core(dst, info)
	{
		let facelineColor = NxToVer3.TO_VER3_FACELINE_COLOR[info.facelineColor];
		let hairColor = NxToVer3.TO_VER3_HAIR_COLOR[info.hairColor];
		let eyeColor = NxToVer3.TO_VER3_EYE_COLOR[info.eyeColor];
		let eyebrowColor = NxToVer3.TO_VER3_HAIR_COLOR[info.eyebrowColor];
		let mouthColor = NxToVer3.TO_VER3_MOUTH_COLOR[info.mouthColor];
		let beardColor = NxToVer3.TO_VER3_HAIR_COLOR[info.beardColor];
		let glassType = NxToVer3.TO_VER3_GLASS_TYPE[info.glassType];
		let glassColor = NxToVer3.TO_VER3_GLASS_COLOR[info.glassColor];
		let tmp;
		dst[0] = 3;
		dst[25] = (dst[25] & 195) | (info.favoriteColor & 15) * 4;
		dst[46] = info.height;
		dst[47] = info.build;
		dst[48] = (dst[48] & 31) | facelineColor << 5;
		dst[49] = (dst[49] & 15) | info.facelineMake << 4;
		dst[48] = (dst[48] & 225) | (info.facelineType & 15) * 2;
		dst[49] = (dst[49] & 240) | (info.facelineWrinkle & 15);
		dst[50] = info.hairType;
		dst[51] = (dst[51] & 248) | (hairColor & 7);
		dst[51] = (dst[51] & 247) | (info.hairFlip & 1) * 8;
		dst[52] = (dst[52] & 192) | (info.eyeType & 63);
		tmp = eyeColor & 7;
		dst[52] = ((dst[52] & 63) | tmp << 6) & 255;
		dst[53] = ((dst[53] & 254) | tmp >> 2) & 255;
		dst[53] = (dst[53] & 225) | (info.eyeScale & 15) * 2;
		dst[53] = (dst[53] & 31) | info.eyeAspect << 5;
		dst[54] = (dst[54] & 224) | (info.eyeRotate & 31);
		tmp = info.eyeX & 15;
		dst[54] = ((dst[54] & 31) | tmp << 5) & 255;
		dst[55] = ((dst[55] & 254) | tmp >> 3) & 255;
		dst[55] = (dst[55] & 193) | (info.eyeY & 31) * 2;
		dst[56] = (dst[56] & 224) | (info.eyebrowType & 31);
		dst[56] = (dst[56] & 31) | eyebrowColor << 5;
		dst[57] = (dst[57] & 240) | (info.eyebrowScale & 15);
		dst[57] = (dst[57] & 143) | (info.eyebrowAspect & 7) << 4;
		dst[58] = (dst[58] & 224) | (info.eyebrowRotate & 31);
		tmp = info.eyebrowX & 15;
		dst[58] = ((dst[58] & 31) | tmp << 5) & 255;
		dst[59] = ((dst[59] & 254) | tmp >> 3) & 255;
		dst[59] = (dst[59] & 193) | (info.eyebrowY & 31) * 2;
		dst[60] = (dst[60] & 224) | (info.noseType & 31);
		tmp = info.noseScale & 15;
		dst[60] = ((dst[60] & 31) | tmp << 5) & 255;
		dst[61] = ((dst[61] & 254) | tmp >> 3) & 255;
		dst[61] = (dst[61] & 193) | (info.noseY & 31) * 2;
		dst[62] = (dst[62] & 192) | (info.mouthType & 63);
		tmp = mouthColor & 7;
		dst[62] = ((dst[62] & 63) | tmp << 6) & 255;
		dst[63] = ((dst[63] & 254) | tmp >> 2) & 255;
		dst[63] = (dst[63] & 225) | (info.mouthScale & 15) * 2;
		dst[63] = (dst[63] & 31) | info.mouthAspect << 5;
		dst[64] = (dst[64] & 224) | (info.mouthY & 31);
		dst[64] = (dst[64] & 31) | info.mustacheType << 5;
		dst[66] = (dst[66] & 248) | (info.beardType & 7);
		dst[66] = (dst[66] & 199) | (beardColor & 7) * 8;
		tmp = info.mustacheScale & 15;
		dst[66] = ((dst[66] & 63) | tmp << 6) & 255;
		dst[67] = ((dst[67] & 252) | tmp >> 2) & 255;
		dst[67] = (dst[67] & 131) | (info.mustacheY & 31) * 4;
		dst[68] = (dst[68] & 240) | (glassType & 15);
		dst[68] = (dst[68] & 143) | (glassColor & 7) << 4;
		tmp = info.glassScale & 15;
		dst[68] = ((dst[68] & 127) | tmp << 7) & 255;
		dst[69] = ((dst[69] & 248) | tmp >> 1) & 255;
		dst[69] = (dst[69] & 7) | info.glassY * 8;
		dst[70] = (dst[70] & 254) | (info.moleType & 1);
		dst[70] = (dst[70] & 225) | (info.moleScale & 15) * 2;
		tmp = info.moleX & 31;
		dst[70] = ((dst[70] & 31) | tmp << 5) & 255;
		dst[71] = ((dst[71] & 252) | tmp >> 3) & 255;
		dst[71] = (dst[71] & 131) | (info.moleY & 31) * 4;
		dst[24] = (dst[24] & 254) | (info.gender & 1);
	}

	static toVer3Core(dst, info, ex)
	{
		MiiEncoder.visualToVer3Core(dst, info);
		if (ex.hasFlag(MiiExtraFlag.NICKNAME)) {
			MiiEncoder.#storeArrayU16LittleEndian(ex.nickname, 0, dst, 26, 10);
		}
		if (ex.hasFlag(MiiExtraFlag.FAVORITE_LOCAL_BIRTH)) {
			dst[24] = (dst[24] & 225) | (ex.birthMonth & 15) * 2;
			let tmp = ex.birthDay & 31;
			dst[24] = ((dst[24] & 31) | tmp << 5) & 255;
			dst[25] = (dst[25] & 252) | tmp >> 3;
			dst[25] = (dst[25] & 191) | MiiEncoder.#b2i(ex.favorite) << 6;
			dst[48] = (dst[48] & 254) | MiiEncoder.#b2i(ex.localOnly);
		}
		if (ex.hasFlag(MiiExtraFlag.REGION_FONT_MOVE)) {
			dst[1] = (dst[1] & 243) | (ex.regionMove & 3) * 4;
			dst[1] = (dst[1] & 207) | (ex.fontRegion & 3) << 4;
		}
		if (ex.hasFlag(MiiExtraFlag.VER3_PERSONAL)) {
			dst[1] = (dst[1] & 254) | MiiEncoder.#b2i(ex.copyable);
			dst[1] = (dst[1] & 253) | MiiEncoder.#b2i(ex.ngWord) * 2;
			dst[2] = (dst[2] & 240) | (ex.roomIndex & 15);
			dst[2] = (dst[2] & 15) | ex.positionInRoom << 4;
			dst[3] = (dst[3] & 143) | (ex.birthPlatform & 7) << 4;
			dst.set(ex.authorId, 4);
			dst.set(ex.createId.subarray(0, 10), 12);
		}
		if (ex.hasFlag(MiiExtraFlag.SPECIAL)) {
			dst[12] = Ver3CreateId.setNormal(dst[12], !ex.isSpecial);
		}
	}

	static toVer3Data(dst, info, ex)
	{
		MiiEncoder.toVer3Core(dst, info, ex);
		if (ex.hasFlag(MiiExtraFlag.CREATOR_NAME)) {
			MiiEncoder.#storeArrayU16LittleEndian(ex.creatorName, 0, dst, 72, 10);
		}
	}

	static toVer3StoreData(dst, info, ex)
	{
		MiiEncoder.toVer3Data(dst, info, ex);
		Crc16Ccitt.updateBigEndian(dst, MiiDataSize.VER3_STORE_DATA);
	}

	static toStudioData(dst, info)
	{
		dst[0] = info.beardColor;
		dst[1] = info.beardType;
		dst[2] = info.build;
		dst[3] = info.eyeAspect;
		dst[4] = info.eyeColor;
		dst[5] = info.eyeRotate;
		dst[6] = info.eyeScale;
		dst[7] = info.eyeType;
		dst[8] = info.eyeX;
		dst[9] = info.eyeY;
		dst[10] = info.eyebrowAspect;
		dst[11] = info.eyebrowColor;
		dst[12] = info.eyebrowRotate;
		dst[13] = info.eyebrowScale;
		dst[14] = info.eyebrowType;
		dst[15] = info.eyebrowX;
		dst[16] = info.eyebrowY;
		dst[17] = info.facelineColor;
		dst[18] = info.facelineMake;
		dst[19] = info.facelineType;
		dst[20] = info.facelineWrinkle;
		dst[21] = info.favoriteColor;
		dst[22] = info.gender;
		dst[23] = info.glassColor;
		dst[24] = info.glassScale;
		dst[25] = info.glassType;
		dst[26] = info.glassY;
		dst[27] = info.hairColor;
		dst[28] = info.hairFlip;
		dst[29] = info.hairType;
		dst[30] = info.height;
		dst[31] = info.moleScale;
		dst[32] = info.moleType;
		dst[33] = info.moleX;
		dst[34] = info.moleY;
		dst[35] = info.mouthAspect;
		dst[36] = info.mouthColor;
		dst[37] = info.mouthScale;
		dst[38] = info.mouthType;
		dst[39] = info.mouthY;
		dst[40] = info.mustacheScale;
		dst[41] = info.mustacheType;
		dst[42] = info.mustacheY;
		dst[43] = info.noseScale;
		dst[44] = info.noseType;
		dst[45] = info.noseY;
	}

	static toStudioUrlData(dst, info, seed = 0)
	{
		const raw = new Uint8Array(46);
		MiiEncoder.toStudioData(raw, info);
		StudioObfuscation.encode(dst, raw, seed);
	}

	static visualToNxCore(dst, info)
	{
		dst[0] = info.hairType;
		dst[1] = (dst[1] & 128) | (info.height & 127);
		dst[1] = (dst[1] & 127) | info.moleType << 7;
		dst[2] = (dst[2] & 128) | (info.build & 127);
		dst[2] = (dst[2] & 127) | info.hairFlip << 7;
		dst[3] = (dst[3] & 128) | (info.hairColor & 127);
		dst[4] = (dst[4] & 128) | (info.eyeColor & 127);
		dst[4] = (dst[4] & 127) | info.gender << 7;
		dst[5] = (dst[5] & 128) | (info.eyebrowColor & 127);
		dst[6] = (dst[6] & 128) | (info.mouthColor & 127);
		dst[7] = (dst[7] & 128) | (info.beardColor & 127);
		dst[8] = (dst[8] & 128) | (info.glassColor & 127);
		dst[9] = (dst[9] & 192) | (info.eyeType & 63);
		dst[10] = (dst[10] & 192) | (info.mouthType & 63);
		dst[11] = (dst[11] & 224) | (info.eyeY & 31);
		dst[11] = (dst[11] & 31) | info.glassScale << 5;
		dst[12] = (dst[12] & 224) | (info.eyebrowType & 31);
		dst[12] = (dst[12] & 31) | info.mustacheType << 5;
		dst[13] = (dst[13] & 224) | (info.noseType & 31);
		dst[13] = (dst[13] & 31) | info.beardType << 5;
		dst[14] = (dst[14] & 224) | (info.noseY & 31);
		dst[14] = (dst[14] & 31) | info.mouthAspect << 5;
		dst[15] = (dst[15] & 224) | (info.mouthY & 31);
		dst[15] = (dst[15] & 31) | info.eyebrowAspect << 5;
		dst[16] = (dst[16] & 224) | (info.mustacheY & 31);
		dst[16] = (dst[16] & 31) | info.eyeRotate << 5;
		dst[17] = (dst[17] & 224) | (info.glassY & 31);
		dst[17] = (dst[17] & 31) | info.eyeAspect << 5;
		dst[18] = (dst[18] & 224) | (info.moleX & 31);
		dst[18] = (dst[18] & 31) | info.eyeScale << 5;
		dst[19] = (dst[19] & 224) | (info.moleY & 31);
		dst[20] = (dst[20] & 224) | (info.glassType & 31);
		dst[21] = (dst[21] & 240) | (info.favoriteColor & 15);
		dst[21] = (dst[21] & 15) | info.facelineType << 4;
		dst[22] = (dst[22] & 240) | (info.facelineColor & 15);
		dst[22] = (dst[22] & 15) | info.facelineWrinkle << 4;
		dst[23] = (dst[23] & 240) | (info.facelineMake & 15);
		dst[23] = (dst[23] & 15) | info.eyeX << 4;
		dst[24] = (dst[24] & 240) | (info.eyebrowScale & 15);
		dst[24] = (dst[24] & 15) | info.eyebrowRotate << 4;
		dst[25] = (dst[25] & 240) | (info.eyebrowX & 15);
		let eyebrowY = info.eyebrowY < 3 ? 3 : info.eyebrowY;
		dst[25] = (dst[25] & 15) | (eyebrowY - 3) * 16;
		dst[26] = (dst[26] & 240) | (info.noseScale & 15);
		dst[26] = (dst[26] & 15) | info.mouthScale << 4;
		dst[27] = (dst[27] & 240) | (info.mustacheScale & 15);
		dst[27] = (dst[27] & 15) | info.moleScale << 4;
	}

	static toNxCoreParam(dst, info, ex)
	{
		MiiEncoder.visualToNxCore(dst, info);
		if (ex.hasFlag(MiiExtraFlag.SPECIAL)) {
			dst[3] = (dst[3] & 127) | MiiEncoder.#b2i(ex.isSpecial) << 7;
		}
		if (ex.hasFlag(MiiExtraFlag.REGION_FONT_MOVE)) {
			dst[9] = (dst[9] & 63) | ex.regionMove << 6;
			dst[10] = (dst[10] & 63) | ex.fontRegion << 6;
		}
	}

	static toNxCore(dst, info, ex)
	{
		MiiEncoder.toNxCoreParam(dst, info, ex);
		if (ex.hasFlag(MiiExtraFlag.NICKNAME)) {
			MiiEncoder.#storeArrayU16LittleEndian(ex.nickname, 0, dst, 28, 10);
		}
	}

	static toNxStoreData(dst, info, ex)
	{
		MiiEncoder.toNxCore(dst, info, ex);
		if (ex.hasFlag(MiiExtraFlag.NX_CREATE_ID)) {
			dst.set(ex.createId, 48);
		}
		if (ex.hasFlag(MiiExtraFlag.NX_DEVICE_CRC)) {
			dst.set(ex.authorId.subarray(0, 2), 66);
		}
		let crcOffset = MiiDataSize.NX_STORE_DATA - 2;
		Crc16Ccitt.updateBigEndian(dst, crcOffset);
	}

	static visualToNxCharInfo(dst, info)
	{
		dst[74] = info.beardColor;
		dst[75] = info.beardType;
		dst[42] = info.build;
		dst[55] = info.eyeAspect;
		dst[53] = info.eyeColor;
		dst[56] = info.eyeRotate;
		dst[54] = info.eyeScale;
		dst[52] = info.eyeType;
		dst[57] = info.eyeX;
		dst[58] = info.eyeY;
		dst[62] = info.eyebrowAspect;
		dst[60] = info.eyebrowColor;
		dst[63] = info.eyebrowRotate;
		dst[61] = info.eyebrowScale;
		dst[59] = info.eyebrowType;
		dst[64] = info.eyebrowX;
		dst[65] = info.eyebrowY;
		dst[46] = info.facelineColor;
		dst[48] = info.facelineMake;
		dst[45] = info.facelineType;
		dst[47] = info.facelineWrinkle;
		dst[39] = info.favoriteColor;
		dst[40] = info.gender;
		dst[80] = info.glassColor;
		dst[81] = info.glassScale;
		dst[79] = info.glassType;
		dst[82] = info.glassY;
		dst[50] = info.hairColor;
		dst[51] = info.hairFlip;
		dst[49] = info.hairType;
		dst[41] = info.height;
		dst[84] = info.moleScale;
		dst[83] = info.moleType;
		dst[85] = info.moleX;
		dst[86] = info.moleY;
		dst[72] = info.mouthAspect;
		dst[70] = info.mouthColor;
		dst[71] = info.mouthScale;
		dst[69] = info.mouthType;
		dst[73] = info.mouthY;
		dst[77] = info.mustacheScale;
		dst[76] = info.mustacheType;
		dst[78] = info.mustacheY;
		dst[67] = info.noseScale;
		dst[66] = info.noseType;
		dst[68] = info.noseY;
	}

	static toNxCharInfo(dst, info, ex)
	{
		MiiEncoder.visualToNxCharInfo(dst, info);
		if (ex.hasFlag(MiiExtraFlag.NICKNAME)) {
			MiiEncoder.#storeArrayU16LittleEndian(ex.nickname, 0, dst, 16, 10);
		}
		if (ex.hasFlag(MiiExtraFlag.SPECIAL)) {
			dst[43] = MiiEncoder.#b2i(ex.isSpecial);
		}
		if (ex.hasFlag(MiiExtraFlag.NX_CREATE_ID)) {
			dst.set(ex.createId);
		}
		if (ex.hasFlag(MiiExtraFlag.REGION_FONT_MOVE)) {
			dst[38] = ex.fontRegion;
			dst[44] = ex.regionMove;
		}
	}

	static visualToRflCore(dst, info)
	{
		let tmp;
		dst[0] = (dst[0] & 191) | (info.gender & 1) << 6;
		dst[1] = (dst[1] & 225) | (info.favoriteColor & 15) * 2;
		dst[22] = info.height;
		dst[23] = info.build;
		dst[32] = (dst[32] & 31) | info.facelineType << 5;
		dst[32] = (dst[32] & 227) | (info.facelineColor & 7) * 4;
		tmp = 0;
		dst[32] = ((dst[32] & 252) | tmp >> 2) & 255;
		dst[33] = ((dst[33] & 63) | tmp << 6) & 255;
		dst[34] = (dst[34] & 1) | info.hairType * 2;
		tmp = info.hairColor & 7;
		dst[34] = ((dst[34] & 254) | tmp >> 2) & 255;
		dst[35] = ((dst[35] & 63) | tmp << 6) & 255;
		dst[35] = (dst[35] & 223) | (info.hairFlip & 1) << 5;
		dst[36] = (dst[36] & 7) | info.eyebrowType * 8;
		tmp = info.eyebrowRotate & 31;
		dst[36] = ((dst[36] & 248) | tmp >> 2) & 255;
		dst[37] = ((dst[37] & 63) | tmp << 6) & 255;
		dst[38] = (dst[38] & 31) | info.eyebrowColor << 5;
		dst[38] = (dst[38] & 225) | (info.eyebrowScale & 15) * 2;
		tmp = info.eyebrowY & 31;
		dst[38] = ((dst[38] & 254) | tmp >> 4) & 255;
		dst[39] = ((dst[39] & 15) | tmp << 4) & 255;
		dst[39] = (dst[39] & 240) | (info.eyebrowX & 15);
		dst[40] = (dst[40] & 3) | info.eyeType * 4;
		tmp = info.eyeRotate & 31;
		dst[40] = ((dst[40] & 252) | tmp >> 3) & 255;
		dst[41] = ((dst[41] & 31) | tmp << 5) & 255;
		dst[41] = (dst[41] & 224) | (info.eyeY & 31);
		dst[42] = (dst[42] & 31) | info.eyeColor << 5;
		dst[42] = (dst[42] & 225) | (info.eyeScale & 15) * 2;
		tmp = info.eyeX & 15;
		dst[42] = ((dst[42] & 254) | tmp >> 3) & 255;
		dst[43] = ((dst[43] & 31) | tmp << 5) & 255;
		dst[44] = (dst[44] & 15) | info.noseType << 4;
		dst[44] = (dst[44] & 240) | (info.noseScale & 15);
		dst[45] = (dst[45] & 7) | info.noseY * 8;
		dst[46] = (dst[46] & 7) | info.mouthType * 8;
		dst[46] = (dst[46] & 249) | (info.mouthColor & 3) * 2;
		tmp = info.mouthScale & 15;
		dst[46] = ((dst[46] & 254) | tmp >> 3) & 255;
		dst[47] = ((dst[47] & 31) | tmp << 5) & 255;
		dst[47] = (dst[47] & 224) | (info.mouthY & 31);
		dst[48] = (dst[48] & 15) | info.glassType << 4;
		dst[48] = (dst[48] & 241) | (info.glassColor & 7) * 2;
		tmp = info.glassScale & 15;
		dst[48] = ((dst[48] & 254) | tmp >> 3) & 255;
		dst[49] = ((dst[49] & 31) | tmp << 5) & 255;
		dst[49] = (dst[49] & 224) | (info.glassY & 31);
		dst[50] = (dst[50] & 63) | info.mustacheType << 6;
		dst[50] = (dst[50] & 207) | (info.beardType & 3) << 4;
		dst[50] = (dst[50] & 241) | (info.beardColor & 7) * 2;
		tmp = info.mustacheScale & 15;
		dst[50] = ((dst[50] & 254) | tmp >> 3) & 255;
		dst[51] = ((dst[51] & 31) | tmp << 5) & 255;
		dst[51] = (dst[51] & 224) | (info.mustacheY & 31);
		dst[52] = (dst[52] & 127) | info.moleType << 7;
		dst[52] = (dst[52] & 135) | (info.moleScale & 15) * 8;
		tmp = info.moleY & 31;
		dst[52] = ((dst[52] & 248) | tmp >> 2) & 255;
		dst[53] = ((dst[53] & 63) | tmp << 6) & 255;
		dst[53] = (dst[53] & 193) | (info.moleX & 31) * 2;
	}

	static toRflCore(dst, info, ex)
	{
		MiiEncoder.visualToRflCore(dst, info);
		if (ex.hasFlag(MiiExtraFlag.NICKNAME)) {
			MiiEncoder.#storeArrayU16BigEndian(ex.nickname, 0, dst, 2, 10);
		}
		if (ex.hasFlag(MiiExtraFlag.FAVORITE_LOCAL_BIRTH)) {
			dst[0] = (dst[0] & 195) | (ex.birthMonth & 15) * 4;
			let tmp = ex.birthDay & 31;
			dst[0] = ((dst[0] & 252) | tmp >> 3) & 255;
			dst[1] = (dst[1] & 31) | tmp << 5;
			dst[1] = (dst[1] & 254) | (MiiEncoder.#b2i(ex.favorite) & 1);
			dst[33] = (dst[33] & 251) | (MiiEncoder.#b2i(ex.localOnly) & 1) * 4;
		}
		if (ex.hasFlag(MiiExtraFlag.RFL_CREATE_ID)) {
			dst.set(ex.createId.subarray(0, 8), 24);
		}
		if (ex.hasFlag(MiiExtraFlag.SPECIAL)) {
			dst[24] = Ver3CreateId.setNormal(dst[24], !ex.isSpecial);
		}
	}

	static toRflData(dst, info, ex)
	{
		MiiEncoder.toRflCore(dst, info, ex);
		if (ex.hasFlag(MiiExtraFlag.CREATOR_NAME)) {
			MiiEncoder.#storeArrayU16BigEndian(ex.creatorName, 0, dst, 54, 10);
		}
	}

	static toRflStoreData(dst, info, ex)
	{
		MiiEncoder.toRflData(dst, info, ex);
		Crc16Ccitt.updateBigEndian(dst, MiiDataSize.RFL_STORE_DATA);
	}
}

/**
 * Information describing the Mii character's model.
 * Derived from nn::mii::detail::CharInfoRaw, with
 * additional fields moved out to MiiExtraInfo.
 */
export class MiiVisualInfo
{
	favoriteColor;
	gender;
	height;
	build;
	facelineType;
	facelineColor;
	facelineWrinkle;
	facelineMake;
	hairType;
	hairColor;
	hairFlip;
	eyeType;
	eyeColor;
	eyeScale;
	eyeAspect;
	eyeRotate;
	eyeX;
	eyeY;
	eyebrowType;
	eyebrowColor;
	eyebrowScale;
	eyebrowAspect;
	eyebrowRotate;
	eyebrowX;
	eyebrowY;
	noseType;
	noseScale;
	noseY;
	mouthType;
	mouthColor;
	mouthScale;
	mouthAspect;
	mouthY;
	beardColor;
	beardType;
	mustacheType;
	mustacheScale;
	mustacheY;
	glassType;
	glassColor;
	glassScale;
	glassY;
	moleType;
	moleScale;
	moleX;
	moleY;
}

/**
 * Enum describing which extra information is
 * available within the MiiExtraInfo container.
 */
export const MiiExtraFlag = {
	/**
	 * No extra information is available.
	 */
	NONE : 0,
	/**
	 * 10-character nickname (Wii, Ver3, NX Core)
	 */
	NICKNAME : 1,
	/**
	 * Special flag (Wii/Ver3: in Ver3CreateId, NX: "type" field)
	 */
	SPECIAL : 2,
	FAVORITE_LOCAL_BIRTH : 3,
	CREATOR_NAME : 4,
	REGION_FONT_MOVE : 5,
	RFL_CREATE_ID : 6,
	VER3_PERSONAL : 7,
	NX_CREATE_ID : 8,
	NX_DEVICE_CRC : 9
}

export class MiiExtraInfo
{

	static COMMON_NAME_LENGTH = 10;

	static NX_CREATE_ID_LENGTH = 16;

	static VER3_CREATE_ID_LENGTH = 10;

	static VER3_AUTHOR_ID_LENGTH = 8;

	static RFL_CREATE_ID_LENGTH = 8;
	flag;
	/**
	 * 10-character nickname.
	 */
	nickname = new Uint16Array(10);
	/**
	 * Whether or not the Mii is considered special.
	 * WARNING: LocalOnly must be true for the data to be valid.
	 */
	isSpecial;
	/**
	 * Determines which regions to show non-ASCII characters.
	 */
	fontRegion;
	/**
	 * Unique identifier for the character.
	 */
	createId = new Uint8Array(16);
	creatorName = new Uint16Array(10);
	favorite;
	localOnly;
	birthMonth;
	birthDay;
	authorId = new Uint8Array(8);
	birthPlatform;
	regionMove;
	copyable;
	ngWord;
	roomIndex;
	positionInRoom;

	clearFlag()
	{
		this.flag = 0;
	}

	setFlag(f)
	{
		this.flag |= 1 << f;
	}

	hasFlag(f)
	{
		return (this.flag & 1 << f) != 0;
	}
}

export class Ver3CreateId
{

	static isCtr(idByte0)
	{
		return (idByte0 & 16) == 1 && (idByte0 & 64) == 0;
	}

	static isNtr(idByte0)
	{
		return (idByte0 & 16) == 0 && (idByte0 & 64) == 1;
	}

	static isWii(idByte0)
	{
		return (idByte0 & 16) == 0 && (idByte0 & 64) == 0;
	}

	static isWiiu(idByte0)
	{
		return (idByte0 & 16) == 1 && (idByte0 & 64) == 1;
	}

	static isNormal(idByte0)
	{
		return (idByte0 & 128) == 128;
	}

	static setNormal(idByte0, value)
	{
		return value ? idByte0 | 128 : idByte0 & ~128;
	}

	static isTemporary(idByte0)
	{
		return (idByte0 & 32) == 1;
	}
}

export class StudioObfuscation
{

	static SIZE_RAW_DATA = 46;

	/**
	 * Obfuscates Studio data to be used in the URL.
	 * @param seed The random value to use for the obfuscation. Best left as 0.
	 */
	static encode(dst, src, seed = 0)
	{
		dst[0] = seed;
		for (let i = 0; i < 46; i++) {
			let val = src[i] ^ dst[i];
			dst[i + 1] = (7 + val) % 256;
		}
	}

	/**
	 * Deobfuscates Studio URL data to raw decodable data.
	 */
	static decode(dst, src)
	{
		for (let i = 0; i < 46; i++) {
			let val = (src[i + 1] - 7) % 256;
			dst[i] = val ^ src[i];
		}
	}
}

export const MiiDataType = {
	/**
	 * Placeholder value.
	 */
	UNKNOWN : 0,
	/**
	 * 64/0x40 bytes. Used in Wii hidden/"parade" DB, no creator name.
	 * RFLiHiddenCharData
	 */
	RFL_CORE : 1,
	/**
	 * 74/0x4A bytes. Data format used on Wii.
	 * RFLCharData, FFLiMiiDataOfficialRFL
	 * Extension: rcd, unofficial: mii, mae, miigx
	 */
	RFL_DATA : 2,
	/**
	 * 76/0x4C bytes. Wii data format with CRC-16.
	 * Extension: rsd, used in some titles e.g. MKW ghosts
	 */
	RFL_STORE_DATA : 3,
	/**
	 * 74/0x4A bytes. Data format used in DS titles with Mii characters.
	 * Byte order is little-endian, while bit order is same.
	 */
	RFL_DATA_LITTLE_ENDIAN : 4,
	/**
	 * 72/0x48 bytes. Used in 3DS/Wii U hidden DB, no creator name.
	 * CFLiPackedMiiDataCore, FFLiMiiDataCore
	 */
	VER3_CORE : 5,
	/**
	 * 92/0x5C bytes. Used in 3DS/Wii U database, no CRC.
	 * CFLiPackedMiiDataOfficial, FFLiMiiDataOfficial
	 * Unofficial extensions: 3dsmii, cfcd, ffcdgam
	 */
	VER3_DATA : 6,
	/**
	 * 96/0x60 bytes. Data format used on 3DS/Wii U.
	 * CFLiMiiDataPacket/CFLStoreData, FFLStoreData, nn::mii::Ver3StoreData
	 * Extensions: cfsd, ffsd
	 */
	VER3_STORE_DATA : 7,
	/**
	 * 92/0x5C bytes. Used in the Wii U database.
	 * Byte order is big-endian, while bit order is same.
	 */
	VER3_DATA_BIG_ENDIAN : 8,
	/**
	 * 88/0x58 bytes. Used in Switch titles. Each field is a byte.
	 * nn::mii::CharInfo/nn::mii::detail::CharInfoRaw
	 * Unofficial extension: charinfo (SDK uses .dat)
	 */
	NX_CHAR_INFO : 9,
	/**
	 * 48/0x30 bytes. Used in Switch databases and NFIF format. Bitfield-packed, no CreateID.
	 * nn::mii::CoreData/nn::mii::detail::CoreDataRaw
	 * Unofficial extension: nfcd
	 */
	NX_CORE : 10,
	/**
	 * 68/0x44 bytes. Used in Switch MiiDatabase.dat (editor DB).
	 * Contains core, CreateID, CRC-16 of data, and CRC-16 of system AuthorID.
	 * nn::mii::StoreData/nn::mii::detail::StoreDataRaw
	 * Unofficial extension: nfsd
	 */
	NX_STORE_DATA : 11,
	/**
	 * 28/0x1C bytes. Trimmed version of Switch CoreData excluding name.
	 */
	NX_CORE_PARAM : 12,
	/**
	 * 46/0x2E bytes. Used in NA/"Mii Studio" web editor.
	 * This is the format before obfuscation and in LocalStorage.
	 * Contains only visual information with Switch colors/glass types.
	 * Unofficial extension: mnms
	 */
	STUDIO_DATA : 13,
	/**
	 * 47/0x2F bytes. NA/"Mii Studio" web editor format with obfuscation.
	 * This obfuscated form is used in the "data=" URL param for the /miis/image.png endpoint.
	 */
	STUDIO_URL_DATA : 14
}

export const MiiDataSize = {
	UNKNOWN : 0,
	RFL_CORE : 64,
	RFL_DATA : 74,
	RFL_STORE_DATA : 76,
	VER3_CORE : 72,
	VER3_DATA : 92,
	VER3_STORE_DATA : 96,
	NX_CORE : 48,
	NX_CHAR_INFO : 88,
	NX_STORE_DATA : 68,
	NX_CORE_PARAM : 28,
	STUDIO_DATA : 46,
	STUDIO_URL_DATA : 47,
	/**
	 * Represents the biggest Mii data format,
	 * in order to provide a maximum buffer size.
	 */
	MAX_SIZE : 96
}

export class MiiFormat
{

	static getTypeFromSize(size)
	{
		switch (size) {
		case 64:
			return MiiDataType.RFL_CORE;
		case 74:
			return MiiDataType.RFL_DATA;
		case 76:
			return MiiDataType.RFL_STORE_DATA;
		case 72:
			return MiiDataType.VER3_CORE;
		case 92:
			return MiiDataType.VER3_DATA;
		case 96:
			return MiiDataType.VER3_STORE_DATA;
		case 28:
			return MiiDataType.NX_CORE_PARAM;
		case 48:
			return MiiDataType.NX_CORE;
		case 68:
			return MiiDataType.NX_STORE_DATA;
		case 88:
			return MiiDataType.NX_CHAR_INFO;
		case 46:
			return MiiDataType.STUDIO_DATA;
		case 47:
			return MiiDataType.STUDIO_URL_DATA;
		default:
			return MiiDataType.UNKNOWN;
		}
	}

	static getSize(type)
	{
		switch (type) {
		case MiiDataType.UNKNOWN:
			return MiiDataSize.UNKNOWN;
		case MiiDataType.RFL_CORE:
			return MiiDataSize.RFL_CORE;
		case MiiDataType.RFL_STORE_DATA:
			return MiiDataSize.RFL_STORE_DATA;
		case MiiDataType.RFL_DATA:
		case MiiDataType.RFL_DATA_LITTLE_ENDIAN:
			return MiiDataSize.RFL_DATA;
		case MiiDataType.VER3_CORE:
			return MiiDataSize.VER3_CORE;
		case MiiDataType.VER3_STORE_DATA:
			return MiiDataSize.VER3_STORE_DATA;
		case MiiDataType.VER3_DATA:
		case MiiDataType.VER3_DATA_BIG_ENDIAN:
			return MiiDataSize.VER3_DATA;
		case MiiDataType.NX_CHAR_INFO:
			return MiiDataSize.NX_CHAR_INFO;
		case MiiDataType.NX_CORE:
			return MiiDataSize.NX_CORE;
		case MiiDataType.NX_STORE_DATA:
			return MiiDataSize.NX_STORE_DATA;
		case MiiDataType.NX_CORE_PARAM:
			return MiiDataSize.NX_CORE_PARAM;
		case MiiDataType.STUDIO_DATA:
			return MiiDataSize.STUDIO_DATA;
		case MiiDataType.STUDIO_URL_DATA:
			return MiiDataSize.STUDIO_URL_DATA;
		default:
			throw new Error("Unknown MiiDataType value.");
		}
	}
}

export class DataConversionUtilityTodoMoveThis
{

	static convertDataTypeTo(src, dst, srcType, dstType)
	{
		const info = new MiiVisualInfo();
		const ex = new MiiExtraInfo();
		if (!DataConversionUtilityTodoMoveThis.decodeDataType(src, srcType, info, ex)) {
			return false;
		}
		DataConversionUtilityTodoMoveThis.encodeDataTypeTo(dst, dstType, info, ex);
		return true;
	}

	static decodeDataType(src, type, info, ex)
	{
		switch (type) {
		case MiiDataType.RFL_CORE:
			MiiDecoder.visualFromRflCore(src, info);
			return true;
		case MiiDataType.RFL_DATA:
			MiiDecoder.fromRflData(src, info, ex);
			return true;
		case MiiDataType.RFL_STORE_DATA:
			return MiiDecoder.fromRflStoreData(src, info, ex);
		case MiiDataType.VER3_CORE:
			MiiDecoder.fromVer3Core(src, info, ex);
			return true;
		case MiiDataType.VER3_DATA:
			MiiDecoder.fromVer3Data(src, info, ex);
			return true;
		case MiiDataType.VER3_STORE_DATA:
			return MiiDecoder.fromVer3StoreData(src, info, ex);
		case MiiDataType.NX_CHAR_INFO:
			MiiDecoder.fromNxCharInfo(src, info, ex);
			return true;
		case MiiDataType.NX_CORE:
			MiiDecoder.fromNxCore(src, info, ex);
			return true;
		case MiiDataType.NX_STORE_DATA:
			return MiiDecoder.fromNxStoreData(src, info, ex);
		case MiiDataType.NX_CORE_PARAM:
			MiiDecoder.fromNxCoreParam(src, info, ex);
			return true;
		case MiiDataType.STUDIO_DATA:
			MiiDecoder.fromStudioData(src, info);
			return true;
		case MiiDataType.STUDIO_URL_DATA:
			MiiDecoder.fromStudioUrlData(src, info);
			return true;
		default:
			throw new Error("Unknown MiiDataType value.");
		}
	}

	static encodeDataTypeTo(dst, type, info, ex)
	{
		switch (type) {
		case MiiDataType.RFL_CORE:
			MiiEncoder.visualToRflCore(dst, info);
			break;
		case MiiDataType.RFL_DATA:
			MiiEncoder.toRflData(dst, info, ex);
			break;
		case MiiDataType.RFL_STORE_DATA:
			MiiEncoder.toRflStoreData(dst, info, ex);
			break;
		case MiiDataType.VER3_CORE:
			MiiEncoder.toVer3Core(dst, info, ex);
			break;
		case MiiDataType.VER3_DATA:
			MiiEncoder.toVer3Data(dst, info, ex);
			break;
		case MiiDataType.VER3_STORE_DATA:
			MiiEncoder.toVer3StoreData(dst, info, ex);
			break;
		case MiiDataType.NX_CHAR_INFO:
			MiiEncoder.toNxCharInfo(dst, info, ex);
			break;
		case MiiDataType.NX_CORE:
			MiiEncoder.toNxCore(dst, info, ex);
			break;
		case MiiDataType.NX_STORE_DATA:
			MiiEncoder.toNxStoreData(dst, info, ex);
			break;
		case MiiDataType.NX_CORE_PARAM:
			MiiEncoder.toNxCoreParam(dst, info, ex);
			break;
		case MiiDataType.STUDIO_DATA:
			MiiEncoder.toStudioData(dst, info);
			break;
		case MiiDataType.STUDIO_URL_DATA:
			MiiEncoder.toStudioUrlData(dst, info);
			break;
		default:
			throw new Error("Unknown MiiDataType value.");
		}
	}

	static convertDataType(src, srcType, dstType)
	{
		let size = MiiFormat.getSize(dstType);
		let dst = new Uint8Array(size);
		if (!DataConversionUtilityTodoMoveThis.convertDataTypeTo(src, dst, srcType, dstType)) {
			return null;
		}
		return dst;
	}

	static encodeDataType(type, info, ex)
	{
		let size = MiiFormat.getSize(type);
		let dst = new Uint8Array(size);
		DataConversionUtilityTodoMoveThis.encodeDataTypeTo(dst, type, info, ex);
		return dst;
	}

	static isDataTypeNx(t)
	{
		return t >= MiiDataType.NX_CHAR_INFO;
	}

	static convertRflExtraForVer3(extra)
	{
		console.assert(extra.hasFlag(MiiExtraFlag.RFL_CREATE_ID));
		extra.clearFlag();
		extra.setFlag(MiiExtraFlag.NICKNAME);
		extra.setFlag(MiiExtraFlag.CREATOR_NAME);
		extra.setFlag(MiiExtraFlag.FAVORITE_LOCAL_BIRTH);
		extra.setFlag(MiiExtraFlag.SPECIAL);
		extra.setFlag(MiiExtraFlag.VER3_PERSONAL);
		extra.positionInRoom = extra.roomIndex = 0;
		extra.ngWord = false;
		extra.birthPlatform = 1;
		extra.copyable = true;
		DataConversionUtilityTodoMoveThis.#convertRflCreateIdToVer3(extra.createId, extra.authorId);
	}

	static #convertRflCreateIdToVer3(idData, authorId)
	{
		let offset = 8;
		idData[offset] = 127;
		idData[offset + 1] = 3;
		for (let i = 0; i < 8; i++) {
			let x = idData[offset];
			x ^= x >> 4;
			idData[offset] = (idData[offset + 1] ^ x >> 3 ^ x << 4) & 255;
			idData[offset + 1] = (x ^ x << 5 ^ authorId[i]) & 255;
		}
	}

	static adjustExtra(extra, type, newId)
	{
		if (!extra.hasFlag(MiiExtraFlag.NICKNAME) || extra.nickname[0] == 0) {
			extra.setFlag(MiiExtraFlag.NICKNAME);
			extra.nickname.set(DataConversionUtilityTodoMoveThis.#ADJUST_EXTRA_DEFAULT_NICKNAME_FOR_NX);
		}
		if (DataConversionUtilityTodoMoveThis.isDataTypeNx(type)) {
			DataConversionUtilityTodoMoveThis.adjustExtraForNx(extra, newId);
		}
		else {
			DataConversionUtilityTodoMoveThis.adjustExtraForVer3(extra, newId);
		}
	}

	static #isAllZeroes(bytes, size)
	{
		for (let i = 0; i < size; i++)
			if (bytes[i] != 0)
				return false;
		return true;
	}

	static adjustExtraForVer3(extra, newId)
	{
		let hasVer3 = extra.hasFlag(MiiExtraFlag.VER3_PERSONAL);
		if (!hasVer3) {
			extra.setFlag(MiiExtraFlag.VER3_PERSONAL);
			extra.positionInRoom = extra.roomIndex = 0;
			extra.ngWord = false;
			extra.birthPlatform = 3;
			extra.copyable = true;
			for (let i = 0; i < 8; i++)
				extra.authorId[i] = 0;
		}
		else {
			extra.createId[0] &= 223;
		}
		if (extra.hasFlag(MiiExtraFlag.SPECIAL) && !extra.hasFlag(MiiExtraFlag.FAVORITE_LOCAL_BIRTH)) {
			extra.setFlag(MiiExtraFlag.FAVORITE_LOCAL_BIRTH);
			extra.birthMonth = extra.birthDay = 0;
			extra.favorite = false;
			extra.localOnly = extra.isSpecial;
		}
		if (!hasVer3 || DataConversionUtilityTodoMoveThis.#isAllZeroes(extra.createId, 10)) {
			extra.createId.set(newId.subarray(0, 10));
			extra.createId[0] = (extra.createId[0] & 15) | 208;
			extra.createId[4] = 2;
			extra.createId[5] = extra.createId[6] = 0;
		}
	}

	static adjustExtraForNx(extra, newId)
	{
		let end = 1;
		for (; end < 10; end++)
			if (extra.nickname[end] == 0)
				break;
		for (; end < 10; end++)
			extra.nickname[end] = 0;
		if (!extra.hasFlag(MiiExtraFlag.NX_CREATE_ID) || DataConversionUtilityTodoMoveThis.#isAllZeroes(extra.createId, 16)) {
			extra.createId.set(newId.subarray(0, 16));
			extra.createId[8] &= 63;
			extra.createId[8] |= 128;
		}
	}

	static applyNfpExtension(info, src, offset = 0)
	{
		info.facelineColor = src[offset + 0];
		info.hairColor = src[offset + 1];
		info.eyeColor = src[offset + 2];
		info.eyebrowColor = src[offset + 3];
		info.mouthColor = src[offset + 4];
		info.beardColor = src[offset + 5];
		info.glassColor = src[offset + 6];
		info.glassType = src[offset + 7];
	}

	static #ADJUST_EXTRA_DEFAULT_NICKNAME_FOR_NX = new Uint16Array([ 77, 105, 105, 0 ]);
}

export class Fnv128
{

	static calculate(hash, data, size)
	{
		const tmp = new BigInt64Array(4);
		const tmp2 = new BigInt64Array(4);
		tmp[0] = 1818371886n;
		tmp[1] = 129696066n;
		tmp[2] = 1656234357n;
		tmp[3] = 1653982605n;
		let offset = 0;
		for (let i = 0; i < size; i++) {
			tmp2[3] = tmp[3] * 315n;
			tmp2[2] = tmp[2] * 315n + (tmp2[3] >> 32n);
			tmp2[1] = tmp[1] * 315n + (tmp2[2] >> 32n);
			tmp2[0] = tmp[0] * 315n + (tmp2[1] >> 32n);
			tmp2[3] &= 4294967295n;
			tmp2[2] &= 4294967295n;
			tmp2[1] &= 4294967295n;
			tmp2[0] &= 4294967295n;
			tmp2[1] += tmp[3] * 16777216n;
			tmp2[0] += tmp[2] * 16777216n + (tmp2[1] >> 32n);
			tmp2[1] &= 4294967295n;
			tmp2[0] &= 4294967295n;
			tmp[3] = tmp2[3] ^ BigInt(data[offset]);
			tmp[2] = tmp2[2];
			tmp[1] = tmp2[1];
			tmp[0] = tmp2[0];
			offset += 1;
		}
		hash[0] = Number(tmp[0] >> 24n & 255n);
		hash[1] = Number(tmp[0] >> 16n & 255n);
		hash[2] = Number(tmp[0] >> 8n & 255n);
		hash[3] = Number(tmp[0] >> 0n & 255n);
		hash[4] = Number(tmp[1] >> 24n & 255n);
		hash[5] = Number(tmp[1] >> 16n & 255n);
		hash[6] = Number(tmp[1] >> 8n & 255n);
		hash[7] = Number(tmp[1] >> 0n & 255n);
		hash[8] = Number(tmp[2] >> 24n & 255n);
		hash[9] = Number(tmp[2] >> 16n & 255n);
		hash[10] = Number(tmp[2] >> 8n & 255n);
		hash[11] = Number(tmp[2] >> 0n & 255n);
		hash[12] = Number(tmp[3] >> 24n & 255n);
		hash[13] = Number(tmp[3] >> 16n & 255n);
		hash[14] = Number(tmp[3] >> 8n & 255n);
		hash[15] = Number(tmp[3] >> 0n & 255n);
	}
}
