// Generated automatically with "fut". Do not edit.

/**
 * Utility for converting 16-bit strings to/from UTF-8.
 */
export class Char16
{
	private constructor();

	/**
	 * Writes UTF-8 text from a buffer of 16-bit wide characters
	 * that are within the Unicode BMP, also known as UCS-2 encoded text.
	 * This does not support decoding UTF-16 surrogate pairs for
	 * characters beyond the Basic Multilingual Plane (emoji, etc.)
	 * @param dst Destination UTF-8 bytes to write to. Size MUST be 3 * characterCount.
	 * @param src Source array of 16-bit code points.
	 * @param characterCount Amount of characters from the original string to process.
	 */
	public static toUtf8(dst: Uint8Array, src: Readonly<Uint16Array>, characterCount: number, srcOffset?: number, dstOffset?: number): number;

	public static fromUtf8(dst: Uint16Array, src: Readonly<Uint8Array>, srcSize: number, srcOffset?: number, dstOffset?: number): number;

	public static toString(src: Readonly<Uint16Array>, characterCount: number, srcOffset?: number): string;
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
	private constructor();

	/**
	 * Calculates the CRC-16/CCITT checksum for the specified input data.
	 * Courtesy of Luciano Barcaro: https://stackoverflow.com/a/30357446
	 */
	public static calculate(input: Readonly<Uint8Array>, size: number): number;

	public static updateBigEndian(data: Uint8Array, end: number, start?: number): void;
}

export class MiiDecoder
{
	private constructor();

	static _i2b(i: number): boolean;

	static _loadArrayU16LittleEndian(src: Readonly<Uint8Array>, srcOffset: number, dst: Uint16Array, dstOffset: number, count: number): void;

	static _loadArrayU16BigEndian(src: Readonly<Uint8Array>, srcOffset: number, dst: Uint16Array, dstOffset: number, count: number): void;

	/**
	 * Convert color fields for previous formats to NX format.
	 */
	public static convertVer3FieldsToNx(info: MiiVisualInfo): void;

	public static visualFromVer3Core(src: Readonly<Uint8Array>, info: MiiVisualInfo): void;

	static _isCreateIdNormal(idByte0: number): boolean;

	public static fromVer3Core(src: Readonly<Uint8Array>, info: MiiVisualInfo, ex: MiiExtraInfo): void;

	public static fromVer3Data(src: Readonly<Uint8Array>, info: MiiVisualInfo, ex: MiiExtraInfo): void;

	public static fromVer3StoreData(src: Readonly<Uint8Array>, info: MiiVisualInfo, ex: MiiExtraInfo): boolean;

	public static visualFromNxCore(src: Readonly<Uint8Array>, info: MiiVisualInfo): void;

	public static fromNxCoreParam(src: Readonly<Uint8Array>, info: MiiVisualInfo, ex: MiiExtraInfo): void;

	public static fromNxCore(src: Readonly<Uint8Array>, info: MiiVisualInfo, ex: MiiExtraInfo): void;

	public static fromNxStoreData(src: Readonly<Uint8Array>, info: MiiVisualInfo, ex: MiiExtraInfo): boolean;

	public static visualFromNxCharInfo(src: Readonly<Uint8Array>, info: MiiVisualInfo): void;

	public static fromNxCharInfo(src: Readonly<Uint8Array>, info: MiiVisualInfo, ex: MiiExtraInfo): void;

	public static fromStudioData(src: Readonly<Uint8Array>, info: MiiVisualInfo): void;

	public static fromStudioUrlData(src: Readonly<Uint8Array>, info: MiiVisualInfo): void;

	public static visualFromRflCore(src: Readonly<Uint8Array>, info: MiiVisualInfo): void;

	public static fromRflCore(src: Readonly<Uint8Array>, info: MiiVisualInfo, ex: MiiExtraInfo): void;

	public static fromRflData(src: Readonly<Uint8Array>, info: MiiVisualInfo, ex: MiiExtraInfo): void;

	public static fromRflStoreData(src: Readonly<Uint8Array>, info: MiiVisualInfo, ex: MiiExtraInfo): boolean;
}

export class MiiEncoder
{
	private constructor();

	static _b2i(b: boolean): number;

	static _storeArrayU16LittleEndian(src: Readonly<Uint16Array>, srcOffset: number, dst: Uint8Array, dstOffset: number, count: number): void;

