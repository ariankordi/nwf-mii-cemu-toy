// This is a generated file! Please edit source .ksy file and use kaitai-struct-compiler to rebuild

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['exports', 'kaitai-struct/KaitaiStream'], factory);
  } else if (typeof exports === 'object' && exports !== null && typeof exports.nodeType !== 'number') {
    factory(exports, require('kaitai-struct/KaitaiStream'));
  } else {
    factory(root.NxStoreData || (root.NxStoreData = {}), root.KaitaiStream);
  }
})(typeof self !== 'undefined' ? self : this, function (NxStoreData_, KaitaiStream) {
var NxStoreData = (function() {
  NxStoreData.FavoriteColor = Object.freeze({
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

  NxStoreData.FontRegion = Object.freeze({
    JP_US_EU: 0,
    CHINA: 1,
    KOREA: 2,
    TAIWAN: 3,

    0: "JP_US_EU",
    1: "CHINA",
    2: "KOREA",
    3: "TAIWAN",
  });

  NxStoreData.Gender = Object.freeze({
    MALE: 0,
    FEMALE: 1,
    ALL: 2,

    0: "MALE",
    1: "FEMALE",
    2: "ALL",
  });

  NxStoreData.RegionMove = Object.freeze({
    ALL: 0,
    JP_ONLY: 1,
    US_ONLY: 2,
    EU_ONLY: 3,

    0: "ALL",
    1: "JP_ONLY",
    2: "US_ONLY",
    3: "EU_ONLY",
  });

  NxStoreData.Type = Object.freeze({
    NORMAL: 0,
    SPECIAL: 1,

    0: "NORMAL",
    1: "SPECIAL",
  });

  function NxStoreData(_io, _parent, _root) {
    this._io = _io;
    this._parent = _parent;
    this._root = _root || this;

    this._read();
  }
  NxStoreData.prototype._read = function() {
    this.hairType = this._io.readU1();
    this.height = this._io.readBitsIntLe(7);
    this.moleType = this._io.readBitsIntLe(1) != 0;
    this.build = this._io.readBitsIntLe(7);
    this.hairFlip = this._io.readBitsIntLe(1) != 0;
    this.hairColor = this._io.readBitsIntLe(7);
    this.type = this._io.readBitsIntLe(1) != 0;
    this.eyeColor = this._io.readBitsIntLe(7);
    this.gender = this._io.readBitsIntLe(1) != 0;
    this.eyebrowColor = this._io.readBitsIntLe(7);
    this.pad0 = this._io.readBitsIntLe(1) != 0;
    this.mouthColor = this._io.readBitsIntLe(7);
    this.pad1 = this._io.readBitsIntLe(1) != 0;
    this.beardColor = this._io.readBitsIntLe(7);
    this.pad2 = this._io.readBitsIntLe(1) != 0;
    this.glassColor = this._io.readBitsIntLe(7);
    this.pad3 = this._io.readBitsIntLe(1) != 0;
    this.eyeType = this._io.readBitsIntLe(6);
    this.regionMove = this._io.readBitsIntLe(2);
    this.mouthType = this._io.readBitsIntLe(6);
    this.fontRegion = this._io.readBitsIntLe(2);
    this.eyeY = this._io.readBitsIntLe(5);
    this.glassScale = this._io.readBitsIntLe(3);
    this.eyebrowType = this._io.readBitsIntLe(5);
    this.mustacheType = this._io.readBitsIntLe(3);
    this.noseType = this._io.readBitsIntLe(5);
    this.beardType = this._io.readBitsIntLe(3);
    this.noseY = this._io.readBitsIntLe(5);
    this.mouthAspect = this._io.readBitsIntLe(3);
    this.mouthY = this._io.readBitsIntLe(5);
    this.eyebrowAspect = this._io.readBitsIntLe(3);
    this.mustacheY = this._io.readBitsIntLe(5);
    this.eyeRotate = this._io.readBitsIntLe(3);
    this.glassY = this._io.readBitsIntLe(5);
    this.eyeAspect = this._io.readBitsIntLe(3);
    this.moleX = this._io.readBitsIntLe(5);
    this.eyeScale = this._io.readBitsIntLe(3);
    this.moleY = this._io.readBitsIntLe(5);
    this.pad4 = this._io.readBitsIntLe(3);
    this.glassType = this._io.readBitsIntLe(5);
    this.pad5 = this._io.readBitsIntLe(3);
    this.favoriteColor = this._io.readBitsIntLe(4);
    this.facelineType = this._io.readBitsIntLe(4);
    this.facelineColor = this._io.readBitsIntLe(4);
    this.facelineWrinkle = this._io.readBitsIntLe(4);
    this.facelineMake = this._io.readBitsIntLe(4);
    this.eyeX = this._io.readBitsIntLe(4);
    this.eyebrowScale = this._io.readBitsIntLe(4);
    this.eyebrowRotate = this._io.readBitsIntLe(4);
    this.eyebrowX = this._io.readBitsIntLe(4);
    this.eyebrowY = this._io.readBitsIntLe(4);
    this.noseScale = this._io.readBitsIntLe(4);
    this.mouthScale = this._io.readBitsIntLe(4);
    this.mustacheScale = this._io.readBitsIntLe(4);
    this.moleScale = this._io.readBitsIntLe(4);
    this._io.alignToByte();
    if (!(this._io.isEof())) {
      this.nickname = globalThis['KaitaiStream']['bytesToStr'](this._io.readBytes(20), "UTF-16LE");
    }
    if (!(this._io.isEof())) {
      this.createId = new CreateId(this._io, this, this._root);
    }
    if (!(this._io.isEof())) {
      this.crc16 = this._io.readU2le();
    }
    if (!(this._io.isEof())) {
      this.crc16Device = this._io.readU2le();
    }
  }

  var CreateId = NxStoreData.CreateId = (function() {
    function CreateId(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root;

      this._read();
    }
    CreateId.prototype._read = function() {
      this.data = [];
      for (var i = 0; i < 16; i++) {
        this.data.push(this._io.readU1());
      }
    }

    /**
     * Checks the two leftmost bits of byte 8 ("clock_seq_hi_and_reserved" field in RFC 4122)
     * that are verified by nn::mii::CreateId::IsValid().
     * If this is false, this Mii will not be valid on a real Switch.
     */
    Object.defineProperty(CreateId.prototype, 'isValid', {
      get: function() {
        if (this._m_isValid !== undefined)
          return this._m_isValid;
        this._m_isValid = (this.data[8] & 192) == 128;
        return this._m_isValid;
      }
    });

    /**
     * This is struct nn::mii::CreateId, which contains nn::util::Uuid (UUIDv4)
     * generated by: struct nn::util::Uuid __cdecl nn::util::`anonymous namespace'::GenerateUuidVersion4(void)
     * NOTE that this cannot just be completely random in order to be valid (see is_valid)
     * To make a valid CreateID, set the following: `data[8] &= 0x3f; data[8] |= 0x80;`
     * Optionally to be a valid UUIDv4 as well: `data[6] &= & 0x0f; data[6] |= 0x40;`
     */

    return CreateId;
  })();
  Object.defineProperty(NxStoreData.prototype, 'beardScale', {
    get: function() {
      if (this._m_beardScale !== undefined)
        return this._m_beardScale;
      this._m_beardScale = this.mustacheScale;
      return this._m_beardScale;
    }
  });
  Object.defineProperty(NxStoreData.prototype, 'beardY', {
    get: function() {
      if (this._m_beardY !== undefined)
        return this._m_beardY;
      this._m_beardY = this.mustacheY;
      return this._m_beardY;
    }
  });
  Object.defineProperty(NxStoreData.prototype, 'faceColor', {
    get: function() {
      if (this._m_faceColor !== undefined)
        return this._m_faceColor;
      this._m_faceColor = this.facelineColor;
      return this._m_faceColor;
    }
  });
  Object.defineProperty(NxStoreData.prototype, 'faceTex', {
    get: function() {
      if (this._m_faceTex !== undefined)
        return this._m_faceTex;
      this._m_faceTex = this.facelineWrinkle;
      return this._m_faceTex;
    }
  });
  Object.defineProperty(NxStoreData.prototype, 'faceType', {
    get: function() {
      if (this._m_faceType !== undefined)
        return this._m_faceType;
      this._m_faceType = this.facelineType;
      return this._m_faceType;
    }
  });
  Object.defineProperty(NxStoreData.prototype, 'name', {
    get: function() {
      if (this._m_name !== undefined)
        return this._m_name;
      this._m_name = this.nickname;
      return this._m_name;
    }
  });

  /**
   * Value + 3 = true value.
   */

  /**
   * Does not contain a null terminator at the end.
   * NOTE that in order for this to be valid,
   * it CANNOT contain any characters after the first
   * null terminator character. (nn::mii::Nickname::IsValid() -> IsContinuityTermination(unsigned short const *, int))
   */

  return NxStoreData;
})();
NxStoreData_.NxStoreData = NxStoreData;
});
