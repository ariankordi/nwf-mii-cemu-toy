# Authored by Arian Kordi:
# - https://github.com/ariankordi
# - ariankordi@ariankordi.net
# - https://jsfiddle.net/u/arian_/fiddles/
meta:
  id: ver3_store_data
  title: 3DS/Wii U Mii data format
  application: |
    Mii data format used on 3DS, Wii U, Miitomo for
    QR codes, and on Switch for amiibo data.
    It’s also referred to as: FFLStoreData (Wii U),
    nnmiiStoreData/CFLiMiiDataPacket (3DS),
    nn::mii::Ver3StoreData (Switch), and unofficially "gen2".

    The layout of facial features in this struct
    follows the order of CFLiCharInfo/FFLiCharInfo.

    Fields marked as "padding" and "reserved" are always zero.
  file-extension:
    - cfsd
    - ffsd
    - 3dsmii # Unofficial, 92 bytes.
  xref:
    struct_names:
      # 3DS
      - CFLStoreData # Public. Not in niconico_develop.axf?
                     # But other strings allude to this
      - CFLiMiiDataPacket # Internal
      - nnmiiStoreData # From Horizon, not CFL
      # Wii U
      - FFLStoreData # Public
      - FFLiStoreDataCFL # Internal
      # Miitomo
      - AFLStoreData # Same as FFL (fork)
      # NintendoSDK/NX
      - nn::mii::Ver3StoreData
      - nn::mii::detail::Ver3StoreDataRaw # Internal

  # TODO: On Wii U, this structure is stored big-endian,
  # but they reverse the bitfield order within each
  # u32/u16 "word" so they can just swap each word alone.
  # It'd be nice to support this, but it doesn't look like
  # Kaitai is... "flexible"? enough for that.
  # Unions may be required.
  endian: le
  bit-endian: le

# (From Feb/March 2025:)
# what is my strategy for kaitai in general?
# * kaitai does not support encoding
#   - maybe debug mode can be used?
#   - custom kaitai parser (like with struct-fu: https://jsfiddle.net/arian_/f6daxrjt/1/)
# * preferably should keep everything top-level, no nesting/unions
#   - create id as the exception? but has .data property
# * will it be an alternative to structs in js or dwarf or something?

# * need to somehow ignore, remove, or make optional the
#   `valid` range fields as decoding fails without it :/

doc: |
  The real field names are in DWARF info for CFL (niconico_develop.axf)
  as well as nn::mii::detail::Ver3StoreDataRaw getter functions.
  All of the names of fields here are original, as far as I'm aware.