	static _storeArrayU16BigEndian(src: Readonly<Uint16Array>, srcOffset: number, dst: Uint8Array, dstOffset: number, count: number): void;

	public static storeU16BigEndian(value: number, dst: Uint8Array, dstOffset: number): void;

	public static visualToVer3Core(dst: Uint8Array, info: MiiVisualInfo): void;

	/**
	 * Returns the first byte.
	 */
	static _setCreateIdNormal(idByte0: number, value: boolean): number;

	public static toVer3Core(dst: Uint8Array, info: MiiVisualInfo, ex: MiiExtraInfo): void;

	public static toVer3Data(dst: Uint8Array, info: MiiVisualInfo, ex: MiiExtraInfo): void;

	public static toVer3StoreData(dst: Uint8Array, info: MiiVisualInfo, ex: MiiExtraInfo): void;

	public static toStudioData(dst: Uint8Array, info: MiiVisualInfo): void;

	public static toStudioUrlData(dst: Uint8Array, info: MiiVisualInfo, seed?: number): void;

	public static visualToNxCore(dst: Uint8Array, info: MiiVisualInfo): void;

	public static toNxCoreParam(dst: Uint8Array, info: MiiVisualInfo, ex: MiiExtraInfo): void;

	public static toNxCore(dst: Uint8Array, info: MiiVisualInfo, ex: MiiExtraInfo): void;

	public static toNxStoreData(dst: Uint8Array, info: MiiVisualInfo, ex: MiiExtraInfo): void;

	public static visualToNxCharInfo(dst: Uint8Array, info: MiiVisualInfo): void;

	public static toNxCharInfo(dst: Uint8Array, info: MiiVisualInfo, ex: MiiExtraInfo): void;

	public static visualToRflCore(dst: Uint8Array, info: MiiVisualInfo): void;

	public static toRflCore(dst: Uint8Array, info: MiiVisualInfo, ex: MiiExtraInfo): void;

	public static toRflData(dst: Uint8Array, info: MiiVisualInfo, ex: MiiExtraInfo): void;

	public static toRflStoreData(dst: Uint8Array, info: MiiVisualInfo, ex: MiiExtraInfo): void;
}

/**
 * Information describing the Mii character's model.
 * Derived from nn::mii::detail::CharInfoRaw, with
 * additional fields moved out to MiiExtraInfo.
 */
export class MiiVisualInfo
{
	public favoriteColor: number;
	public gender: number;
	public height: number;
	public build: number;
	public facelineType: number;
	public facelineColor: number;
	public facelineWrinkle: number;
	public facelineMake: number;
	public hairType: number;
	public hairColor: number;
	public hairFlip: number;
	public eyeType: number;
	public eyeColor: number;
	public eyeScale: number;
	public eyeAspect: number;
	public eyeRotate: number;
	public eyeX: number;
	public eyeY: number;
	public eyebrowType: number;
	public eyebrowColor: number;
	public eyebrowScale: number;
	public eyebrowAspect: number;
	public eyebrowRotate: number;
	public eyebrowX: number;
	public eyebrowY: number;
	public noseType: number;
	public noseScale: number;
	public noseY: number;
	public mouthType: number;
	public mouthColor: number;
	public mouthScale: number;
	public mouthAspect: number;
	public mouthY: number;
	public beardColor: number;
	public beardType: number;
	public mustacheType: number;
	public mustacheScale: number;
	public mustacheY: number;
	public glassType: number;
	public glassColor: number;
	public glassScale: number;
	public glassY: number;
	public moleType: number;
	public moleScale: number;
	public moleX: number;
	public moleY: number;
}

/**
 * Enum describing which extra information is
 * available within the MiiExtraInfo container.
 */
export enum MiiExtraFlag {
	/**
	 * No extra information is available.
	 */
	NONE,
	/**
	 * 10-character nickname (Wii, Ver3, NX Core)
	 */
	NICKNAME,
	/**
	 * Special flag (Wii/Ver3: in Ver3CreateId, NX: "type" field)
	 */
	SPECIAL,
	FAVORITE_LOCAL_BIRTH,
	CREATOR_NAME,
	REGION_FONT_MOVE,
	RFL_CREATE_ID,
	VER3_PERSONAL,
	NX_CREATE_ID,
	NX_DEVICE_CRC,
}

