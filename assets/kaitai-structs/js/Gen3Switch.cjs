// This is a generated file! Please edit source .ksy file and use kaitai-struct-compiler to rebuild

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['kaitai-struct/KaitaiStream'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('kaitai-struct/KaitaiStream'));
  } else {
    root.Gen3Switch = factory(root.KaitaiStream);
  }
}(typeof self !== 'undefined' ? self : this, function (KaitaiStream) {
var Gen3Switch = (function() {
  function Gen3Switch(_io, _parent, _root) {
    this._io = _io;
    this._parent = _parent;
    this._root = _root || this;

    this._read();
  }
  Gen3Switch.prototype._read = function() {
    this.hairType = this._io.readU1();
    this.moleEnable = this._io.readBitsIntBe(1) != 0;
    this.bodyHeight = this._io.readBitsIntBe(7);
    this.hairFlip = this._io.readBitsIntBe(1) != 0;
    this.bodyWeight = this._io.readBitsIntBe(7);
    this.isSpecial = this._io.readBitsIntBe(1) != 0;
    this.hairColor = this._io.readBitsIntBe(7);
    this.gender = this._io.readBitsIntBe(1) != 0;
    this.eyeColor = this._io.readBitsIntBe(7);
    this._io.alignToByte();
    this.eyebrowColor = this._io.readU1();
    this.mouthColor = this._io.readU1();
    this.facialHairColor = this._io.readU1();
    this.glassesColor = this._io.readU1();
    this.regionLock = this._io.readBitsIntBe(2);
    this.eyeType = this._io.readBitsIntBe(6);
    this.fontRegion = this._io.readBitsIntBe(2);
    this.mouthType = this._io.readBitsIntBe(6);
    this.glassesSize = this._io.readBitsIntBe(3);
    this.eyeVertical = this._io.readBitsIntBe(5);
    this.facialHairMustache = this._io.readBitsIntBe(3);
    this.eyebrowType = this._io.readBitsIntBe(5);
    this.facialHairBeard = this._io.readBitsIntBe(3);
    this.noseType = this._io.readBitsIntBe(5);
    this.mouthStretch = this._io.readBitsIntBe(3);
    this.noseVertical = this._io.readBitsIntBe(5);
    this.eyebrowStretch = this._io.readBitsIntBe(3);
    this.mouthVertical = this._io.readBitsIntBe(5);
    this.eyeRotation = this._io.readBitsIntBe(3);
    this.facialHairVertical = this._io.readBitsIntBe(5);
    this.eyeStretch = this._io.readBitsIntBe(3);
    this.glassesVertical = this._io.readBitsIntBe(5);
    this.eyeSize = this._io.readBitsIntBe(3);
    this.moleHorizontal = this._io.readBitsIntBe(5);
    this._io.alignToByte();
    this.moleVertical = this._io.readU1();
    this.glassesType = this._io.readU1();
    this.faceType = this._io.readBitsIntBe(4);
    this.favoriteColor = this._io.readBitsIntBe(4);
    this.faceWrinkles = this._io.readBitsIntBe(4);
    this.faceColor = this._io.readBitsIntBe(4);
    this.eyeHorizontal = this._io.readBitsIntBe(4);
    this.faceMakeup = this._io.readBitsIntBe(4);
    this.eyebrowRotation = this._io.readBitsIntBe(4);
    this.eyebrowSize = this._io.readBitsIntBe(4);
    this.eyebrowVertical = this._io.readBitsIntBe(4);
    this.eyebrowHorizontal = this._io.readBitsIntBe(4);
    this.mouthSize = this._io.readBitsIntBe(4);
    this.noseSize = this._io.readBitsIntBe(4);
    this.moleSize = this._io.readBitsIntBe(4);
    this.facialHairSize = this._io.readBitsIntBe(4);
    this._io.alignToByte();
    this.miiName = KaitaiStream.bytesToStr(this._io.readBytes(20), "utf-16le");
    this.unknown = [];
    for (var i = 0; i < 16; i++) {
      this.unknown.push(this._io.readU1());
    }
    this.miiId = [];
    for (var i = 0; i < 4; i++) {
      this.miiId.push(this._io.readU1());
    }
  }

  /**
   * Hair type. Ranges from 0 to 131. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{hair}.
   */

  /**
   * Enable mole. 0 = no, 1 = yes.
   */

  /**
   * Body height. Ranges from 0 to 127, short to tall. In the Mii editor, pressing right will add 1 to this value, and pressing left will subtract 1, allowing for precise editing.
   */

  /**
   * Flip hair. 0 = no, 1 = yes.
   */

  /**
   * Body weight. Ranges from 0 to 127, small to large. In the Mii editor, pressing right will add 1 to this value, and pressing left will subtract 1, allowing for precise editing.
   */

  /**
   * Determines if the Mii is Special (golden pants) or not. Special Miis are meant to only be created and distributed by Nintendo, however the Switch does not have any officially distributed Special Miis yet. 0 = not Special (Normal), 1 = Special.
   */

  /**
   * Hair color. Ranges from 0 to 99. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{hair-color} for default colors and /maps.txt/{colors} for custom colors.
   */

  /**
   * Mii gender. 0 = male, 1 = female.
   */

  /**
   * Eye color. Ranges from 0 to 99. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{eye-color} for default colors and /maps.txt/{colors} for custom colors.
   */

  /**
   * Eyebrow color. Ranges from 0 to 99. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{hair-color} for default colors and /maps.txt/{colors} for custom colors.
   */

  /**
   * Mouth color. The default colors are ordered the same as visible in editor, ranging from 19 to 23. The custom colors are not and range from 0 to 99. A map of the internal values in correlation to the Mii editor is at /maps.txt/{colors} for custom colors.
   */

  /**
   * Facial hair color. Ranges from 0 to 99. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{hair-color} for default colors and /maps.txt/{colors} for custom colors.
   */

  /**
   * Glasses color. Ranges from 0 to 99. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{glasses-color} for default colors and /maps.txt/{colors} for custom colors.
   */

  /**
   * Determines if a Special Mii can only be saved on devices of a certain region. 0 = no lock, 1 = JPN, 2 = USA, 3 = PAL/AUS. Other regions (CHN, KOR, TWN) simply must use no region lock to work.
   */

  /**
   * Eye type. Ranges from 0 to 59. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{eyes}.
   */

  /**
   * The font region for the Mii name. 0 = USA + PAL + JPN, 1 = CHN, 2 = KOR, 3 = TWN.
   */

  /**
   * Mouth type. Ranges from 0 to 35. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{mouth}.
   */

  /**
   * Glasses size. Ranges from 0 to 7, small to big.
   */

  /**
   * Eye Y (vertical) position. Ranges from 24 to 0, low to high.
   */

  /**
   * Mustache type. Ranges from 0 to 5.
   */

  /**
   * Eyebrow type. Ranges from 0 to 23. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{eyebrows}.
   */

  /**
   * Beard type. Ranges from 0 to 5.
   */

  /**
   * Nose type. Ranges from 0 to 17. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{nose}.
   */

  /**
   * Mouth stretch. Ranges from 0 to 6, small to big.
   */

  /**
   * Nose Y (vertical) position. Ranges from 24 to 0, low to high.
   */

  /**
   * Eyebrow stretch. Ranges from 0 to 6, small to big.
   */

  /**
   * Mouth Y (vertical) position. Ranges from 24 to 0, low to high.
   */

  /**
   * Eye rotation. Ranges from 0 to 7, down to up. Note that some eye types have a default rotation. You can find more specifics at /rotation.txt/{eyes}.
   */

  /**
   * Mustache Y (vertical) position. Ranges from 22 to 0, low to high.
   */

  /**
   * Eye stretch. Ranges from 0 to 6, small to big.
   */

  /**
   * Glasses Y (vertical) position. Ranges from 20 to 0, low to high.
   */

  /**
   * Eye size. Ranges from 0 to 7, small to big.
   */

  /**
   * Mole X (horizontal) position. Ranges from 0 to 16, left to right.
   */

  /**
   * Mole Y (vertical) position. Ranges from 30 to 0, low to high.
   */

  /**
   * Glasses type. Ranges from 0 to 19. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{glasses}.
   */

  /**
   * Face shape. Ranges from 0 to 11. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{face}.
   */

  /**
   * Favorite color. Ranges from 0 to 11.
   */

  /**
   * Face wrinkles. Ranges from 0 to 11.
   */

  /**
   * Skin color. Ranges from 0 to 9. Not ordered the same as visible in editor. A map of the internal values in correlation to the Mii editor is at /maps.txt/{skin}.
   */

  /**
   * Eye X (horizontal) distance. Ranges from 0 to 12, close to far.
   */

  /**
   * Face makeup. Ranges from 0 to 11.
   */

  /**
   * Eyebrow rotation. Ranges from 0 to 11, down to up. Note that some eye types have a default rotation. You can find more specifics at /rotation.txt/{eyebrows}.
   */

  /**
   * Eyebrow size. Ranges from 0 to 8, small to big.
   */

  /**
   * Eyebrow Y (vertical) position. Ranges from 15 to 0, low to high.
   */

  /**
   * Eyebrow X (horizontal) distance. Ranges from 0 to 12, close to far.
   */

  /**
   * Mouth size. Ranges from 0 to 8, small to big.
   */

  /**
   * Nose size. Ranges from 0 to 8, small to big.
   */

  /**
   * Mole size. Ranges from 0 to 8, small to big.
   */

  /**
   * Mustache size. Ranges from 0 to 8, small to big.
   */

  /**
   * Mii name. Can be up to 10 characters long.
   */

  /**
   * Currently unknown data.
   */

  /**
   * Mii ID. An identifier used to save Miis in most games.
   */

  return Gen3Switch;
})();
return Gen3Switch;
}));
