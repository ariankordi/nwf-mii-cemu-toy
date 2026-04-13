// This is a generated file! Please edit source .ksy file and use kaitai-struct-compiler to rebuild

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['kaitai-struct/KaitaiStream'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('kaitai-struct/KaitaiStream'));
  } else {
    root.Gen1Wii = factory(root.KaitaiStream);
  }
}(typeof self !== 'undefined' ? self : this, function (KaitaiStream) {
var Gen1Wii = (function() {
  function Gen1Wii(_io, _parent, _root) {
    this._io = _io;
    this._parent = _parent;
    this._root = _root || this;

    this._read();
  }
  Gen1Wii.prototype._read = function() {
    this.invalid = this._io.readBitsIntBe(1) != 0;
    this.gender = this._io.readBitsIntBe(1) != 0;
    this.birthMonth = this._io.readBitsIntBe(4);
    this.birthDay = this._io.readBitsIntBe(5);
    this.favoriteColor = this._io.readBitsIntBe(4);
    this.favorite = this._io.readBitsIntBe(1) != 0;
    this._io.alignToByte();
    this.miiName = KaitaiStream.bytesToStr(this._io.readBytes(20), "utf-16be");
    this.bodyHeight = this._io.readU1();
    this.bodyWeight = this._io.readU1();
    this.avatarId = [];
    for (var i = 0; i < 4; i++) {
      this.avatarId.push(this._io.readU1());
    }
    this.clientId = [];
    for (var i = 0; i < 4; i++) {
      this.clientId.push(this._io.readU1());
    }
    this.faceType = this._io.readBitsIntBe(3);
    this.faceColor = this._io.readBitsIntBe(3);
    this.facialFeature = this._io.readBitsIntBe(4);
    this.unknown = this._io.readBitsIntBe(3);
    this.mingle = this._io.readBitsIntBe(1) != 0;
    this.unknown2 = this._io.readBitsIntBe(1) != 0;
    this.downloaded = this._io.readBitsIntBe(1) != 0;
    this.hairType = this._io.readBitsIntBe(7);
    this.hairColor = this._io.readBitsIntBe(3);
    this.hairFlip = this._io.readBitsIntBe(1) != 0;
    this.unknown3 = this._io.readBitsIntBe(5);
    this.eyebrowType = this._io.readBitsIntBe(5);
    this.unknown4 = this._io.readBitsIntBe(1) != 0;
    this.eyebrowRotation = this._io.readBitsIntBe(4);
    this.unknown5 = this._io.readBitsIntBe(6);
    this.eyebrowColor = this._io.readBitsIntBe(3);
    this.eyebrowSize = this._io.readBitsIntBe(4);
    this.eyebrowVertical = this._io.readBitsIntBe(5);
    this.eyebrowHorizontal = this._io.readBitsIntBe(4);
    this.eyeType = this._io.readBitsIntBe(6);
    this.unknown6 = this._io.readBitsIntBe(2);
    this.eyeRotation = this._io.readBitsIntBe(3);
    this.eyeVertical = this._io.readBitsIntBe(5);
    this.eyeColor = this._io.readBitsIntBe(3);
    this.unknown7 = this._io.readBitsIntBe(1) != 0;
    this.eyeSize = this._io.readBitsIntBe(3);
    this.eyeHorizontal = this._io.readBitsIntBe(4);
    this.unknown8 = this._io.readBitsIntBe(5);
    this.noseType = this._io.readBitsIntBe(4);
    this.noseSize = this._io.readBitsIntBe(4);
    this.noseVertical = this._io.readBitsIntBe(5);
    this.unknown9 = this._io.readBitsIntBe(3);
    this.mouthType = this._io.readBitsIntBe(5);
    this.mouthColor = this._io.readBitsIntBe(2);
    this.mouthSize = this._io.readBitsIntBe(4);
    this.mouthVertical = this._io.readBitsIntBe(5);
    this.glassesType = this._io.readBitsIntBe(4);
    this.glassesColor = this._io.readBitsIntBe(3);
    this.unknown10 = this._io.readBitsIntBe(1) != 0;
    this.glassesSize = this._io.readBitsIntBe(3);
    this.glassesVertical = this._io.readBitsIntBe(5);
    this.facialHairMustache = this._io.readBitsIntBe(2);
    this.facialHairBeard = this._io.readBitsIntBe(2);
    this.facialHairColor = this._io.readBitsIntBe(3);
    this.facialHairSize = this._io.readBitsIntBe(4);
    this.facialHairVertical = this._io.readBitsIntBe(5);
    this.moleEnable = this._io.readBitsIntBe(1) != 0;
    this.moleSize = this._io.readBitsIntBe(4);
    this.moleVertical = this._io.readBitsIntBe(5);
    this.moleHorizontal = this._io.readBitsIntBe(5);
    this.unknown11 = this._io.readBitsIntBe(1) != 0;
    this._io.alignToByte();
    this.creatorName = KaitaiStream.bytesToStr(this._io.readBytes(20), "utf-16be");
  }

  return Gen1Wii;
})();
return Gen1Wii;
}));
