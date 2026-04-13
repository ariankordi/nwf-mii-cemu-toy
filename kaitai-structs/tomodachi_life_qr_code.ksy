meta:
  id: tomodachi_life_qr_code
  application: |
    Extra data stored within Mii QR codes created from Tomodachi Life.
    To access this data, use this jsfiddle: https://jsfiddle.net/arian_/ckya346z/18/
    Please note that strings usually contain garbage data after the first terminator.
  endian: le
  bit-endian: le
seq:
  - id: first_name
    type: str
    size: 32
    encoding: UTF-16LE
  - id: last_name
    type: str
    size: 32
    encoding: UTF-16LE

  - id: unknown_birthday_age
    size: 3
    doc: contains birthday and Kid/Grown-Up flag

  - id: unknownb2
    type: b1
  - id: hair_dye
    type: b5
  - id: hair_dye_mode
    type: b2
    enum: hair_dye_mode

  - id: unknown2
    size: 12
    doc: |
      always begins with 00000000, effectively 8 bytes
      changing doesnt affect appearance on scan

  - id: catchphrase
    type: str
    size: 32
    encoding: UTF-16LE

  - id: unknown3_clothing
    size: 8
    doc: indices for clothing, headwear, room are stored here

  - id: island_id1
    type: island_id

  - id: island_id2
    type: island_id

  - id: mii_author_id
    type: u1
    repeat: expr
    repeat-expr: 8

  - id: mii_create_id
    type: u1
    repeat: expr
    repeat-expr: 10
    doc: |
      game is using this to identify miis, so if you replace it with
      one from an islander already present it will prompt to replace
      if you say yes it'll replace mii and voice/character param etc
      but clothing, relationship, item owned data is left unchanged

  - id: voice_pitch
    type: u1
  - id: voice_speed
    type: u1
  - id: voice_quality
    type: u1
  - id: voice_tone
    type: u1
  - id: voice_accent
    type: u1
  - id: voice_inotation
    type: u1

  - id: character_movement
    type: u1
  - id: character_speech
    type: u1
  - id: character_expressiveness
    type: u1
  - id: character_attitude
    type: u1
  - id: character_overall
    type: u1

  - id: unknown5
    size: 19
    doc: |
      ends with constant "7600FEFF0F20FFFF0F" (undefined)?
      effectively 10 bytes. changing doesnt affect appearance on scan

  - id: island_id3
    type: island_id

  - id: island_name
    type: str
    size: 18
    encoding: UTF-16LE

  - id: unknown6
    size: 6
    doc: constant "AC44094C00"? may be for region/version idk

types:
  island_id:
    seq:
      - id: data
        size: 16
        #type: u1
        #repeat: expr
        #repeat-expr: 16
enums:
  hair_dye_mode:
    0: off
    1: hair_only
    2: hair_eyebrows