seq:
  # u32: 00/0x00 - Lower personal fields.
  - id: mii_version
    doc: |
      Set to constant 0x03, but can also be set to 0x00
      when created using the Wii U Mii Maker camera feature.
      (bug? happens somewhere in mwmpfGetFFLCharInfo)
    valid:
      any-of: [0, 3]
    type: b8
  - id: copyable
    type: b1
  - id: ng_word
    type: b1
  - id: region_move
    type: b2 # 0-3
    enum: region_move
  - id: font_region
    doc: |
      Font region enum value. 0 corresponds to JP/US/EU,
      all “primary” regions consoles are sold.

      The extent to which this is used is unclear, but if
      the font region doesn’t match the console,
      all non-ASCII characters are turned into question marks.
      (FFL: FFLiAdditionalInfo.cpp > IsAvailableFontRegion(), ReplaceNonAsciiNameChar: https://github.com/aboood40091/ffl/blob/73fe9fc70c0f96ebea373122e50f6d3acc443180/src/FFLiAdditionalInfo.cpp#L33-L44)
      (CFL: CFLi_GetAdditionalInfo(), cfl_edit.cpp: IsAvailableFontRegion(), ReplaceNonAsciiNameChar())
      (nn::mii: mii_Common.cpp > ReplaceFontRegion(), ReplaceQuestionMark())
    type: b2 # 0-3
    enum: font_region
  - id: reserved_0
    type: b2
    valid:
      max: 0
  - id: room_index
    doc: |
      This and positionInRoom are used only in CFL_DB.dat,
      but CharInfo verification will fail in CFL/FFL
      if roomIndex/positionInRoom exceed 9.
    type: b4 # 0-15
    valid:
      max: 9
  - id: position_in_room # ^^
    type: b4 # 0-15
    valid:
      max: 9
  - id: author_type
    doc: |
      Unused. Value 0 corresponds to "normal". This was presumably for UGC.
      No enum in CFL, and always set in CFL/FFL (+ CharInfo) to 0.
      Note that nn::mii::detail::Ver3StoreDataRaw::Verify() enforces this
      to be zero (along with all other fields that are reserved/padding)
    type: b4
    enum: author_type
    valid:
      in-enum: true
  - id: birth_platform
    type: b3
    enum: birth_platform
    doc: |
      On 3DS, the max for this field is 3 (may be higher in newer CFL),
      so higher values are considered invalid.

      So, if this is set to 4 then it will only be valid and
      scannable as a QR code on Wii U.
      Wii U/Miitomo sets this to 3 when creating QR codes ({F/A}FLiConvertStoreDataForCTR())

      Note that in FFL and nn::mii, this accepts a max value of 7.

      1 corresponds to Wii and 2 corresponds to DS but a bug in
      FFLiMiiDataCoreRFL2CharInfo() ensures that it’s never set to 2 on Wii U.
    valid:
      in-enum: true
  - id: reserved_1
    type: b1

  # u8[8]: 04/0x04 - 8 byte value containing the transferable ID.
  - id: author_id  # CFLiAuthorID (private type)
    type: u1
    repeat: expr
    repeat-expr: 8
    doc: |
      In CFL and FFL this is derived from the following:
      CFL: `nn::cfg::CTR::GetTransferableId(0);`
      FFL: `nn::act::GetTransferableIdEx(u64*, 0x004A0, 0xFF);`
      This is a console-unique ID that may be
      reset when the console is formatted.

      In order for the Mii to be considered as created from the
      same console (CFLi_IsHomeAuthorID(), FFLiIsHomeAuthorID()),
      this authorID field has to match.

  # u8[12]: 12/0x0C - 10 byte value identifying the character.
  - id: create_id  # CFLCreateID (private type)
    doc: |
      Unique identifier for the data. This is often called the
      "Mii ID", and is a 10-byte field that's often separated
      unofficially into 4 and 6 byte portions.
      The system will consider two Miis with the same CreateID
      to be the same, and offer to overwrite if you import a conflicting ID.

      The first four bits are a flag that contain
      a flag for whether the Mii is special.
    type: create_id
    valid:
      # CreateID must not be null.
      expr: |
        not (create_id.data[0] == 0 and
        create_id.data[1] == 0 and
        create_id.data[2] == 0 and
        create_id.data[3] == 0 and
        create_id.data[4] == 0 and
        create_id.data[5] == 0 and
        create_id.data[6] == 0 and
        create_id.data[7] == 0 and
        create_id.data[8] == 0 and
        create_id.data[9] == 0)
  - id: reserved_2
    type: u1
    repeat: expr
    repeat-expr: 2
    valid:
      max: 0

  # u16: 24/0x18 - Higher personal fields.
  - id: gender
    type: b1
    enum: gender
  - id: birth_month
    type: b4  # 0-16
    doc: 0 = not set. Counts from 1-12.
  - id: birth_day
    type: b5  # 0-31
    doc: |
      0 = not set. Counts from 1-31.
      Consoles only let you set both fields, not just one.
      Note that the maximum day per month is validated in
      CFL (CFLi_GetMonthOfDay::monthOfDay),
      FFL (MONTH_OF_DAY, https://github.com/aboood40091/ffl/blob/master/src/FFLiDateTime.cpp#L47),
      RFL (RFLiCheckBirthday, https://github.com/SMGCommunity/Petari/blob/6c4e3156be67abc08827655a788afee013ca4ed4/src/RVLFaceLib/RFL_DataUtility.c#L281),
      nn::mii (mii_Ver3StoreDataRaw.cpp, IsValidBirthday(int, int)::NumberOfDaysInAMonth)
    valid:
      # Based on RFLiCheckBirthday.
      expr: |
        not (birth_month == 0 and birth_day != 0) and
        not (birth_month != 0 and birth_day == 0) and
        not (birth_month > 12 or birth_day > 31) and
        birth_day <= number_of_days_in_a_month[birth_month]
  - id: favorite_color
    type: b4
    enum: favorite_color
    valid:
      in-enum: true
  - id: favorite
    type: b1
  - id: padding_0
    type: b1
    valid:
      eq: false

  # u16[10]: 26/0x1A - 10-character name in UTF-16.
  - id: name
    type: strz
    size: 20
    encoding: UTF-16LE
    doc: |
      Does not have a null terminator at the end unlike CharInfo.
      Note that 3DS/Wii U often don't overwrite the old name
      with zeroes when changing the name, so you must properly
      terminate this string with the first two zero bytes.

  # u8[2]: 46/0x2E - Body parameters.
  - id: height
    type: u1
    doc: |
      The height/Y-scale of the body model.

      In this struct, the maximum for height/build is 128
      while on later platforms it is 127, so this must be clamped.
    valid:
      max: 128
  - id: build
    type: u1
    doc: |
      The build, "physique" (N), weight/X and Z scale of the body model.
      Maximum for this is also 128 and it should be clamped.
    valid:
      max: 128

  # u16: 48/0x30 - Faceline fields + localonly.
  - id: localonly
    type: b1
    doc: |
      Corresponds to "sharing", "mingling".
      "Sharing/Mingling Off" = localonly is 1.
    valid:
      # Considered invalid if special and localonly is false.
      expr: create_id.flags.normal or localonly
  - id: face_type
    type: b4
    valid:
      max: 11
  - id: face_color
    type: b3
    valid:
      max: 5
  - id: face_tex
    type: b4
    valid:
      max: 11
  - id: face_make
    type: b4
    valid:
      max: 11

  # u16: 50/0x32 - Hair fields.
  - id: hair_type
    type: b8
    valid:
      max: 131
  - id: hair_color
    type: b3
    valid:
      max: 7
  - id: hair_flip
    type: b1
  - id: padding_1
    type: b4
    valid:
      max: 0

  # u16: 52/0x34 - Eye fields part 1.
  - id: eye_type
    type: b6
    valid:
      max: 59
  - id: eye_color
    type: b3
    valid:
      max: 5
  - id: eye_scale
    type: b4
    valid:
      max: 7
  - id: eye_aspect
    type: b3
    valid:
      max: 6

  # u16: 54/0x36 - Eye fields part 2.
  - id: eye_rotate
    type: b5
    valid:
      max: 7
  - id: eye_x
    type: b4
    valid:
      max: 12
  - id: eye_y
    type: b5
    valid:
      max: 18
  - id: padding_2
    type: b2
    valid:
      max: 0

  # u16: 56/0x38 - Eyebrow fields part 1.
  - id: eyebrow_type
    type: b5
    valid:
      max: 23
  - id: eyebrow_color
    type: b3
    valid:
      max: 7
  - id: eyebrow_scale
    type: b4
    valid:
      max: 8
  - id: eyebrow_aspect
    type: b3
    valid:
      max: 6
  - id: padding_3
    type: b1
    valid:
      eq: false

  # u16: 58/0x3A - Eyebrow fields part 2.
  - id: eyebrow_rotate
    type: b5
    valid:
      max: 11
  - id: eyebrow_x
    type: b4
    valid:
      max: 12
  - id: eyebrow_y
    type: b5
    doc: |
      Unlike other minimum values, eyebrowY begins at 3.
      That's probably to make all-zero data invalid, as
      if you hook FFLiiVerifyCharInfo you will notice that
      Wii U Menu/Mii Maker is constantly trying
      to "verify" null data lmao
      (The VerifyCharInfo function ignores null CreateIDs)
    valid:
      min: 3
      max: 18
  - id: padding_4
    type: b2
    valid:
      max: 0

  # u16: 60/0x3C - Nose fields.
  - id: nose_type
    type: b5
    valid:
      max: 17
  - id: nose_scale
    type: b4
    valid:
      max: 8
  - id: nose_y
    type: b5
    valid:
      max: 18
  - id: padding_5
    type: b2
    valid:
      max: 0

  # u16: 62/0x3E - Mouth fields part 1.
  - id: mouth_type
    type: b6
    valid:
      max: 35
  - id: mouth_color
    type: b3
    valid:
      max: 4
  - id: mouth_scale
    type: b4
    valid:
      max: 8
  - id: mouth_aspect
    type: b3
    valid:
      max: 6

  # u16: 64/0x40 - Mouth fields part 2 + mustache type.
  - id: mouth_y
    type: b5
    valid:
      max: 18
  - id: mustache_type
    type: b3
    valid:
      max: 5
  - id: padding_6
    type: b8
    valid:
      max: 0

  # u16: 66/0x42 - Beard (/mustache) fields.
  - id: beard_type
    type: b3
    valid:
      max: 5
  - id: beard_color
    type: b3
    valid:
      max: 7
  - id: beard_scale
    type: b4
    valid:
      max: 8
  - id: beard_y
    type: b5
    valid:
      max: 16
  - id: padding_7
    type: b1
    valid:
      eq: false

  # u16: 68/0x44 - Glass fields.
  - id: glass_type
    type: b4
    valid:
      max: 8
  - id: glass_color
    type: b3
    valid:
      max: 5
  - id: glass_scale
    type: b4
    valid:
      max: 7
  - id: glass_y
    type: b5
    valid:
      max: 20

  # u16: 70/0x46 - Mole fields.
  - id: mole_type
    type: b1
  - id: mole_scale
    type: b4
    valid:
      max: 8
  - id: mole_x
    type: b5
    valid:
      max: 16
  - id: mole_y
    type: b5
    valid:
      max: 30
  - id: padding_8
    type: b1
    valid:
      eq: false

  # 72/0x48 - End of fields for CFLiPackedMiiDataCore/FFLiMiiDataCore.
  - id: creator_name
    doc: |
      Additional in CFLiPackedMiiDataOfficial.
      See name field for quirks.
    type: strz
    size: 20
    encoding: UTF-16LE
    if: not _io.eof
  # 92/0x5C - CFLiMiiDataPacket/FFLStoreData fields:
  - id: padding_9
    doc: Additional in CFLiMiiDataPacket.
    type: u2
    if: not _io.eof
    valid:
      max: 0
  - id: crc
    doc: Additional in CFLiMiiDataPacket.
    type: u2
    if: not _io.eof
  # 96/0x60

# Mirror fields based on naming
# used in other structures.
instances:
  # Exclusively used for birthday verification.
  number_of_days_in_a_month:
    value: |
      [0, 31, 29, 31, 30, 31, 30,
          31, 31, 30, 31, 30, 31]

  # nn::mii naming:
  faceline_color:
    value: face_color
  faceline_type:
    value: face_type
  faceline_wrinkle:
    value: face_tex
  mustache_scale:
    value: beard_scale
  mustache_y:
    value: beard_y
  nickname:
    value: name
  # RFL naming:
  #sex:  # actual field name of RFLiCharData from DWARF:
         # https://github.com/SMGCommunity/Petari/blob/d34c595ba7dfcd92ef776964ecf668f37cbb7123/libs/RVLFaceLib/include/RFLi_Types.h#L263
  #  value: gender

# Expand CreateID type.
types:
  create_id:
    doc: |
      Officially called: 生成時ID / 固有ID
      This actually does not have a struct, and is
      just an "anonymous" data array which they
      manually bit-twiddle to check flags.
    seq:
      - id: flags
        type: create_id_flags
      - id: create_date_offset
        type: b28be
      - id: base
        doc: |
          Different result on each platform.
          Wii, 3DS, (DS?? unchecked) = MAC address
          Wii U = nn::act::GetDeviceHash()
          Miitomo = SHA-1 of afl-cbin (AFLiGetCreateIDBaseBySystem)
          Switch = random (nn::os::GenerateRandomBytes())
        type: u1
        repeat: expr
        repeat-expr: 6
    instances:
      create_date_timestamp:
        # Time is divided by two when writing.
        # Not sure if this is ever read by consoles.
        value: |
          (create_date_offset * 2)
            + 1262304000
        #     ^^^^^^^^^^ Timestamp of first day of 2010.
        # Dates wrap around on: Jan. 5, 2027, 18:48:32
        doc: |
          Creation date as a Unix timestamp.
          Only written if created on Wii U, 3DS or
          Miitomo - nothing else, e.g. on Switch
          this is completely random (nn::os::GenerateRandomBytes())
      data:
        pos: 12          # << Offset of createID field.
        type: u1
        repeat: expr
        repeat-expr: 10

  create_id_flags:
    doc: Flags in the first four bits of the ID.
    seq:
      # normal: b1be
      # field_1: b1be
      # temporary: b1be
      # field_3: b1be
      - id: normal
        doc: |
          Cleared = Special, Set = Normal

          If a CreateID is special, then localonly must be 1
          ("sharing"/"mingling" off), or it will be invalid
          (CFLi_VerifyCharInfo(), FFLiVerifyCharInfoWithReason())

          When a Special Mii is scanned as a QR code on Wii U,
          the CreateID platform bits for Wii U must be set,
          or it will not be accepted and will only work on a 3DS.
        type: b1be
      - id: field_1
        doc: Cleared on Wii and 3DS, set on DS and Wii U.
        type: b1be
      - id: temporary
        doc: |
          Given to random Miis (in FFL) and seen in games' CPU Mii files.
          The CreateID is INVALID when this is set, verified by:
          FFLiIsValidMiiID(), CFLi_IsValidMiiID(),
          nn::mii::detail::Ver3CreateId::IsValid()
          Meaning it will be renderable but cannot be read/written to a DB.

          Miis with this bit set are not scannable as QR codes on 3DS.
          But they will scan on Wii U Mii Maker, though the app will
          crash after saving and it doesn't appear in the database.
        type: b1be
      - id: field_3
        doc: Cleared on Wii and DS, set on 3DS and Wii U.
        type: b1be
    instances:
      platform:
        value: (field_1.to_i << 1) | field_3.to_i
        enum: create_id_platform
        doc: |
          Second and fourth bit of flags.

          When converting from Wii data on 3DS, this is used to set
          birthPlatform to Wii (1) or DS (2) using CFLi_UnpackRFLMiiDataCore
          but a bug in FFLiMiiDataCoreRFL2CharInfo means it
          will only be set to Wii (1) and never to DS (2) on Wii U.

    enums:
      create_id_platform:
        0: wii  # 00 - Bit 2 clear, 4 clear
        1: ctr  # 01 - Bit 2 clear, 4 set
        2: ntr  # 10 - Bit 2 set,   4 clear
        3: wiiu # 11 - Bit 2 set,   4 set
        #  ^^^^ Also Miitomo, Switch (nn::mii::detail::ModifyVer3CreateIdWiiUAndNormal)
enums:
  region_move:    # CFLiRegionMove/nn::mii::RegionMove
    0: all
    1: jp_only
    2: us_only
    3: eu_only
  font_region:    # CFLFontRegion/FFLFontRegion/nn::mii::FontRegion
    0: jp_us_eu
    1: china
    2: korea
    3: taiwan
  author_type:    # FFLiAuthorType?/nn::mii::detail::Ver3AuthorType
    0: normal     # "UGC 作者タイプの定義です。"
    # Yes, this really does not have any other values
    # See ctr.7z/ctr/include/nn/mii/mii_CharInfo.h
  birth_platform: # FFLBirthPlatform/CFLiBirthPlatform/nn::mii::detail::Ver3BirthPlatform
    #1: min   # Minimum value.
    1: wii   # CFLi_BIRTH_PLATFORM_WII
    2: ds    # CFLi_BIRTH_PLATFORM_DS  << Specifically called "DS" here
             #                            but "CFLi_IsNTRMiiID" checks CreateID
    3: ctr   # CFLi_BIRTH_PLATFORM_CTR
    4: wiiu  # Also Miitomo, Switch
    # CTRにおける範囲
    #1: ctr_min
    #3: ctr_max # Maximum valid on 3DS.
    # Values from FFLUtility (viewer):
    5: feture0
    6: feture1
    7: feture2
    #7: max   # 7 for "future"? -> 5,6,7の値は次世代プラットフォーム用に予約されています。
  gender:         # CFLGender/FFLGender/nn::mii::Gender
    0: male
    1: female
  favorite_color: # CFLFavoriteColor/FFLFavoriteColor/nn::mii::FavoriteColor
    0: red
    1: orange
    2: yellow
    3: yellowgreen
    4: green
    5: blue
    6: skyblue
    7: pink
    8: purple
    9: brown
    10: white
    11: black
