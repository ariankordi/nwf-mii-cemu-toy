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
  TomodachiLifeQrCode.HairDyeMode = Object.freeze({
    OFF: 0,
    HAIR_ONLY: 1,
    HAIR_EYEBROWS: 2,

    0: "OFF",
    1: "HAIR_ONLY",
    2: "HAIR_EYEBROWS",
  });

  function TomodachiLifeQrCode(_io, _parent, _root) {
    this._io = _io;
    this._parent = _parent;
    this._root = _root || this;

    this._read();
  }
  TomodachiLifeQrCode.prototype._read = function() {
    this.firstName = globalThis['KaitaiStream']['bytesToStr'](this._io.readBytes(32), "UTF-16LE");
    this.lastName = globalThis['KaitaiStream']['bytesToStr'](this._io.readBytes(32), "UTF-16LE");
    this.unknownBirthdayAge = this._io.readBytes(3);
    this.hairDyeMode = this._io.readBitsIntBe(2);
    this.hairDye = this._io.readBitsIntBe(5);
    this.unknownb2 = this._io.readBitsIntBe(1) != 0;
    this._io.alignToByte();
    this.unknown2 = this._io.readBytes(12);
    this.catchphrase = globalThis['KaitaiStream']['bytesToStr'](this._io.readBytes(32), "UTF-16LE");
    this.unknown3Clothing = this._io.readBytes(8);
    this.islandId1 = new IslandId(this._io, this, this._root);
    this.islandId2 = new IslandId(this._io, this, this._root);
    this.miiAuthorId = [];
    for (var i = 0; i < 8; i++) {
      this.miiAuthorId.push(this._io.readU1());
    }
    this.miiCreateId = [];
    for (var i = 0; i < 10; i++) {
      this.miiCreateId.push(this._io.readU1());
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
    this.unknown5 = this._io.readBytes(19);
    this.islandId3 = new IslandId(this._io, this, this._root);
    this.islandName = globalThis['KaitaiStream']['bytesToStr'](this._io.readBytes(18), "UTF-16LE");
    this.unknown6 = this._io.readBytes(6);
  }

  var IslandId = TomodachiLifeQrCode.IslandId = (function() {
    function IslandId(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root || this;

      this._read();
    }
    IslandId.prototype._read = function() {
      this.data = this._io.readBytes(16);
    }

    return IslandId;
  })();

  /**
   * contains birthday and Kid/Grown-Up flag
   */

  /**
   * always begins with 00000000, effectively 8 bytes
   * changing doesnt affect appearance on scan
   */

  /**
   * indices for clothing, headwear, room are stored here
   */

  /**
   * game is using this to identify miis, so if you replace it with
   * one from an islander already present it will prompt to replace
   * if you say yes it'll replace mii and voice/character param etc
   * but clothing, relationship, item owned data is left unchanged
   */

  /**
   * ends with constant "7600FEFF0F20FFFF0F" (undefined)?
   * effectively 10 bytes. changing doesnt affect appearance on scan
   */

  /**
   * constant "AC44094C00"? may be for region/version idk
   */

  return TomodachiLifeQrCode;
})();
return TomodachiLifeQrCode;
}));