export class MiiExtraInfo
{

	public static readonly COMMON_NAME_LENGTH: number;

	public static readonly NX_CREATE_ID_LENGTH: number;

	public static readonly VER3_CREATE_ID_LENGTH: number;

	public static readonly VER3_AUTHOR_ID_LENGTH: number;

	public static readonly RFL_CREATE_ID_LENGTH: number;
	public flag: number;
	/**
	 * Determines which regions to show non-ASCII characters.
	 */
	public fontRegion: number;
	/**
	 * 10-character nickname.
	 */
	public readonly nickname: Uint16Array;
	/**
	 * Whether or not the Mii is considered special.
	 * WARNING: LocalOnly must be true for the data to be valid.
	 */
	public isSpecial: boolean;
	/**
	 * Unique identifier for the character.
	 */
	public readonly createId: Uint8Array;
	public readonly creatorName: Uint16Array;
	public favorite: boolean;
	public localOnly: boolean;
	public birthMonth: number;
	public birthDay: number;
	public readonly authorId: Uint8Array;
	public birthPlatform: number;
	public regionMove: number;
	public roomIndex: number;
	public positionInRoom: number;
	public copyable: boolean;
	public ngWord: boolean;

	clearFlag(): void;

	setFlag(f: MiiExtraFlag): void;

	hasFlag(f: MiiExtraFlag): boolean;
}

export class StudioObfuscation
{
	private constructor();

	public static readonly SIZE_RAW_DATA: number;

	/**
	 * Obfuscates Studio data to be used in the URL.
	 * @param seed The random value to use for the obfuscation. Best left as 0.
	 */
	public static encode(dst: Uint8Array, src: Readonly<Uint8Array>, seed?: number): void;

	/**
	 * Deobfuscates Studio URL data to raw decodable data.
	 */
	public static decode(dst: Uint8Array, src: Readonly<Uint8Array>): void;
}

export enum MiiDataType {
	/**
	 * Placeholder value.
	 */
	UNKNOWN,
	/**
	 * 64/0x40 bytes. Used in Wii hidden/"parade" DB, no creator name.
	 * RFLiHiddenCharData
	 */
	RFL_CORE,
	/**
	 * 74/0x4A bytes. Data format used on Wii.
	 * RFLCharData, FFLiMiiDataOfficialRFL
	 * Extension: rcd, unofficial: mii, mae, miigx
	 */
	RFL_DATA,
	/**
	 * 76/0x4C bytes. Wii data format with CRC-16.
	 * Extension: rsd, used in some titles e.g. MKW ghosts
	 */
	RFL_STORE_DATA,
	/**
	 * 74/0x4A bytes. Data format used in DS titles with Mii characters.
	 * Byte order is little-endian, while bit order is same.
	 */
	RFL_DATA_LITTLE_ENDIAN,
	/**
	 * 72/0x48 bytes. Used in 3DS/Wii U hidden DB, no creator name.
	 * CFLiPackedMiiDataCore, FFLiMiiDataCore
	 */
	VER3_CORE,
	/**
	 * 92/0x5C bytes. Used in 3DS/Wii U database, no CRC.
	 * CFLiPackedMiiDataOfficial, FFLiMiiDataOfficial
	 * Unofficial extensions: 3dsmii, cfcd, ffcd
	 */
	VER3_DATA,
	/**
	 * 96/0x60 bytes. Data format used on 3DS/Wii U.
	 * CFLiMiiDataPacket/CFLStoreData, FFLStoreData, nn::mii::Ver3StoreData
	 * Extensions: cfsd, ffsd
	 */
	VER3_STORE_DATA,
	/**
	 * 92/0x5C bytes. Used in the Wii U database.
	 * Byte order is big-endian, while bit order is same.
	 */
	VER3_DATA_BIG_ENDIAN,
	/**
	 * 88/0x58 bytes. Used in Switch titles. Each field is a byte.
	 * nn::mii::CharInfo/nn::mii::detail::CharInfoRaw
	 * Unofficial extension: charinfo (SDK uses .dat)
	 */
	NX_CHAR_INFO,
	/**
	 * 48/0x30 bytes. Used in Switch databases and NFIF format. Bitfield-packed, no CreateID.
	 * nn::mii::CoreData/nn::mii::detail::CoreDataRaw
	 * Unofficial extension: nfcd
	 */
	NX_CORE,
	/**
	 * 68/0x44 bytes. Used in Switch MiiDatabase.dat (editor DB).
	 * Contains core, CreateID, CRC-16 of data, and CRC-16 of system AuthorID.
	 * nn::mii::StoreData/nn::mii::detail::StoreDataRaw
	 * Unofficial extension: nfsd
	 */
	NX_STORE_DATA,
	/**
	 * 28/0x1C bytes. Trimmed version of Switch CoreData excluding name.
	 */
	NX_CORE_PARAM,
	/**
	 * 46/0x2E bytes. Used in NA/"Mii Studio" web editor.
	 * This is the format before obfuscation and in LocalStorage.
	 * Contains only visual information with Switch colors/glass types.
	 * Unofficial extension: mnms
	 */
	STUDIO_DATA,
	/**
	 * 47/0x2F bytes. NA/"Mii Studio" web editor format with obfuscation.
	 * This obfuscated form is used in the "data=" URL param for the /miis/image.png endpoint.
	 */
	STUDIO_URL_DATA,
}

