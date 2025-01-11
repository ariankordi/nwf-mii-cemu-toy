meta:
  id: tomodachi_life_qr_code
  endian: le
seq:
  - id: first_name
    type: str
    size: 32
    encoding: UTF-16LE
  - id: last_name
    type: str
    size: 32
    encoding: UTF-16LE

  - id: unknown
    type: u1
    repeat: expr
    repeat-expr: 3

  - id: hair_dye_enable
    type: b1
  - id: unknownb1
    type: b1
  - id: hair_dye
    type: b5
  - id: unknownb2
    type: b1

  - id: unknown2
    type: u1
    repeat: expr
    repeat-expr: 12

  - id: catchphrase
    type: str
    size: 32
    encoding: UTF-16LE

  - id: unknown3
    type: u1
    repeat: expr
    repeat-expr: 58

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

  - id: unknown4
    type: u1
    repeat: expr
    repeat-expr: 35

  - id: island_name
    type: str
    size: 20
    encoding: UTF-16LE
