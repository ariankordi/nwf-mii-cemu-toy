// This is a generated file! Please edit source .ksy file and use kaitai-struct-compiler to rebuild

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['kaitai-struct/KaitaiStream'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('kaitai-struct/KaitaiStream'));
  } else {
    root.Gen3Switchgame = factory(root.KaitaiStream);
  }
}(typeof self !== 'undefined' ? self : this, function (KaitaiStream) {
var Gen3Switchgame = (function() {
  function Gen3Switchgame(_io, _parent, _root) {
    this._io = _io;
    this._parent = _parent;
    this._root = _root || this;

    this._read();
  }
  Gen3Switchgame.prototype._read = function() {
    this.unknownData = [];
    for (var i = 0; i < 16; i++) {
      this.unknownData.push(this._io.readU1());
    }
    this.miiName = KaitaiStream.bytesToStr(this._io.readBytes(20), "utf-16le");
    this.unknownBuffer = [];
    for (var i = 0; i < 3; i++) {
      this.unknownBuffer.push(this._io.readU1());
    }
    this.favoriteColor = this._io.readU1();
    this.gender = this._io.readU1();
    this.bodyHeight = this._io.readU1();
    this.bodyWeight = this._io.readU1();
    this.unknownBuffer2 = [];
    for (var i = 0; i < 2; i++) {
      this.unknownBuffer2.push(this._io.readU1());
    }
    this.faceType = this._io.readU1();
    this.faceColor = this._io.readU1();
    this.faceWrinkles = this._io.readU1();
    this.faceMakeup = this._io.readU1();
    this.hairType = this._io.readU1();
    this.hairColor = this._io.readU1();
    this.hairFlip = this._io.readU1();
    this.eyeType = this._io.readU1();
    this.eyeColor = this._io.readU1();
    this.eyeSize = this._io.readU1();
    this.eyeStretch = this._io.readU1();
    this.eyeRotation = this._io.readU1();
    this.eyeHorizontal = this._io.readU1();
    this.eyeVertical = this._io.readU1();
    this.eyebrowType = this._io.readU1();
    this.eyebrowColor = this._io.readU1();
    this.eyebrowSize = this._io.readU1();
    this.eyebrowStretch = this._io.readU1();
    this.eyebrowRotation = this._io.readU1();
    this.eyebrowHorizontal = this._io.readU1();
    this.eyebrowVertical = this._io.readU1();
    this.noseType = this._io.readU1();
    this.noseSize = this._io.readU1();
    this.noseVertical = this._io.readU1();
    this.mouthType = this._io.readU1();
    this.mouthColor = this._io.readU1();
    this.mouthSize = this._io.readU1();
    this.mouthStretch = this._io.readU1();
    this.mouthVertical = this._io.readU1();
    this.facialHairColor = this._io.readU1();
    this.facialHairBeard = this._io.readU1();
    this.facialHairMustache = this._io.readU1();
    this.facialHairSize = this._io.readU1();
    this.facialHairVertical = this._io.readU1();
    this.glassesType = this._io.readU1();
    this.glassesColor = this._io.readU1();
    this.glassesSize = this._io.readU1();
    this.glassesVertical = this._io.readU1();
    this.moleEnable = this._io.readU1();
    this.moleSize = this._io.readU1();
    this.moleHorizontal = this._io.readU1();
    this.moleVertical = this._io.readU1();
    this.unknownBuffer3 = [];
    for (var i = 0; i < 1; i++) {
      this.unknownBuffer3.push(this._io.readU1());
    }
  }

  /**
   * Currently unknown data.
   */

  /**
   * Mii name. Can be up to 10 characters long. Different from the Mii name that appears in Smash - in game, this is never seen.
   */

  /**
   * Currently unknown data - likely a 00 buffer between the name and misc. info and the rest of the Mii data.
   */

  /**
   * Favorite color. Ranges from 0 to 11.
   */

  /**
   * Mii gender. 0 = male, 1 = female.
   */

  /**
   * Body height. Ranges from 0 to 127, short to tall.
   */

  /**
   * Body weight. Ranges from 0 to 127, small to large.
   */

  /**
   * Currently unknown data - likely a 00 buffer between the Mii body data and the Mii face data.
   */

  /**
   * Face shape. Ranges from 0 to 11. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{face}.
   */

  /**
   * Skin color. Ranges from 0 to 9. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{skin}.
   */

  /**
   * Face wrinkles. Ranges from 0 to 11.
   */

  /**
   * Face makeup. Ranges from 0 to 11.
   */

  /**
   * Hair type. Ranges from 0 to 131. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{hair}.
   */

  /**
   * Hair color. Ranges from 0 to 99. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{hair-color} for default colors and /maps.txt/{colors} for custom colors.
   */

  /**
   * Flip hair. 0 = no, 1 = yes.
   */

  /**
   * Eye type. Ranges from 0 to 59. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{eyes}.
   */

  /**
   * Eye color. Ranges from 0 to 99. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{eye-color} for default colors and /maps.txt/{colors} for custom colors.
   */

  /**
   * Eye size. Ranges from 0 to 7, small to large.
   */

  /**
   * Eye stretch. Ranges from 0 to 6, small to large.
   */

  /**
   * Eye rotation. Ranges from 0 to 7, down to up. Note that some eye types have a default rotation. You can find more specifics at /rotation.txt/{eyes}.
   */

  /**
   * Eye X (horizontal) distance. Ranges from 0 to 12, close to far.
   */

  /**
   * Eye Y (vertical) position. Ranges from 18 to 0, low to high.
   */

  /**
   * Eyebrow type. Ranges from 0 to 23. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{eyebrows}.
   */

  /**
   * Eyebrow color. Ranges from 0 to 99. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{hair-color} for default colors and /maps.txt/{colors} for custom colors.
   */

  /**
   * Eyebrow size. Ranges from 0 to 8, small to large.
   */

  /**
   * Eyebrow stretch. Ranges from 0 to 6, small to large.
   */

  /**
   * Eyebrow rotation. Ranges from 0 to 11, down to up. Note that some eyebrow types have a default rotation. You can find more specifics at /rotation.txt/{eyebrows}.
   */

  /**
   * Eyebrow X (horizontal) distance. Ranges from 0 to 12, close to far.
   */

  /**
   * Eyebrow Y (vertical) distance. Ranges from 18 to 3, low to high.
   */

  /**
   * Nose type. Ranges from 0 to 17. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{nose}.
   */

  /**
   * Nose size. Ranges from 0 to 8, small to large.
   */

  /**
   * Nose Y (vertical) position. Ranges from 18 to 0, low to high.
   */

  /**
   * Mouth type. Ranges from 0 to 35. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{mouth}.
   */

  /**
   * Mouth color. The default colors are ordered the same as visible in editor, ranging from 19 to 23. The custom colors are not and range from 0 to 99. A map of the internal values in correlation to the Mii editor is at /maps.txt/{colors} for custom colors.
   */

  /**
   * Mouth size. Ranges from 0 to 8, small to large.
   */

  /**
   * Mouth stretch. Ranges from 0 to 6, small to large.
   */

  /**
   * Mouth Y (vertical) position. Ranges from 18 to 0, low to high.
   */

  /**
   * Facial hair color. Ranges from 0 to 99. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{hair-color} for default colors and /maps.txt/{colors} for custom colors.
   */

  /**
   * Beard type. Ranges from 0 to 5.
   */

  /**
   * Mustache type. Ranges from 0 to 5.
   */

  /**
   * Mustache size. Ranges from 0 to 8, small to large.
   */

  /**
   * Mustache Y (vertical) position. Ranges from 16 to 0, low to high.
   */

  /**
   * Glasses type. Ranges from 0 to 19. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{glasses}.
   */

  /**
   * Glasses color. Ranges from 0 to 99. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{glasses-color} for default colors and /maps.txt/{colors} for custom colors.
   */

  /**
   * Glasses size. Ranges from 0 to 7, small to large.
   */

  /**
   * Glasses Y (vertical) position. Ranges from 20 to 0, low to high.
   */

  /**
   * Enable mole. 0 = no, 1 = yes.
   */

  /**
   * Mole size. Ranges from 0 to 8, small to large.
   */

  /**
   * Mole X (horizontal) position. Ranges from 0 to 16, left to right.
   */

  /**
   * Mole Y (vertical) position. Ranges from 30 to 0, low to high.
   */

  /**
   * Currently unknown data - likely a 00 buffer between the Mii data and the Smash Ultimate data.
   */

  return Gen3Switchgame;
})();
return Gen3Switchgame;
}));