export enum MiiDataSize {
	UNKNOWN,
	RFL_CORE,
	RFL_DATA,
	RFL_STORE_DATA,
	VER3_CORE,
	VER3_DATA,
	VER3_STORE_DATA,
	NX_CORE,
	NX_CHAR_INFO,
	NX_STORE_DATA,
	NX_CORE_PARAM,
	STUDIO_DATA,
	STUDIO_URL_DATA,
	/**
	 * Represents the biggest Mii data format,
	 * in order to provide a maximum buffer size.
	 */
	MAX_SIZE,
}

export class MiiFormat
{
	private constructor();

	public static getTypeFromSize(size: number): MiiDataType;

	public static getSize(type: MiiDataType): number;
}

export class DataConversionUtilityTodoMoveThis
{
	private constructor();

	public static convertDataTypeTo(src: Readonly<Uint8Array>, dst: Uint8Array, srcType: MiiDataType, dstType: MiiDataType): boolean;

	public static decodeDataType(src: Readonly<Uint8Array>, type: MiiDataType, info: MiiVisualInfo, ex: MiiExtraInfo): boolean;

	public static encodeDataTypeTo(dst: Uint8Array, type: MiiDataType, info: MiiVisualInfo, ex: MiiExtraInfo): void;

	public static convertDataType(src: Readonly<Uint8Array>, srcType: MiiDataType, dstType: MiiDataType): Uint8Array | null;

	public static encodeDataType(type: MiiDataType, info: MiiVisualInfo, ex: MiiExtraInfo): Uint8Array;

	public static isDataTypeNx(t: MiiDataType): boolean;

	public static convertRflExtraForVer3(extra: MiiExtraInfo): void;

	static _convertRflCreateIdToVer3(idData: Uint8Array, authorId: Readonly<Uint8Array>): void;

	public static adjustExtra(extra: MiiExtraInfo, type: MiiDataType, newId: Readonly<Uint8Array>): void;

	static _isAllZeroes(bytes: Readonly<Uint8Array>, size: number): boolean;

	public static adjustExtraForVer3(extra: MiiExtraInfo, newId: Readonly<Uint8Array>): void;

	public static adjustExtraForNx(extra: MiiExtraInfo, newId: Readonly<Uint8Array>): void;

	public static applyNfpExtension(info: MiiVisualInfo, src: Readonly<Uint8Array>, offset?: number): void;
}

export class CharDataSwapUtility
{
	private constructor();

	static _swap16All(data: Uint8Array, offset: number, count?: number): void;

	static _swap32(data: Uint8Array, offset: number): void;

	public static swapVer3Data(data: Uint8Array, hasCreator: boolean): void;

	public static swapRflData(data: Uint8Array, hasCreator: boolean): void;
}

/**
 * Ported from the following (LGPLv3 license): https://github.com/sdroege/snippets/blob/b760be3ef9c57e7a8a03fd73bb90666169cc3f39/snippets/fnv.c_L119-L183
 * See above for more simple snippets to port from.
 */
export class Fnv1a
{
	private constructor();

	public static calculate128(hash: Uint8Array, data: Readonly<Uint8Array>, size: number): void;

	public static create128(data: Readonly<Uint8Array>, size: number): Uint8Array;
}
