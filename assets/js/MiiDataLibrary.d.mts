// Generated automatically with "fut". Do not edit.

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
	public static char16ToUtf8(dst: Uint8Array, src: Readonly<Uint16Array>, characterCount: number): number;

	public static utf8ToChar16(dst: Uint16Array, src: Readonly<Uint8Array>, srcSize: number): number;

	public static char16ToString(src: Readonly<Uint16Array>, characterCount: number): string;
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
	 * @param context Starting CRC value/seed.
	 */
	public static calculate(input: Readonly<Uint8Array>, size: number, context?: number): number;
}

export class MiiDecoder
{
	private constructor();

	static #i2b(i: number): boolean;

	static #loadArrayU16LittleEndian(src: Readonly<Uint8Array>, srcOffset: number, dst: Uint16Array, dstOffset: number, count: number): void;

	static #loadArrayU16BigEndian(src: Readonly<Uint8Array>, srcOffset: number, dst: Uint16Array, dstOffset: number, count: number): void;

	static #convVer3ToNx(info: MiiVisualInfo): void;

	public static visualFrom3dsWiiuCore(src: Readonly<Uint8Array>, info: MiiVisualInfo): void;

	public static from3dsWiiuCore(src: Readonly<Uint8Array>, info: MiiVisualInfo, ex: MiiExtraInfo): void;

	public static from3dsWiiuData(src: Readonly<Uint8Array>, info: MiiVisualInfo, ex: MiiExtraInfo): void;

	public static from3dsWiiuStoreData(src: Readonly<Uint8Array>, info: MiiVisualInfo, ex: MiiExtraInfo): boolean;

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

class NxToVer3
{
	private constructor();

	public static readonly TO_VER3_HAIR_COLOR: Readonly<Uint8Array>;

	public static readonly TO_VER3_EYE_COLOR: Readonly<Uint8Array>;

	public static readonly TO_VER3_MOUTH_COLOR: Readonly<Uint8Array>;

	public static readonly TO_VER3_GLASS_COLOR: Readonly<Uint8Array>;

	public static readonly TO_VER3_FACELINE_COLOR: Readonly<Uint8Array>;

	public static readonly TO_VER3_GLASS_TYPE: Readonly<Uint8Array>;
}

export class MiiEncoder
{
	private constructor();

	static #b2i(b: boolean): number;

	static #storeArrayU16LittleEndian(src: Readonly<Uint16Array>, srcOffset: number, dst: Uint8Array, dstOffset: number, count: number): void;

	static #storeArrayU16BigEndian(src: Readonly<Uint16Array>, srcOffset: number, dst: Uint8Array, dstOffset: number, count: number): void;

	public static storeU16BigEndian(value: number, dst: Uint8Array, dstOffset: number): void;

	public static visualTo3dsWiiuCore(dst: Uint8Array, info: MiiVisualInfo): void;

	public static to3dsWiiuCore(dst: Uint8Array, info: MiiVisualInfo, ex: MiiExtraInfo): void;

	public static to3dsWiiuData(dst: Uint8Array, info: MiiVisualInfo, ex: MiiExtraInfo): void;

	public static to3dsWiiuStoreData(dst: Uint8Array, info: MiiVisualInfo, ex: MiiExtraInfo): void;

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
	WII_CREATE_ID : 6,
	VER3_PERSONAL : 7,
	NX_CREATE_ID : 8,
	NX_DEVICE_CRC : 9
} as const;

export class MiiExtraInfo
{
	public flag: number;
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
	 * Determines which regions to show non-ASCII characters.
	 */
	public fontRegion: number;
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
	public copyable: boolean;
	public ngWord: boolean;
	public roomIndex: number;
	public positionInRoom: number;

	clearFlag(): void;

	setFlag(f: MiiExtraFlag): void;

	hasFlag(f: MiiExtraFlag): boolean;
}

export class Ver3CreateId
{
	private constructor();

	static readonly #BIT_NORMAL: number;

	static readonly #BIT_NTR: number;

	static readonly #BIT_TEMPORARY: number;

	static readonly #BIT_CTR: number;

	public static isCtr(idByte0: number): boolean;

	public static isNtr(idByte0: number): boolean;

	public static isWii(idByte0: number): boolean;

	public static isWiiu(idByte0: number): boolean;

	public static isNormal(idByte0: number): boolean;

	public static isTemporary(idByte0: number): boolean;
}

export class StudioObfuscation
{
	private constructor();

	public static readonly SIZE_RAW_DATA: number;

	/**
	 * Obfuscates Studio data to be used in the URL.
	 * @param seed The random value to use for the obfuscation. Best left as 0.
	 */
	public static encode(dst: Uint8Array, src: Uint8Array, seed?: number): void;

	/**
	 * Deobfuscates Studio URL data to raw decodable data.
	 */
	public static decode(dst: Uint8Array, src: Readonly<Uint8Array>): void;
}
