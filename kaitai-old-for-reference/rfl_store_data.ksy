meta:
  id: rfl_store_data
  application: |
    Mii data format used on Wii (big-endian) and DS (little-endian).
    Also included in CFL and FFL.
    Fields marked as "padding" are always zero.
  file-extension:
    - rcd
    - rsd
    # Unofficial:
    - mii
    - miigx
    - mae
  xref:
    struct_names: |
      RFLCharData/RFLiCharData
      CFLiRFLMiiDataCore, FFLiMiiDataCoreRFL, FFLiMiiDataOfficialRFL
      RFLStoreData
  endian: be
  bit-endian: be

seq:
  - id: padding0
    type: b1
  - id: gender
    type: b1
    doc: Originally named sex
    enum: gender
  - id: birth_month
    type: b4
    doc: Originally named birth_month despite other fields using camelCase.
  - id: birth_day
    type: b5
    doc: |
      Originally named birth_day despite other fields using camelCase.
      0 = not set. Counts from 1-31.
      Consoles only let you set both fields, not just one.
      Note that the maximum day per month is validated in
      CFL (CFLi_GetMonthOfDay::monthOfDay) and
      FFL (MONTH_OF_DAY, https://github.com/aboood40091/ffl/blob/master/src/FFLiDateTime.cpp#L47)
  - id: favorite_color
    type: b4
    enum: favorite_color
  - id: favorite
    type: b1
  - id: name
    type: str
    encoding: UTF-16BE
    size: 20
    doc: "Not null-terminated, contains 10 characters"
  - id: height
    type: u1
  - id: build
    type: u1
  # Byte 0x18 (RFLCreateID is 8 bytes)
  - id: create_id
    type: create_id
  - id: face_type
    type: b3
  - id: face_color
    type: b3
  - id: face_tex
    type: b4
  - id: padding2
    type: b3
  - id: localonly
    type: b1
  - id: type
    type: b2
    enum: type
    doc: |
      Set to 1 if downloaded from
      Check Mii Out Channel. Enum is
      deleted "RFLDataType" from RVLFaceLibraryAlpha3_0926
  - id: hair_type
    type: b7
  - id: hair_color
    type: b3
  - id: hair_flip
    type: b1
  - id: padding3
    type: b5
  - id: eyebrow_type
    type: b5
  - id: eyebrow_rotate
    type: b5
  - id: padding4
    type: b6
  - id: eyebrow_color
    type: b3
  - id: eyebrow_scale
    type: b4
  - id: eyebrow_y
    type: b5
  - id: eyebrow_x
    type: b4
  - id: eye_type
    type: b6
  - id: eye_rotate
    type: b5
  - id: eye_y
    type: b5
  - id: eye_color
    type: b3
  - id: eye_scale
    type: b4
  - id: eye_x
    type: b4
  - id: padding5
    type: b5
  - id: nose_type
    type: b4
  - id: nose_scale
    type: b4
  - id: nose_y
    type: b5
  - id: padding6
    type: b3
  - id: mouth_type
    type: b5
  - id: mouth_color
    type: b2
  - id: mouth_scale
    type: b4
  - id: mouth_y
    type: b5
  - id: glass_type
    type: b4
  - id: glass_color
    type: b3
  - id: glass_scale
    type: b4
  - id: glass_y
    type: b5
  - id: mustache_type
    type: b2
  - id: beard_type
    type: b2
  - id: beard_color
    type: b3
  - id: beard_scale
    type: b4
  - id: beard_y
    type: b5
  - id: mole_type
    type: b1
  - id: mole_scale
    type: b4
  - id: mole_y
    type: b5
  - id: mole_x
    type: b5
  - id: padding8
    type: b1
  - id: creator_name
    type: str
    encoding: UTF-16BE
    size: 20
    doc: "Not null-terminated, contains 10 characters"
    if: not _io.eof
  - id: crc
    doc: Additional in CFLiPackedMiiDataPacket.
    type: u2
    if: not _io.eof

# Mirror fields based on naming
# used in other structures.
instances:
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

# Expand CreateID type.
types:
  create_id:
    seq:
      - id: flags
        type: create_id_flags
      - id: create_date_offset
        type: b28be
      - id: addr_low
        doc: |
          On Wii and DS, this contains the last 3 bytes
          of the MAC address, with the first byte being a
          checksum over the first 3 bytes, calculated (in JS) like:
          `macAddressUint8Array.slice(0, 3).reduce((sum, b) => sum + b, 0) & 0x7F`
          (Calculated in createLowAddr_ in RFL_Database.c)
          NOTE: Completely unknown how it is calculated on DS.

          In order for the Mii to be considered as created from the
          same console on Wii (RFLiIsMyHomeID), the CreateID has to
          be non-null, not from DS, and the MAC/sum has to match.
        type: u1
        repeat: expr
        repeat-expr: 4
    instances:
      create_date_timestamp:
        # Time is divided by two when writing.
        # Not sure if this is ever read by consoles.
        value: |
          (create_date_offset * 4)
            + 1136073600
        #     ^^^^^^^^^^ Timestamp of first day of 2006.
        # Dates wrap around on: Jan. 5, 2023, 18:48:32
        # TODO IF THEY ARE BY 4: Jan. 10, 2040, 13:37:04
        doc: |
          Creation date as a Unix timestamp.
          TODO Unknown if this is accurate
      data:
        pos: 24          # << Offset of createID field.
        type: u1
        repeat: expr
        repeat-expr: 8

  create_id_flags:
    seq:
      - id: normal
        doc: Cleared = Special, Set = Normal
        type: b1be
      - id: field_1
        doc: Cleared on Wii and 3DS, set on DS and Wii U.
        type: b1be
      - id: temporary
        doc: |
          Given to random Miis and seen in some games' CPU Miis.
          Its meaning is derived from how random Miis are obtained
          from a database (RFLMiddleDBType_Random, FFLiDatabaseRandom)
          that returns a random Mii on each index. So, every time you
          fetch from the database, it creates a new random Mii, so the index
          cannot be relied upon, and this also effectively prevents those
          random Miis from being saved.

          The functions FFLiIsValidMiiID(), CFLi_IsValidMiiID(),
          nn::mii::detail::Ver3CreateId::IsValid()
          all check against this bit - e.g. makes data INVALID.
        type: b1be
      - id: field_3
        doc: Cleared on Wii and DS, set on 3DS and Wii U.
        type: b1be
    instances:
      platform:
        doc: Second and fourth bit of flags.
        value: (field_1.to_i << 1) | field_3.to_i
        enum: create_id_platform

    enums:
      create_id_platform:
        0: wii  # 00 - Bit 2 clear, 4 clear
        1: ctr  # 01 - Bit 2 clear, 4 set
        2: ntr  # 10 - Bit 2 set,   4 clear
        3: wiiu # 11 - Bit 2 set,   4 set
        #  ^^^^ Also Miitomo, Switch (nn::mii::detail::ModifyVer3CreateIdWiiUAndNormal)
enums:
  type:           # RFLDataType (unused?) - ONLY defined in RFL_Types.h from RVLFaceLibraryAlpha3_0926
    0: normal
    1: presented  # Set when downloaded from Check Mii Out Channel.
    2: underground
    3: special
  gender:         # RFLSex/CFLGender/FFLGender/nn::mii::Gender
    0: male
    1: female
    2: all
  favorite_color: # RFLFavoriteColor/CFLFavoriteColor/FFLFavoriteColor/nn::mii::FavoriteColor
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
  # month? day? month_of_day?
