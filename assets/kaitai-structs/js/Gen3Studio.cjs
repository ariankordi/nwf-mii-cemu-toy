// This is a generated file! Please edit source .ksy file and use kaitai-struct-compiler to rebuild

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['kaitai-struct/KaitaiStream'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('kaitai-struct/KaitaiStream'));
  } else {
    root.Gen3Studio = factory(root.KaitaiStream);
  }
}(typeof self !== 'undefined' ? self : this, function (KaitaiStream) {
var Gen3Studio = (function() {
  function Gen3Studio(_io, _parent, _root) {
    this._io = _io;
    this._parent = _parent;
    this._root = _root || this;

    this._read();
  }
  Gen3Studio.prototype._read = function() {
    this.facialHairColor = this._io.readU1();
    this.beardGoatee = this._io.readU1();
    this.bodyWeight = this._io.readU1();
    this.eyeStretch = this._io.readU1();
    this.eyeColor = this._io.readU1();
    this.eyeRotation = this._io.readU1();
    this.eyeSize = this._io.readU1();
    this.eyeType = this._io.readU1();
    this.eyeHorizontal = this._io.readU1();
    this.eyeVertical = this._io.readU1();
    this.eyebrowStretch = this._io.readU1();
    this.eyebrowColor = this._io.readU1();
    this.eyebrowRotation = this._io.readU1();
    this.eyebrowSize = this._io.readU1();
    this.eyebrowType = this._io.readU1();
    this.eyebrowHorizontal = this._io.readU1();
    this.eyebrowVertical = this._io.readU1();
    this.faceColor = this._io.readU1();
    this.faceMakeup = this._io.readU1();
    this.faceType = this._io.readU1();
    this.faceWrinkles = this._io.readU1();
    this.favoriteColor = this._io.readU1();
    this.gender = this._io.readU1();
    this.glassesColor = this._io.readU1();
    this.glassesSize = this._io.readU1();
    this.glassesType = this._io.readU1();
    this.glassesVertical = this._io.readU1();
    this.hairColor = this._io.readU1();
    this.hairFlip = this._io.readU1();
    this.hairType = this._io.readU1();
    this.bodyHeight = this._io.readU1();
    this.moleSize = this._io.readU1();
    this.moleEnable = this._io.readU1();
    this.moleHorizontal = this._io.readU1();
    this.moleVertical = this._io.readU1();
    this.mouthStretch = this._io.readU1();
    this.mouthColor = this._io.readU1();
    this.mouthSize = this._io.readU1();
    this.mouthType = this._io.readU1();
    this.mouthVertical = this._io.readU1();
    this.beardSize = this._io.readU1();
    this.beardMustache = this._io.readU1();
    this.beardVertical = this._io.readU1();
    this.noseSize = this._io.readU1();
    this.noseType = this._io.readU1();
    this.noseVertical = this._io.readU1();
  }

  /**
   * Facial hair color. Ranges from 0 to 99. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{hair-color} for default colors and /maps.txt/{colors} for custom colors.
   */

  /**
   * Beard (goatee) type. Ranges from 0 to 5.
   */

  /**
   * Body weight. Ranges from 0 to 127, small to large.
   */

  /**
   * Eye stretch. Ranges from 0 to 6, small to large.
   */

  /**
   * Eye color. Ranges from 0 to 99. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{eye-color} for default colors and /maps.txt/{colors} for custom colors.
   */

  /**
   * Eye rotation. Ranges from 0 to 7, down to up. Note that some eye types have a default rotation. You can find more specifics at /rotation.txt/{eyes}.
   */

  /**
   * Eye size. Ranges from 0 to 7, small to large.
   */

  /**
   * Eye type. Ranges from 0 to 59. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{eyes}.
   */

  /**
   * Eye X (horizontal) distance. Ranges from 0 to 12, close to far.
   */

  /**
   * Eye Y (vertical) position. Ranges from 18 to 0, low to high.
   */

  /**
   * Eyebrow stretch. Ranges from 0 to 6, small to large.
   */

  /**
   * Eyebrow color. Ranges from 0 to 99. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{hair-color} for default colors and /maps.txt/{colors} for custom colors.
   */

  /**
   * Eyebrow rotation. Ranges from 0 to 11, down to up. Note that some eyebrow types have a default rotation. You can find more specifics at /rotation.txt/{eyebrows}.
   */

  /**
   * Eyebrow size. Ranges from 0 to 8, small to large.
   */

  /**
   * Eyebrow type. Ranges from 0 to 23. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{eyebrows}.
   */

  /**
   * Eyebrow X (horizontal) distance. Ranges from 0 to 12, close to far.
   */

  /**
   * Eyebrow Y (vertical) distance. Ranges from 12 to 3, low to high.
   */

  /**
   * Skin color. Ranges from 0 to 9. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{skin}.
   */

  /**
   * Face makeup. Ranges from 0 to 11.
   */

  /**
   * Face shape. Ranges from 0 to 11. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{face}.
   */

  /**
   * Face wrinkles. Ranges from 0 to 11.
   */

  /**
   * Favorite color. Ranges from 0 to 11.
   */

  /**
   * Mii gender. 0 = male, 1 = female.
   */

  /**
   * Glasses color. Ranges from 0 to 99. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{glasses-color} for default colors and /maps.txt/{colors} for custom colors.
   */

  /**
   * Glasses size. Ranges from 0 to 7, small to large.
   */

  /**
   * Glasses type. Ranges from 0 to 19. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{glasses}.
   */

  /**
   * Glasses Y (vertical) position. Ranges from 20 to 0, low to high.
   */

  /**
   * Hair color. Ranges from 0 to 99. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{hair-color} for default colors and /maps.txt/{colors} for custom colors.
   */

  /**
   * Flip hair. 0 = no, 1 = yes.
   */

  /**
   * Hair type. Ranges from 0 to 131. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{hair}.
   */

  /**
   * Body height. Ranges from 0 to 127, short to tall.
   */

  /**
   * Beauty mark size. Ranges from 0 to 8, small to large.
   */

  /**
   * Enable beauty mark. 0 = no, 1 = yes.
   */

  /**
   * Beauty mark X (horizontal) position. Ranges from 0 to 16, left to right.
   */

  /**
   * Beauty mark Y (vertical) position. Ranges from 30 to 0, low to high.
   */

  /**
   * Mouth stretch. Ranges from 0 to 6, small to large.
   */

  /**
   * Mouth color. The default colors are ordered the same as visible in editor, ranging from 19 to 23. The custom colors are not and range from 0 to 99. A map of the internal values in correlation to the Mii editor is at /maps.txt/{colors} for custom colors.
   */

  /**
   * Mouth size. Ranges from 0 to 8, small to large.
   */

  /**
   * Mouth type. Ranges from 0 to 35. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{mouth}.
   */

  /**
   * Mouth Y (vertical) position. Ranges from 18 to 0, low to high.
   */

  /**
   * Mustache size. Ranges from 0 to 8, small to large.
   */

  /**
   * Mustache type. Ranges from 0 to 5.
   */

  /**
   * Mustache Y (vertical) position. Ranges from 16 to 0, low to high.
   */

  /**
   * Nose size. Ranges from 0 to 8, small to large.
   */

  /**
   * Nose type. Ranges from 0 to 17. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{nose}.
   */

  /**
   * Nose Y (vertical) position. Ranges from 18 to 0, low to high.
   */

  return Gen3Studio;
})();
return Gen3Studio;
}));
