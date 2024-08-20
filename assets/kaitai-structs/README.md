* Source of gen1_wii.ksy, gen2_wiiu_3ds_miitomo.ksy, gen3_studio.ksy, gen3_switch.ksy, gen3_switchgame.ksy: https://github.com/JimKatz/mii2studio
  - The repo above is just a fork of Larsenv's last commit to mii2studio.
## Credits verbatim from the above repo:
bendevnull for his support.
HEYimHeroic for helping in many ways, without her help we wouldn't have this tool.
jaames for the Mii QR decrypting script.
Larsenv for writing this script.
Matthe815 for figuring out the obfuscation used for the Mii Studio renderer.
# Corresponding types:
* gen1_wii.ksy: RFLCharData, FFLiMiiDataOfficialRFL
* gen2_wiiu_3ds_miitomo.ksy: CFLStoreData, FFLStoreData, AFLStoreData, nn::mii::Ver3StoreData
* gen3_switch.ksy: nn::mii::StoreData
* gen3_switchgame.ksy: nn::mii::CharInfo

# Not from mii2studio:
* gen2_wiiu_3ds_miitomo.ksy has been slightly modified for accuracy by me.
* gen2_wiiu_3ds_miitomo_nfpstoredataextention.ksy is Ver3StoreData with the nn::mii::detail::NfpStoreDataExtentionRaw structure appended at the end.
  - Can be found defined in Yuzu: yuzu/src/core/hle/service/mii/types.h
  - Or, from the following methods:
    * `nn::mii::detail::NfpStoreDataExtentionRaw::SetFromStoreData(nn::mii::detail::StoreDataRaw const&)`
    * `nn::mii::detail::NfpStoreDataExtentionRaw::ToStoreData(nn::mii::detail::StoreDataRaw*) const`
