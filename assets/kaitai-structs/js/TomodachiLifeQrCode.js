// This is a generated file! Please edit source .ksy file and use kaitai-struct-compiler to rebuild

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['kaitai-struct/KaitaiStream'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('kaitai-struct/KaitaiStream'));
  } else {
    root.TomodachiLifeQrCode = factory(root.KaitaiStream);
  }
}(typeof self !== 'undefined' ? self : this, function (KaitaiStream) {
var TomodachiLifeQrCode = (function() {
  function TomodachiLifeQrCode(_io, _parent, _root) {
    this._io = _io;
    this._parent = _parent;
    this._root = _root || this;

    this._read();
  }
  TomodachiLifeQrCode.prototype._read = function() {
    this.firstName = KaitaiStream.bytesToStr(this._io.readBytes(32), "UTF-16LE");
    this.lastName = KaitaiStream.bytesToStr(this._io.readBytes(32), "UTF-16LE");
    this.unknown = [];
    for (var i = 0; i < 3; i++) {
      this.unknown.push(this._io.readU1());
    }
    this.hairDyeEnable = this._io.readBitsIntBe(1) != 0;
    this.unknownb1 = this._io.readBitsIntBe(1) != 0;
    this.hairDye = this._io.readBitsIntBe(5);
    this.unknownb2 = this._io.readBitsIntBe(1) != 0;
    this._io.alignToByte();
    this.unknown2 = [];
    for (var i = 0; i < 12; i++) {
      this.unknown2.push(this._io.readU1());
    }
    this.catchphrase = KaitaiStream.bytesToStr(this._io.readBytes(32), "UTF-16LE");
    this.unknown3 = [];
    for (var i = 0; i < 58; i++) {
      this.unknown3.push(this._io.readU1());
    }
    this.voicePitch = this._io.readU1();
    this.voiceSpeed = this._io.readU1();
    this.voiceQuality = this._io.readU1();
    this.voiceTone = this._io.readU1();
    this.voiceAccent = this._io.readU1();
    this.voiceInotation = this._io.readU1();
    this.characterMovement = this._io.readU1();
    this.characterSpeech = this._io.readU1();
    this.characterExpressiveness = this._io.readU1();
    this.characterAttitude = this._io.readU1();
    this.characterOverall = this._io.readU1();
    this.unknown4 = [];
    for (var i = 0; i < 35; i++) {
      this.unknown4.push(this._io.readU1());
    }
    this.islandName = KaitaiStream.bytesToStr(this._io.readBytes(20), "UTF-16LE");
  }

  return TomodachiLifeQrCode;
})();
return TomodachiLifeQrCode;
}));
