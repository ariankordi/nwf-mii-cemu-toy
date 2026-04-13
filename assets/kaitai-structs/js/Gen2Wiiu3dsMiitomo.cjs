// This is a generated file! Please edit source .ksy file and use kaitai-struct-compiler to rebuild

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['kaitai-struct/KaitaiStream'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('kaitai-struct/KaitaiStream'));
  } else {
    root.Gen2Wiiu3dsMiitomo = factory(root.KaitaiStream);
  }
}(typeof self !== 'undefined' ? self : this, function (KaitaiStream) {
var Gen2Wiiu3dsMiitomo = (function() {
  function Gen2Wiiu3dsMiitomo(_io, _parent, _root) {
    this._io = _io;
    this._parent = _parent;
    this._root = _root || this;

    this._read();
  }
  Gen2Wiiu3dsMiitomo.prototype._read = function() {
    this.unknown1 = this._io.readU1();
    this.characterSet = this._io.readBitsIntBe(2);
    this.regionLock = this._io.readBitsIntBe(2);
    this.profanityFlag = this._io.readBitsIntBe(1) != 0;
    this.copying = this._io.readBitsIntBe(1) != 0;
    this.unknown2 = this._io.readBitsIntBe(2);
    this.miiPositionSlotIndex = this._io.readBitsIntBe(4);
    this.miiPositionPageIndex = this._io.readBitsIntBe(4);
    this.version = this._io.readBitsIntBe(4);
    this.unknown3 = this._io.readBitsIntBe(4);
    this._io.alignToByte();
    this.systemId = [];
    for (var i = 0; i < 8; i++) {
      this.systemId.push(this._io.readU1());
    }
    this.avatarId = [];
    for (var i = 0; i < 4; i++) {
      this.avatarId.push(this._io.readU1());
    }
    this.clientId = [];
    for (var i = 0; i < 6; i++) {
      this.clientId.push(this._io.readU1());
    }
    this.padding = this._io.readU2le();
    this.data1 = this._io.readU2le();
    this.miiName = KaitaiStream.bytesToStr(this._io.readBytes(20), "utf-16le");
    this.bodyHeight = this._io.readU1();
    this.bodyWeight = this._io.readU1();
    this.faceColor = this._io.readBitsIntBe(3);
    this.faceType = this._io.readBitsIntBe(4);
    this.mingle = this._io.readBitsIntBe(1) != 0;
    this.faceMakeup = this._io.readBitsIntBe(4);
    this.faceWrinkles = this._io.readBitsIntBe(4);
    this._io.alignToByte();
    this.hairType = this._io.readU1();
    this.unknown5 = this._io.readBitsIntBe(4);
    this.hairFlip = this._io.readBitsIntBe(1) != 0;
    this.hairColor = this._io.readBitsIntBe(3);
    this._io.alignToByte();
    this.eye = this._io.readU4le();
    this.eyebrow = this._io.readU4le();
    this.nose = this._io.readU2le();
    this.mouth = this._io.readU2le();
    this.mouth2 = this._io.readU2le();
    this.beard = this._io.readU2le();
    this.glasses = this._io.readU2le();
    this.mole = this._io.readU2le();
    this.creatorName = KaitaiStream.bytesToStr(this._io.readBytes(20), "utf-16le");
    this.padding2 = this._io.readU2le();
    this.checksum = this._io.readU2le();
  }
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'glassesColor', {
    get: function() {
      if (this._m_glassesColor !== undefined)
        return this._m_glassesColor;
      this._m_glassesColor = ((this.glasses >>> 4) & 7);
      return this._m_glassesColor;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'eyebrowHorizontal', {
    get: function() {
      if (this._m_eyebrowHorizontal !== undefined)
        return this._m_eyebrowHorizontal;
      this._m_eyebrowHorizontal = ((this.eyebrow >>> 21) & 15);
      return this._m_eyebrowHorizontal;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'eyeVertical', {
    get: function() {
      if (this._m_eyeVertical !== undefined)
        return this._m_eyeVertical;
      this._m_eyeVertical = ((this.eye >>> 25) & 31);
      return this._m_eyeVertical;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'facialHairBeard', {
    get: function() {
      if (this._m_facialHairBeard !== undefined)
        return this._m_facialHairBeard;
      this._m_facialHairBeard = (this.beard & 7);
      return this._m_facialHairBeard;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'mouthSize', {
    get: function() {
      if (this._m_mouthSize !== undefined)
        return this._m_mouthSize;
      this._m_mouthSize = ((this.mouth >>> 9) & 15);
      return this._m_mouthSize;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'eyebrowStretch', {
    get: function() {
      if (this._m_eyebrowStretch !== undefined)
        return this._m_eyebrowStretch;
      this._m_eyebrowStretch = ((this.eyebrow >>> 12) & 7);
      return this._m_eyebrowStretch;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'noseVertical', {
    get: function() {
      if (this._m_noseVertical !== undefined)
        return this._m_noseVertical;
      this._m_noseVertical = ((this.nose >>> 9) & 31);
      return this._m_noseVertical;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'eyeColor', {
    get: function() {
      if (this._m_eyeColor !== undefined)
        return this._m_eyeColor;
      this._m_eyeColor = ((this.eye >>> 6) & 7);
      return this._m_eyeColor;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'birthMonth', {
    get: function() {
      if (this._m_birthMonth !== undefined)
        return this._m_birthMonth;
      this._m_birthMonth = ((this.data1 >>> 1) & 15);
      return this._m_birthMonth;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'mouthColor', {
    get: function() {
      if (this._m_mouthColor !== undefined)
        return this._m_mouthColor;
      this._m_mouthColor = ((this.mouth >>> 6) & 7);
      return this._m_mouthColor;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'moleHorizontal', {
    get: function() {
      if (this._m_moleHorizontal !== undefined)
        return this._m_moleHorizontal;
      this._m_moleHorizontal = ((this.mole >>> 5) & 31);
      return this._m_moleHorizontal;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'facialHairMustache', {
    get: function() {
      if (this._m_facialHairMustache !== undefined)
        return this._m_facialHairMustache;
      this._m_facialHairMustache = ((this.mouth2 >>> 5) & 7);
      return this._m_facialHairMustache;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'eyebrowRotation', {
    get: function() {
      if (this._m_eyebrowRotation !== undefined)
        return this._m_eyebrowRotation;
      this._m_eyebrowRotation = ((this.eyebrow >>> 16) & 15);
      return this._m_eyebrowRotation;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'moleVertical', {
    get: function() {
      if (this._m_moleVertical !== undefined)
        return this._m_moleVertical;
      this._m_moleVertical = ((this.mole >>> 10) & 31);
      return this._m_moleVertical;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'glassesType', {
    get: function() {
      if (this._m_glassesType !== undefined)
        return this._m_glassesType;
      this._m_glassesType = (this.glasses & 15);
      return this._m_glassesType;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'eyebrowSize', {
    get: function() {
      if (this._m_eyebrowSize !== undefined)
        return this._m_eyebrowSize;
      this._m_eyebrowSize = ((this.eyebrow >>> 8) & 15);
      return this._m_eyebrowSize;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'moleSize', {
    get: function() {
      if (this._m_moleSize !== undefined)
        return this._m_moleSize;
      this._m_moleSize = ((this.mole >>> 1) & 15);
      return this._m_moleSize;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'noseSize', {
    get: function() {
      if (this._m_noseSize !== undefined)
        return this._m_noseSize;
      this._m_noseSize = ((this.nose >>> 5) & 15);
      return this._m_noseSize;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'facialHairVertical', {
    get: function() {
      if (this._m_facialHairVertical !== undefined)
        return this._m_facialHairVertical;
      this._m_facialHairVertical = ((this.beard >>> 10) & 31);
      return this._m_facialHairVertical;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'eyeStretch', {
    get: function() {
      if (this._m_eyeStretch !== undefined)
        return this._m_eyeStretch;
      this._m_eyeStretch = ((this.eye >>> 13) & 7);
      return this._m_eyeStretch;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'eyeSize', {
    get: function() {
      if (this._m_eyeSize !== undefined)
        return this._m_eyeSize;
      this._m_eyeSize = ((this.eye >>> 9) & 7);
      return this._m_eyeSize;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'eyeType', {
    get: function() {
      if (this._m_eyeType !== undefined)
        return this._m_eyeType;
      this._m_eyeType = (this.eye & 63);
      return this._m_eyeType;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'eyeHorizontal', {
    get: function() {
      if (this._m_eyeHorizontal !== undefined)
        return this._m_eyeHorizontal;
      this._m_eyeHorizontal = ((this.eye >>> 21) & 15);
      return this._m_eyeHorizontal;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'eyebrowType', {
    get: function() {
      if (this._m_eyebrowType !== undefined)
        return this._m_eyebrowType;
      this._m_eyebrowType = (this.eyebrow & 31);
      return this._m_eyebrowType;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'mouthVertical', {
    get: function() {
      if (this._m_mouthVertical !== undefined)
        return this._m_mouthVertical;
      this._m_mouthVertical = (this.mouth2 & 31);
      return this._m_mouthVertical;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'eyebrowColor', {
    get: function() {
      if (this._m_eyebrowColor !== undefined)
        return this._m_eyebrowColor;
      this._m_eyebrowColor = ((this.eyebrow >>> 5) & 7);
      return this._m_eyebrowColor;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'noseType', {
    get: function() {
      if (this._m_noseType !== undefined)
        return this._m_noseType;
      this._m_noseType = (this.nose & 31);
      return this._m_noseType;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'facialHairColor', {
    get: function() {
      if (this._m_facialHairColor !== undefined)
        return this._m_facialHairColor;
      this._m_facialHairColor = ((this.beard >>> 3) & 7);
      return this._m_facialHairColor;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'eyebrowVertical', {
    get: function() {
      if (this._m_eyebrowVertical !== undefined)
        return this._m_eyebrowVertical;
      this._m_eyebrowVertical = ((this.eyebrow >>> 25) & 31);
      return this._m_eyebrowVertical;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'glassesSize', {
    get: function() {
      if (this._m_glassesSize !== undefined)
        return this._m_glassesSize;
      this._m_glassesSize = ((this.glasses >>> 7) & 15);
      return this._m_glassesSize;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'eyeRotation', {
    get: function() {
      if (this._m_eyeRotation !== undefined)
        return this._m_eyeRotation;
      this._m_eyeRotation = ((this.eye >>> 16) & 31);
      return this._m_eyeRotation;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'gender', {
    get: function() {
      if (this._m_gender !== undefined)
        return this._m_gender;
      this._m_gender = (this.data1 & 1);
      return this._m_gender;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'birthDay', {
    get: function() {
      if (this._m_birthDay !== undefined)
        return this._m_birthDay;
      this._m_birthDay = ((this.data1 >>> 5) & 31);
      return this._m_birthDay;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'mouthStretch', {
    get: function() {
      if (this._m_mouthStretch !== undefined)
        return this._m_mouthStretch;
      this._m_mouthStretch = ((this.mouth >>> 13) & 7);
      return this._m_mouthStretch;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'moleEnable', {
    get: function() {
      if (this._m_moleEnable !== undefined)
        return this._m_moleEnable;
      this._m_moleEnable = ((this.mole >>> 0) & 1);
      return this._m_moleEnable;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'favorite', {
    get: function() {
      if (this._m_favorite !== undefined)
        return this._m_favorite;
      this._m_favorite = ((this.data1 >>> 14) & 1);
      return this._m_favorite;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'glassesVertical', {
    get: function() {
      if (this._m_glassesVertical !== undefined)
        return this._m_glassesVertical;
      this._m_glassesVertical = ((this.glasses >>> 11) & 31);
      return this._m_glassesVertical;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'favoriteColor', {
    get: function() {
      if (this._m_favoriteColor !== undefined)
        return this._m_favoriteColor;
      this._m_favoriteColor = ((this.data1 >>> 10) & 15);
      return this._m_favoriteColor;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'mouthType', {
    get: function() {
      if (this._m_mouthType !== undefined)
        return this._m_mouthType;
      this._m_mouthType = (this.mouth & 63);
      return this._m_mouthType;
    }
  });
  Object.defineProperty(Gen2Wiiu3dsMiitomo.prototype, 'facialHairSize', {
    get: function() {
      if (this._m_facialHairSize !== undefined)
        return this._m_facialHairSize;
      this._m_facialHairSize = ((this.beard >>> 6) & 15);
      return this._m_facialHairSize;
    }
  });

  /**
   * Always 3?
   */

  /**
   * 0=JPN+USA+EUR, 1=CHN, 2=KOR, 3=TWN
   */

  /**
   * 0=no lock, 1=JPN, 2=USA, 3=EUR
   */

  return Gen2Wiiu3dsMiitomo;
})();
return Gen2Wiiu3dsMiitomo;
}));
