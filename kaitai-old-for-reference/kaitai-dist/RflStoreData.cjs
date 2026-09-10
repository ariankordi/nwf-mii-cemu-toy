// This is a generated file! Please edit source .ksy file and use kaitai-struct-compiler to rebuild

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['exports', 'kaitai-struct/KaitaiStream'], factory);
  } else if (typeof exports === 'object' && exports !== null && typeof exports.nodeType !== 'number') {
    factory(exports, require('kaitai-struct/KaitaiStream'));
  } else {
    factory(root.RflStoreData || (root.RflStoreData = {}), root.KaitaiStream);
  }
})(typeof self !== 'undefined' ? self : this, function (RflStoreData_, KaitaiStream) {
var RflStoreData = (function() {
  RflStoreData.FavoriteColor = Object.freeze({
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

  RflStoreData.Gender = Object.freeze({
    MALE: 0,
    FEMALE: 1,
    ALL: 2,

    0: "MALE",
    1: "FEMALE",
    2: "ALL",
  });

  RflStoreData.Type = Object.freeze({
    NORMAL: 0,
    PRESENTED: 1,
    UNDERGROUND: 2,
    SPECIAL: 3,

    0: "NORMAL",
    1: "PRESENTED",
    2: "UNDERGROUND",
    3: "SPECIAL",
  });

  function RflStoreData(_io, _parent, _root) {
    this._io = _io;
    this._parent = _parent;
    this._root = _root || this;

    this._read();
  }
  RflStoreData.prototype._read = function() {
    this.padding0 = this._io.readBitsIntBe(1) != 0;
    this.gender = this._io.readBitsIntBe(1);
    this.birthMonth = this._io.readBitsIntBe(4);
    this.birthDay = this._io.readBitsIntBe(5);
    this.favoriteColor = this._io.readBitsIntBe(4);
    this.favorite = this._io.readBitsIntBe(1) != 0;
    this._io.alignToByte();
    this.name = globalThis['KaitaiStream']['bytesToStr'](this._io.readBytes(20), "UTF-16BE");
    this.height = this._io.readU1();
    this.build = this._io.readU1();
    this.createId = new CreateId(this._io, this, this._root);
    this.faceType = this._io.readBitsIntBe(3);
    this.faceColor = this._io.readBitsIntBe(3);
    this.faceTex = this._io.readBitsIntBe(4);
    this.padding2 = this._io.readBitsIntBe(3);
    this.localonly = this._io.readBitsIntBe(1) != 0;
    this.type = this._io.readBitsIntBe(2);
    this.hairType = this._io.readBitsIntBe(7);
    this.hairColor = this._io.readBitsIntBe(3);
    this.hairFlip = this._io.readBitsIntBe(1) != 0;
    this.padding3 = this._io.readBitsIntBe(5);
    this.eyebrowType = this._io.readBitsIntBe(5);
    this.eyebrowRotate = this._io.readBitsIntBe(5);
    this.padding4 = this._io.readBitsIntBe(6);
    this.eyebrowColor = this._io.readBitsIntBe(3);
    this.eyebrowScale = this._io.readBitsIntBe(4);
    this.eyebrowY = this._io.readBitsIntBe(5);
    this.eyebrowX = this._io.readBitsIntBe(4);
    this.eyeType = this._io.readBitsIntBe(6);
    this.eyeRotate = this._io.readBitsIntBe(5);
    this.eyeY = this._io.readBitsIntBe(5);
    this.eyeColor = this._io.readBitsIntBe(3);
    this.eyeScale = this._io.readBitsIntBe(4);
    this.eyeX = this._io.readBitsIntBe(4);
    this.padding5 = this._io.readBitsIntBe(5);
    this.noseType = this._io.readBitsIntBe(4);
    this.noseScale = this._io.readBitsIntBe(4);
    this.noseY = this._io.readBitsIntBe(5);
    this.padding6 = this._io.readBitsIntBe(3);
    this.mouthType = this._io.readBitsIntBe(5);
    this.mouthColor = this._io.readBitsIntBe(2);
    this.mouthScale = this._io.readBitsIntBe(4);
    this.mouthY = this._io.readBitsIntBe(5);
    this.glassType = this._io.readBitsIntBe(4);
    this.glassColor = this._io.readBitsIntBe(3);
    this.glassScale = this._io.readBitsIntBe(4);
    this.glassY = this._io.readBitsIntBe(5);
    this.mustacheType = this._io.readBitsIntBe(2);
    this.beardType = this._io.readBitsIntBe(2);
    this.beardColor = this._io.readBitsIntBe(3);
    this.beardScale = this._io.readBitsIntBe(4);
    this.beardY = this._io.readBitsIntBe(5);
    this.moleType = this._io.readBitsIntBe(1) != 0;
    this.moleScale = this._io.readBitsIntBe(4);
    this.moleY = this._io.readBitsIntBe(5);
    this.moleX = this._io.readBitsIntBe(5);
    this.padding8 = this._io.readBitsIntBe(1) != 0;
    this._io.alignToByte();
    if (!(this._io.isEof())) {
      this.creatorName = globalThis['KaitaiStream']['bytesToStr'](this._io.readBytes(20), "UTF-16BE");
    }
    if (!(this._io.isEof())) {
      this.crc = this._io.readU2be();
    }
  }

  var CreateId = RflStoreData.CreateId = (function() {
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
      this.addrLow = [];
      for (var i = 0; i < 4; i++) {
        this.addrLow.push(this._io.readU1());
      }
    }

    /**
     * Creation date as a Unix timestamp.
     * TODO Unknown if this is accurate
     */
    Object.defineProperty(CreateId.prototype, 'createDateTimestamp', {
      get: function() {
        if (this._m_createDateTimestamp !== undefined)
          return this._m_createDateTimestamp;
        this._m_createDateTimestamp = this.createDateOffset * 4 + 1136073600;
        return this._m_createDateTimestamp;
      }
    });
    Object.defineProperty(CreateId.prototype, 'data', {
      get: function() {
        if (this._m_data !== undefined)
          return this._m_data;
        var _pos = this._io.pos;
        this._io.seek(24);
        this._m_data = [];
        for (var i = 0; i < 8; i++) {
          this._m_data.push(this._io.readU1());
        }
        this._io.seek(_pos);
        return this._m_data;
      }
    });

    /**
     * On Wii and DS, this contains the last 3 bytes
     * of the MAC address, with the first byte being a
     * checksum over the first 3 bytes, calculated (in JS) like:
     * `macAddressUint8Array.slice(0, 3).reduce((sum, b) => sum + b, 0) & 0x7F`
     * (Calculated in createLowAddr_ in RFL_Database.c)
     * NOTE: Completely unknown how it is calculated on DS.
     * 
     * In order for the Mii to be considered as created from the
     * same console on Wii (RFLiIsMyHomeID), the CreateID has to
     * be non-null, not from DS, and the MAC/sum has to match.
     */

    return CreateId;
  })();

  var CreateIdFlags = RflStoreData.CreateIdFlags = (function() {
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
     */

    /**
     * Cleared on Wii and 3DS, set on DS and Wii U.
     */

    /**
     * Given to random Miis and seen in some games' CPU Miis.
     * Its meaning is derived from how random Miis are obtained
     * from a database (RFLMiddleDBType_Random, FFLiDatabaseRandom)
     * that returns a random Mii on each index. So, every time you
     * fetch from the database, it creates a new random Mii, so the index
     * cannot be relied upon, and this also effectively prevents those
     * random Miis from being saved.
     * 
     * The functions FFLiIsValidMiiID(), CFLi_IsValidMiiID(),
     * nn::mii::detail::Ver3CreateId::IsValid()
     * all check against this bit - e.g. makes data INVALID.
     */

    /**
     * Cleared on Wii and DS, set on 3DS and Wii U.
     */

    return CreateIdFlags;
  })();
  Object.defineProperty(RflStoreData.prototype, 'facelineColor', {
    get: function() {
      if (this._m_facelineColor !== undefined)
        return this._m_facelineColor;
      this._m_facelineColor = this.faceColor;
      return this._m_facelineColor;
    }
  });
  Object.defineProperty(RflStoreData.prototype, 'facelineType', {
    get: function() {
      if (this._m_facelineType !== undefined)
        return this._m_facelineType;
      this._m_facelineType = this.faceType;
      return this._m_facelineType;
    }
  });
  Object.defineProperty(RflStoreData.prototype, 'facelineWrinkle', {
    get: function() {
      if (this._m_facelineWrinkle !== undefined)
        return this._m_facelineWrinkle;
      this._m_facelineWrinkle = this.faceTex;
      return this._m_facelineWrinkle;
    }
  });
  Object.defineProperty(RflStoreData.prototype, 'mustacheScale', {
    get: function() {
      if (this._m_mustacheScale !== undefined)
        return this._m_mustacheScale;
      this._m_mustacheScale = this.beardScale;
      return this._m_mustacheScale;
    }
  });
  Object.defineProperty(RflStoreData.prototype, 'mustacheY', {
    get: function() {
      if (this._m_mustacheY !== undefined)
        return this._m_mustacheY;
      this._m_mustacheY = this.beardY;
      return this._m_mustacheY;
    }
  });
  Object.defineProperty(RflStoreData.prototype, 'nickname', {
    get: function() {
      if (this._m_nickname !== undefined)
        return this._m_nickname;
      this._m_nickname = this.name;
      return this._m_nickname;
    }
  });

  /**
   * Originally named sex
   */

  /**
   * Originally named birth_month despite other fields using camelCase.
   */

  /**
   * Originally named birth_day despite other fields using camelCase.
   * 0 = not set. Counts from 1-31.
   * Consoles only let you set both fields, not just one.
   * Note that the maximum day per month is validated in
   * CFL (CFLi_GetMonthOfDay::monthOfDay) and
   * FFL (MONTH_OF_DAY, https://github.com/aboood40091/ffl/blob/master/src/FFLiDateTime.cpp#L47)
   */

  /**
   * Not null-terminated, contains 10 characters
   */

  /**
   * Set to 1 if downloaded from
   * Check Mii Out Channel. Enum is
   * deleted "RFLDataType" from RVLFaceLibraryAlpha3_0926
   */

  /**
   * Not null-terminated, contains 10 characters
   */

  /**
   * Additional in CFLiPackedMiiDataPacket.
   */

  return RflStoreData;
})();
RflStoreData_.RflStoreData = RflStoreData;
});
