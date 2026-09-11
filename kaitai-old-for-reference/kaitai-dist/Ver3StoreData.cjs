// This is a generated file! Please edit source .ksy file and use kaitai-struct-compiler to rebuild

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['exports', 'kaitai-struct/KaitaiStream'], factory);
  } else if (typeof exports === 'object' && exports !== null && typeof exports.nodeType !== 'number') {
    factory(exports, require('kaitai-struct/KaitaiStream'));
  } else {
    factory(root.Ver3StoreData || (root.Ver3StoreData = {}), root.KaitaiStream);
  }
})(typeof self !== 'undefined' ? self : this, function (Ver3StoreData_, KaitaiStream) {
/**
 * The real field names are in DWARF info for CFL (niconico_develop.axf)
 * as well as nn::mii::detail::Ver3StoreDataRaw getter functions.
 * All of the names of fields here are original, as far as I'm aware.
 */

var Ver3StoreData = (function() {
  Ver3StoreData.AuthorType = Object.freeze({
    NORMAL: 0,

    0: "NORMAL",
  });

  Ver3StoreData.BirthPlatform = Object.freeze({
    WII: 1,
    DS: 2,
    CTR: 3,
    WIIU: 4,
    FETURE0: 5,
    FETURE1: 6,
    FETURE2: 7,

    1: "WII",
    2: "DS",
    3: "CTR",
    4: "WIIU",
    5: "FETURE0",
    6: "FETURE1",
    7: "FETURE2",
  });

  Ver3StoreData.FavoriteColor = Object.freeze({
    RED: 0,
    ORANGE: 1,
    YELLOW: 2,
    YELLOWGREEN: 3,
    GREEN: 4,
    BLUE: 5,
    SKYBLUE: 6,
    PINK: 7,
    PURPLE: 8,
    BROWN: 9,
    WHITE: 10,
    BLACK: 11,

    0: "RED",
    1: "ORANGE",
    2: "YELLOW",
    3: "YELLOWGREEN",
    4: "GREEN",
    5: "BLUE",
    6: "SKYBLUE",
    7: "PINK",
    8: "PURPLE",
    9: "BROWN",
    10: "WHITE",
    11: "BLACK",
  });

  Ver3StoreData.FontRegion = Object.freeze({
    JP_US_EU: 0,
    CHINA: 1,
    KOREA: 2,
    TAIWAN: 3,

    0: "JP_US_EU",
    1: "CHINA",
    2: "KOREA",
    3: "TAIWAN",
  });

  Ver3StoreData.Gender = Object.freeze({
    MALE: 0,
    FEMALE: 1,

    0: "MALE",
    1: "FEMALE",
  });

  Ver3StoreData.RegionMove = Object.freeze({
    ALL: 0,
    JP_ONLY: 1,
    US_ONLY: 2,
    EU_ONLY: 3,

    0: "ALL",
    1: "JP_ONLY",
    2: "US_ONLY",
    3: "EU_ONLY",
  });

  function Ver3StoreData(_io, _parent, _root) {
    this._io = _io;
    this._parent = _parent;
    this._root = _root || this;

    this._read();
  }
  Ver3StoreData.prototype._read = function() {
    this.miiVersion = this._io.readBitsIntLe(8);
    if (!( ((this.miiVersion == 0) || (this.miiVersion == 3)) )) {
      throw new KaitaiStream.ValidationNotAnyOfError(this.miiVersion, this._io, "/seq/0");
    }
    this.copyable = this._io.readBitsIntLe(1) != 0;
    this.ngWord = this._io.readBitsIntLe(1) != 0;
    this.regionMove = this._io.readBitsIntLe(2);
    this.fontRegion = this._io.readBitsIntLe(2);
    this.reserved0 = this._io.readBitsIntLe(2);
    if (!(this.reserved0 <= 0)) {
      throw new KaitaiStream.ValidationGreaterThanError(0, this.reserved0, this._io, "/seq/5");
    }
    this.roomIndex = this._io.readBitsIntLe(4);
    if (!(this.roomIndex <= 9)) {
      throw new KaitaiStream.ValidationGreaterThanError(9, this.roomIndex, this._io, "/seq/6");
    }
    this.positionInRoom = this._io.readBitsIntLe(4);
    if (!(this.positionInRoom <= 9)) {
      throw new KaitaiStream.ValidationGreaterThanError(9, this.positionInRoom, this._io, "/seq/7");
    }
    this.authorType = this._io.readBitsIntLe(4);
    if (!Object.prototype.hasOwnProperty.call(Ver3StoreData.AuthorType, this.authorType)) {
      throw new KaitaiStream.ValidationNotInEnumError(this.authorType, this._io, "/seq/8");
    }
    this.birthPlatform = this._io.readBitsIntLe(3);
    if (!Object.prototype.hasOwnProperty.call(Ver3StoreData.BirthPlatform, this.birthPlatform)) {
      throw new KaitaiStream.ValidationNotInEnumError(this.birthPlatform, this._io, "/seq/9");
    }
    this.reserved1 = this._io.readBitsIntLe(1) != 0;
    this._io.alignToByte();
    this.authorId = [];
    for (var i = 0; i < 8; i++) {
      this.authorId.push(this._io.readU1());
    }
    this.createId = new CreateId(this._io, this, this._root);
    var _ = this.createId;
    if (!(!( ((this.createId.data[0] == 0) && (this.createId.data[1] == 0) && (this.createId.data[2] == 0) && (this.createId.data[3] == 0) && (this.createId.data[4] == 0) && (this.createId.data[5] == 0) && (this.createId.data[6] == 0) && (this.createId.data[7] == 0) && (this.createId.data[8] == 0) && (this.createId.data[9] == 0)) ))) {
      throw new KaitaiStream.ValidationExprError(this.createId, this._io, "/seq/12");
    }
    this.reserved2 = [];
    for (var i = 0; i < 2; i++) {
      this.reserved2.push(this._io.readU1());
      if (!(this.reserved2[i] <= 0)) {
        throw new KaitaiStream.ValidationGreaterThanError(0, this.reserved2[i], this._io, "/seq/13");
      }
    }
    this.gender = this._io.readBitsIntLe(1);
    this.birthMonth = this._io.readBitsIntLe(4);
    this.birthDay = this._io.readBitsIntLe(5);
    var _ = this.birthDay;
    if (!( ((!( ((this.birthMonth == 0) && (this.birthDay != 0)) )) && (!( ((this.birthMonth != 0) && (this.birthDay == 0)) )) && (!( ((this.birthMonth > 12) || (this.birthDay > 31)) )) && (this.birthDay <= this.numberOfDaysInAMonth[this.birthMonth])) )) {
      throw new KaitaiStream.ValidationExprError(this.birthDay, this._io, "/seq/16");
    }
    this.favoriteColor = this._io.readBitsIntLe(4);
    if (!Object.prototype.hasOwnProperty.call(Ver3StoreData.FavoriteColor, this.favoriteColor)) {
      throw new KaitaiStream.ValidationNotInEnumError(this.favoriteColor, this._io, "/seq/17");
    }
    this.favorite = this._io.readBitsIntLe(1) != 0;
    this.padding0 = this._io.readBitsIntLe(1) != 0;
    if (!(this.padding0 == false)) {
      throw new KaitaiStream.ValidationNotEqualError(false, this.padding0, this._io, "/seq/19");
    }
    this._io.alignToByte();
    this.name = globalThis['KaitaiStream']['bytesToStr'](KaitaiStream.bytesTerminateMulti(this._io.readBytes(20), new Uint8Array([0, 0]), false), "UTF-16LE");
    this.height = this._io.readU1();
    if (!(this.height <= 128)) {
      throw new KaitaiStream.ValidationGreaterThanError(128, this.height, this._io, "/seq/21");
    }
    this.build = this._io.readU1();
    if (!(this.build <= 128)) {
      throw new KaitaiStream.ValidationGreaterThanError(128, this.build, this._io, "/seq/22");
    }
    this.localonly = this._io.readBitsIntLe(1) != 0;
    var _ = this.localonly;
    if (!( ((this.createId.flags.normal) || (this.localonly)) )) {
      throw new KaitaiStream.ValidationExprError(this.localonly, this._io, "/seq/23");
    }
    this.faceType = this._io.readBitsIntLe(4);
    if (!(this.faceType <= 11)) {
      throw new KaitaiStream.ValidationGreaterThanError(11, this.faceType, this._io, "/seq/24");
    }
    this.faceColor = this._io.readBitsIntLe(3);
    if (!(this.faceColor <= 5)) {
      throw new KaitaiStream.ValidationGreaterThanError(5, this.faceColor, this._io, "/seq/25");
    }
    this.faceTex = this._io.readBitsIntLe(4);
    if (!(this.faceTex <= 11)) {
      throw new KaitaiStream.ValidationGreaterThanError(11, this.faceTex, this._io, "/seq/26");
    }
    this.faceMake = this._io.readBitsIntLe(4);
    if (!(this.faceMake <= 11)) {
      throw new KaitaiStream.ValidationGreaterThanError(11, this.faceMake, this._io, "/seq/27");
    }
    this.hairType = this._io.readBitsIntLe(8);
    if (!(this.hairType <= 131)) {
      throw new KaitaiStream.ValidationGreaterThanError(131, this.hairType, this._io, "/seq/28");
    }
    this.hairColor = this._io.readBitsIntLe(3);
    if (!(this.hairColor <= 7)) {
      throw new KaitaiStream.ValidationGreaterThanError(7, this.hairColor, this._io, "/seq/29");
    }
    this.hairFlip = this._io.readBitsIntLe(1) != 0;
    this.padding1 = this._io.readBitsIntLe(4);
    if (!(this.padding1 <= 0)) {
      throw new KaitaiStream.ValidationGreaterThanError(0, this.padding1, this._io, "/seq/31");
    }
    this.eyeType = this._io.readBitsIntLe(6);
    if (!(this.eyeType <= 59)) {
      throw new KaitaiStream.ValidationGreaterThanError(59, this.eyeType, this._io, "/seq/32");
    }
    this.eyeColor = this._io.readBitsIntLe(3);
    if (!(this.eyeColor <= 5)) {
      throw new KaitaiStream.ValidationGreaterThanError(5, this.eyeColor, this._io, "/seq/33");
    }
    this.eyeScale = this._io.readBitsIntLe(4);
    if (!(this.eyeScale <= 7)) {
      throw new KaitaiStream.ValidationGreaterThanError(7, this.eyeScale, this._io, "/seq/34");
    }
    this.eyeAspect = this._io.readBitsIntLe(3);
    if (!(this.eyeAspect <= 6)) {
      throw new KaitaiStream.ValidationGreaterThanError(6, this.eyeAspect, this._io, "/seq/35");
    }
    this.eyeRotate = this._io.readBitsIntLe(5);
    if (!(this.eyeRotate <= 7)) {
      throw new KaitaiStream.ValidationGreaterThanError(7, this.eyeRotate, this._io, "/seq/36");
    }
    this.eyeX = this._io.readBitsIntLe(4);
    if (!(this.eyeX <= 12)) {
      throw new KaitaiStream.ValidationGreaterThanError(12, this.eyeX, this._io, "/seq/37");
    }
    this.eyeY = this._io.readBitsIntLe(5);
    if (!(this.eyeY <= 18)) {
      throw new KaitaiStream.ValidationGreaterThanError(18, this.eyeY, this._io, "/seq/38");
    }
    this.padding2 = this._io.readBitsIntLe(2);
    if (!(this.padding2 <= 0)) {
      throw new KaitaiStream.ValidationGreaterThanError(0, this.padding2, this._io, "/seq/39");
    }
    this.eyebrowType = this._io.readBitsIntLe(5);
    if (!(this.eyebrowType <= 23)) {
      throw new KaitaiStream.ValidationGreaterThanError(23, this.eyebrowType, this._io, "/seq/40");
    }
    this.eyebrowColor = this._io.readBitsIntLe(3);
    if (!(this.eyebrowColor <= 7)) {
      throw new KaitaiStream.ValidationGreaterThanError(7, this.eyebrowColor, this._io, "/seq/41");
    }
    this.eyebrowScale = this._io.readBitsIntLe(4);
    if (!(this.eyebrowScale <= 8)) {
      throw new KaitaiStream.ValidationGreaterThanError(8, this.eyebrowScale, this._io, "/seq/42");
    }
    this.eyebrowAspect = this._io.readBitsIntLe(3);
    if (!(this.eyebrowAspect <= 6)) {
      throw new KaitaiStream.ValidationGreaterThanError(6, this.eyebrowAspect, this._io, "/seq/43");
    }
    this.padding3 = this._io.readBitsIntLe(1) != 0;
    if (!(this.padding3 == false)) {
      throw new KaitaiStream.ValidationNotEqualError(false, this.padding3, this._io, "/seq/44");
    }
    this.eyebrowRotate = this._io.readBitsIntLe(5);
    if (!(this.eyebrowRotate <= 11)) {
      throw new KaitaiStream.ValidationGreaterThanError(11, this.eyebrowRotate, this._io, "/seq/45");
    }
    this.eyebrowX = this._io.readBitsIntLe(4);
    if (!(this.eyebrowX <= 12)) {
      throw new KaitaiStream.ValidationGreaterThanError(12, this.eyebrowX, this._io, "/seq/46");
    }
    this.eyebrowY = this._io.readBitsIntLe(5);
    if (!(this.eyebrowY >= 3)) {
      throw new KaitaiStream.ValidationLessThanError(3, this.eyebrowY, this._io, "/seq/47");
    }
    if (!(this.eyebrowY <= 18)) {
      throw new KaitaiStream.ValidationGreaterThanError(18, this.eyebrowY, this._io, "/seq/47");
    }
    this.padding4 = this._io.readBitsIntLe(2);
    if (!(this.padding4 <= 0)) {
      throw new KaitaiStream.ValidationGreaterThanError(0, this.padding4, this._io, "/seq/48");
    }
    this.noseType = this._io.readBitsIntLe(5);
    if (!(this.noseType <= 17)) {
      throw new KaitaiStream.ValidationGreaterThanError(17, this.noseType, this._io, "/seq/49");
    }
    this.noseScale = this._io.readBitsIntLe(4);
    if (!(this.noseScale <= 8)) {
      throw new KaitaiStream.ValidationGreaterThanError(8, this.noseScale, this._io, "/seq/50");
    }
    this.noseY = this._io.readBitsIntLe(5);
    if (!(this.noseY <= 18)) {
      throw new KaitaiStream.ValidationGreaterThanError(18, this.noseY, this._io, "/seq/51");
    }
    this.padding5 = this._io.readBitsIntLe(2);
    if (!(this.padding5 <= 0)) {
      throw new KaitaiStream.ValidationGreaterThanError(0, this.padding5, this._io, "/seq/52");
    }
    this.mouthType = this._io.readBitsIntLe(6);
    if (!(this.mouthType <= 35)) {
      throw new KaitaiStream.ValidationGreaterThanError(35, this.mouthType, this._io, "/seq/53");
    }
    this.mouthColor = this._io.readBitsIntLe(3);
    if (!(this.mouthColor <= 4)) {
      throw new KaitaiStream.ValidationGreaterThanError(4, this.mouthColor, this._io, "/seq/54");
    }
    this.mouthScale = this._io.readBitsIntLe(4);
    if (!(this.mouthScale <= 8)) {
      throw new KaitaiStream.ValidationGreaterThanError(8, this.mouthScale, this._io, "/seq/55");
    }
    this.mouthAspect = this._io.readBitsIntLe(3);
    if (!(this.mouthAspect <= 6)) {
      throw new KaitaiStream.ValidationGreaterThanError(6, this.mouthAspect, this._io, "/seq/56");
    }
    this.mouthY = this._io.readBitsIntLe(5);
    if (!(this.mouthY <= 18)) {
      throw new KaitaiStream.ValidationGreaterThanError(18, this.mouthY, this._io, "/seq/57");
    }
    this.mustacheType = this._io.readBitsIntLe(3);
    if (!(this.mustacheType <= 5)) {
      throw new KaitaiStream.ValidationGreaterThanError(5, this.mustacheType, this._io, "/seq/58");
    }
    this.padding6 = this._io.readBitsIntLe(8);
    if (!(this.padding6 <= 0)) {
      throw new KaitaiStream.ValidationGreaterThanError(0, this.padding6, this._io, "/seq/59");
    }
    this.beardType = this._io.readBitsIntLe(3);
    if (!(this.beardType <= 5)) {
      throw new KaitaiStream.ValidationGreaterThanError(5, this.beardType, this._io, "/seq/60");
    }
    this.beardColor = this._io.readBitsIntLe(3);
    if (!(this.beardColor <= 7)) {
      throw new KaitaiStream.ValidationGreaterThanError(7, this.beardColor, this._io, "/seq/61");
    }
    this.beardScale = this._io.readBitsIntLe(4);
    if (!(this.beardScale <= 8)) {
      throw new KaitaiStream.ValidationGreaterThanError(8, this.beardScale, this._io, "/seq/62");
    }
    this.beardY = this._io.readBitsIntLe(5);
    if (!(this.beardY <= 16)) {
      throw new KaitaiStream.ValidationGreaterThanError(16, this.beardY, this._io, "/seq/63");
    }
    this.padding7 = this._io.readBitsIntLe(1) != 0;
    if (!(this.padding7 == false)) {
      throw new KaitaiStream.ValidationNotEqualError(false, this.padding7, this._io, "/seq/64");
    }
    this.glassType = this._io.readBitsIntLe(4);
    if (!(this.glassType <= 8)) {
      throw new KaitaiStream.ValidationGreaterThanError(8, this.glassType, this._io, "/seq/65");
    }
    this.glassColor = this._io.readBitsIntLe(3);
    if (!(this.glassColor <= 5)) {
      throw new KaitaiStream.ValidationGreaterThanError(5, this.glassColor, this._io, "/seq/66");
    }
    this.glassScale = this._io.readBitsIntLe(4);
    if (!(this.glassScale <= 7)) {
      throw new KaitaiStream.ValidationGreaterThanError(7, this.glassScale, this._io, "/seq/67");
    }
    this.glassY = this._io.readBitsIntLe(5);
    if (!(this.glassY <= 20)) {
      throw new KaitaiStream.ValidationGreaterThanError(20, this.glassY, this._io, "/seq/68");
    }
    this.moleType = this._io.readBitsIntLe(1) != 0;
    this.moleScale = this._io.readBitsIntLe(4);
    if (!(this.moleScale <= 8)) {
      throw new KaitaiStream.ValidationGreaterThanError(8, this.moleScale, this._io, "/seq/70");
    }
    this.moleX = this._io.readBitsIntLe(5);
    if (!(this.moleX <= 16)) {
      throw new KaitaiStream.ValidationGreaterThanError(16, this.moleX, this._io, "/seq/71");
    }
    this.moleY = this._io.readBitsIntLe(5);
    if (!(this.moleY <= 30)) {
      throw new KaitaiStream.ValidationGreaterThanError(30, this.moleY, this._io, "/seq/72");
    }
    this.padding8 = this._io.readBitsIntLe(1) != 0;
    if (!(this.padding8 == false)) {
      throw new KaitaiStream.ValidationNotEqualError(false, this.padding8, this._io, "/seq/73");
    }
    this._io.alignToByte();
    if (!(this._io.isEof())) {
      this.creatorName = globalThis['KaitaiStream']['bytesToStr'](KaitaiStream.bytesTerminateMulti(this._io.readBytes(20), new Uint8Array([0, 0]), false), "UTF-16LE");
    }
    if (!(this._io.isEof())) {
      this.padding9 = this._io.readU2le();
      if (!(this.padding9 <= 0)) {
        throw new KaitaiStream.ValidationGreaterThanError(0, this.padding9, this._io, "/seq/75");
      }
    }
    if (!(this._io.isEof())) {
      this.crc = this._io.readU2le();
    }
  }

  /**
   * Officially called: 生成時ID / 固有ID
   * This actually does not have a struct, and is
   * just an "anonymous" data array which they
   * manually bit-twiddle to check flags.
   */

  var CreateId = Ver3StoreData.CreateId = (function() {
    function CreateId(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root;

      this._read();
    }
    CreateId.prototype._read = function() {
      this.flags = new CreateIdFlags(this._io, this, this._root);
      this.createDateOffset = this._io.readBitsIntBe(28);
      this._io.alignToByte();
      this.base = [];
      for (var i = 0; i < 6; i++) {
        this.base.push(this._io.readU1());
      }
    }

    /**
     * Creation date as a Unix timestamp.
     * Only written if created on Wii U, 3DS or
     * Miitomo - nothing else, e.g. on Switch
     * this is completely random (nn::os::GenerateRandomBytes())
     */
    Object.defineProperty(CreateId.prototype, 'createDateTimestamp', {
      get: function() {
        if (this._m_createDateTimestamp !== undefined)
          return this._m_createDateTimestamp;
        this._m_createDateTimestamp = this.createDateOffset * 2 + 1262304000;
        return this._m_createDateTimestamp;
      }
    });
    Object.defineProperty(CreateId.prototype, 'data', {
      get: function() {
        if (this._m_data !== undefined)
          return this._m_data;
        var _pos = this._io.pos;
        this._io.seek(12);
        this._m_data = [];
        for (var i = 0; i < 10; i++) {
          this._m_data.push(this._io.readU1());
        }
        this._io.seek(_pos);
        return this._m_data;
      }
    });

    /**
     * Different result on each platform.
     * Wii, 3DS, (DS?? unchecked) = MAC address
     * Wii U = nn::act::GetDeviceHash()
     * Miitomo = SHA-1 of afl-cbin (AFLiGetCreateIDBaseBySystem)
     * Switch = random (nn::os::GenerateRandomBytes())
     */

    return CreateId;
  })();

  /**
   * Flags in the first four bits of the ID.
   */

  var CreateIdFlags = Ver3StoreData.CreateIdFlags = (function() {
    CreateIdFlags.CreateIdPlatform = Object.freeze({
      WII: 0,
      CTR: 1,
      NTR: 2,
      WIIU: 3,

      0: "WII",
      1: "CTR",
      2: "NTR",
      3: "WIIU",
    });

    function CreateIdFlags(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root;

      this._read();
    }
    CreateIdFlags.prototype._read = function() {
      this.normal = this._io.readBitsIntBe(1) != 0;
      this.field1 = this._io.readBitsIntBe(1) != 0;
      this.temporary = this._io.readBitsIntBe(1) != 0;
      this.field3 = this._io.readBitsIntBe(1) != 0;
    }

    /**
     * Second and fourth bit of flags.
     * 
     * When converting from Wii data on 3DS, this is used to set
     * birthPlatform to Wii (1) or DS (2) using CFLi_UnpackRFLMiiDataCore
     * but a bug in FFLiMiiDataCoreRFL2CharInfo means it
     * will only be set to Wii (1) and never to DS (2) on Wii U.
     */
    Object.defineProperty(CreateIdFlags.prototype, 'platform', {
      get: function() {
        if (this._m_platform !== undefined)
          return this._m_platform;
        this._m_platform = (this.field1 | 0) << 1 | (this.field3 | 0);
        return this._m_platform;
      }
    });

    /**
     * Cleared = Special, Set = Normal
     * 
     * If a CreateID is special, then localonly must be 1
     * ("sharing"/"mingling" off), or it will be invalid
     * (CFLi_VerifyCharInfo(), FFLiVerifyCharInfoWithReason())
     * 
     * When a Special Mii is scanned as a QR code on Wii U,
     * the CreateID platform bits for Wii U must be set,
     * or it will not be accepted and will only work on a 3DS.
     */

    /**
     * Cleared on Wii and 3DS, set on DS and Wii U.
     */

    /**
     * Given to random Miis (in FFL) and seen in games' CPU Mii files.
     * The CreateID is INVALID when this is set, verified by:
     * FFLiIsValidMiiID(), CFLi_IsValidMiiID(),
     * nn::mii::detail::Ver3CreateId::IsValid()
     * Meaning it will be renderable but cannot be read/written to a DB.
     * 
     * Miis with this bit set are not scannable as QR codes on 3DS.
     * But they will scan on Wii U Mii Maker, though the app will
     * crash after saving and it doesn't appear in the database.
     */

    /**
     * Cleared on Wii and DS, set on 3DS and Wii U.
     */

    return CreateIdFlags;
  })();
  Object.defineProperty(Ver3StoreData.prototype, 'facelineColor', {
    get: function() {
      if (this._m_facelineColor !== undefined)
        return this._m_facelineColor;
      this._m_facelineColor = this.faceColor;
      return this._m_facelineColor;
    }
  });
  Object.defineProperty(Ver3StoreData.prototype, 'facelineType', {
    get: function() {
      if (this._m_facelineType !== undefined)
        return this._m_facelineType;
      this._m_facelineType = this.faceType;
      return this._m_facelineType;
    }
  });
  Object.defineProperty(Ver3StoreData.prototype, 'facelineWrinkle', {
    get: function() {
      if (this._m_facelineWrinkle !== undefined)
        return this._m_facelineWrinkle;
      this._m_facelineWrinkle = this.faceTex;
      return this._m_facelineWrinkle;
    }
  });
  Object.defineProperty(Ver3StoreData.prototype, 'mustacheScale', {
    get: function() {
      if (this._m_mustacheScale !== undefined)
        return this._m_mustacheScale;
      this._m_mustacheScale = this.beardScale;
      return this._m_mustacheScale;
    }
  });
  Object.defineProperty(Ver3StoreData.prototype, 'mustacheY', {
    get: function() {
      if (this._m_mustacheY !== undefined)
        return this._m_mustacheY;
      this._m_mustacheY = this.beardY;
      return this._m_mustacheY;
    }
  });
  Object.defineProperty(Ver3StoreData.prototype, 'nickname', {
    get: function() {
      if (this._m_nickname !== undefined)
        return this._m_nickname;
      this._m_nickname = this.name;
      return this._m_nickname;
    }
  });
  Object.defineProperty(Ver3StoreData.prototype, 'numberOfDaysInAMonth', {
    get: function() {
      if (this._m_numberOfDaysInAMonth !== undefined)
        return this._m_numberOfDaysInAMonth;
      this._m_numberOfDaysInAMonth = new Uint8Array([0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);
      return this._m_numberOfDaysInAMonth;
    }
  });

  /**
   * Set to constant 0x03, but can also be set to 0x00
   * when created using the Wii U Mii Maker camera feature.
   * (bug? happens somewhere in mwmpfGetFFLCharInfo)
   */

  /**
   * Font region enum value. 0 corresponds to JP/US/EU,
   * all “primary” regions consoles are sold.
   * 
   * The extent to which this is used is unclear, but if
   * the font region doesn’t match the console,
   * all non-ASCII characters are turned into question marks.
   * (FFL: FFLiAdditionalInfo.cpp > IsAvailableFontRegion(), ReplaceNonAsciiNameChar: https://github.com/aboood40091/ffl/blob/73fe9fc70c0f96ebea373122e50f6d3acc443180/src/FFLiAdditionalInfo.cpp#L33-L44)
   * (CFL: CFLi_GetAdditionalInfo(), cfl_edit.cpp: IsAvailableFontRegion(), ReplaceNonAsciiNameChar())
   * (nn::mii: mii_Common.cpp > ReplaceFontRegion(), ReplaceQuestionMark())
   */

  /**
   * This and positionInRoom are used only in CFL_DB.dat,
   * but CharInfo verification will fail in CFL/FFL
   * if roomIndex/positionInRoom exceed 9.
   */

  /**
   * Unused. Value 0 corresponds to "normal". This was presumably for UGC.
   * No enum in CFL, and always set in CFL/FFL (+ CharInfo) to 0.
   * Note that nn::mii::detail::Ver3StoreDataRaw::Verify() enforces this
   * to be zero (along with all other fields that are reserved/padding)
   */

  /**
   * On 3DS, the max for this field is 3 (may be higher in newer CFL),
   * so higher values are considered invalid.
   * 
   * So, if this is set to 4 then it will only be valid and
   * scannable as a QR code on Wii U.
   * Wii U/Miitomo sets this to 3 when creating QR codes ({F/A}FLiConvertStoreDataForCTR())
   * 
   * Note that in FFL and nn::mii, this accepts a max value of 7.
   * 
   * 1 corresponds to Wii and 2 corresponds to DS but a bug in
   * FFLiMiiDataCoreRFL2CharInfo() ensures that it’s never set to 2 on Wii U.
   */

  /**
   * In CFL and FFL this is derived from the following:
   * CFL: `nn::cfg::CTR::GetTransferableId(0);`
   * FFL: `nn::act::GetTransferableIdEx(u64*, 0x004A0, 0xFF);`
   * This is a console-unique ID that may be
   * reset when the console is formatted.
   * 
   * In order for the Mii to be considered as created from the
   * same console (CFLi_IsHomeAuthorID(), FFLiIsHomeAuthorID()),
   * this authorID field has to match.
   */

  /**
   * Unique identifier for the data. This is often called the
   * "Mii ID", and is a 10-byte field that's often separated
   * unofficially into 4 and 6 byte portions.
   * The system will consider two Miis with the same CreateID
   * to be the same, and offer to overwrite if you import a conflicting ID.
   * 
   * The first four bits are a flag that contain
   * a flag for whether the Mii is special.
   */

  /**
   * 0 = not set. Counts from 1-12.
   */

  /**
   * 0 = not set. Counts from 1-31.
   * Consoles only let you set both fields, not just one.
   * Note that the maximum day per month is validated in
   * CFL (CFLi_GetMonthOfDay::monthOfDay),
   * FFL (MONTH_OF_DAY, https://github.com/aboood40091/ffl/blob/master/src/FFLiDateTime.cpp#L47),
   * RFL (RFLiCheckBirthday, https://github.com/SMGCommunity/Petari/blob/6c4e3156be67abc08827655a788afee013ca4ed4/src/RVLFaceLib/RFL_DataUtility.c#L281),
   * nn::mii (mii_Ver3StoreDataRaw.cpp, IsValidBirthday(int, int)::NumberOfDaysInAMonth)
   */

  /**
   * Does not have a null terminator at the end unlike CharInfo.
   * Note that 3DS/Wii U often don't overwrite the old name
   * with zeroes when changing the name, so you must properly
   * terminate this string with the first two zero bytes.
   */

  /**
   * The height/Y-scale of the body model.
   * 
   * In this struct, the maximum for height/build is 128
   * while on later platforms it is 127, so this must be clamped.
   */

  /**
   * The build, "physique" (N), weight/X and Z scale of the body model.
   * Maximum for this is also 128 and it should be clamped.
   */

  /**
   * Corresponds to "sharing", "mingling".
   * "Sharing/Mingling Off" = localonly is 1.
   */

  /**
   * Unlike other minimum values, eyebrowY begins at 3.
   * That's probably to make all-zero data invalid, as
   * if you hook FFLiiVerifyCharInfo you will notice that
   * Wii U Menu/Mii Maker is constantly trying
   * to "verify" null data lmao
   * (The VerifyCharInfo function ignores null CreateIDs)
   */

  /**
   * Additional in CFLiPackedMiiDataOfficial.
   * See name field for quirks.
   */

  /**
   * Additional in CFLiMiiDataPacket.
   */

  /**
   * Additional in CFLiMiiDataPacket.
   */

  return Ver3StoreData;
})();
Ver3StoreData_.Ver3StoreData = Ver3StoreData;
});
