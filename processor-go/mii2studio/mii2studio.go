package mii2studio

import (
	"bytes"
	"encoding/hex"
	"github.com/kaitai-io/kaitai_struct_go_runtime/kaitai"
	"log"
	"reflect"
)

func Map3DSStoreDataToStudioBytes(origMiiData []byte) []byte {
	ignoreErrorAndIntToU8 := func(v int, _ error) uint8 { return uint8(v) }
	// Create a new reader for the Gen2Wiiu3dsMiitomo
	origMii := NewGen2Wiiu3dsMiitomo()
	if err := origMii.Read(kaitai.NewStream(bytes.NewReader(origMiiData)), nil, origMii); err != nil {
		log.Fatalln(err)
	}

	// Create a new blank Gen3Studio
	studioMii := NewGen3Studio()

	// Instances from origMii named differently than Gen3Studio
	studioMii.BeardGoatee = ignoreErrorAndIntToU8(origMii.FacialHairBeard())
	studioMii.BeardSize = ignoreErrorAndIntToU8(origMii.FacialHairSize())
	studioMii.BeardMustache = ignoreErrorAndIntToU8(origMii.FacialHairMustache())
	studioMii.BeardVertical = ignoreErrorAndIntToU8(origMii.FacialHairVertical())

	// Map properties from origMii to studioMii
	// Using reflection to dynamically assign properties from origMii to studioMii
	origMiiValue := reflect.ValueOf(origMii).Elem()
	origMiiValuePtr := reflect.ValueOf(origMii)
	studioMiiValue := reflect.ValueOf(studioMii).Elem()

	for i := 0; i < studioMiiValue.NumField(); i++ {
		field := studioMiiValue.Type().Field(i)
		if field.PkgPath != "" || field.Name[0] == '_' {
			// Skip unexported fields and fields starting with an underscore
			continue
		}

		origFieldVal := origMiiValue.FieldByName(field.Name)
		if origFieldVal.IsValid() {
			setFieldValue(studioMiiValue.Field(i), origFieldVal)
		} else {
			// Field not found, try to find a method
			method := origMiiValuePtr.MethodByName(field.Name)
			if method.IsValid() {
				results := method.Call(nil)
				if len(results) > 0 {
					setFieldValue(studioMiiValue.Field(i), results[0])
				}
			}
		}
	}

	// Convert fields to be compatible with Gen3 format
	studioMii.FacialHairColor = ignoreErrorAndIntToU8(origMii.FacialHairColor())
	if studioMii.FacialHairColor == 0 {
		studioMii.FacialHairColor = 8
	}
	studioMii.EyeColor = ignoreErrorAndIntToU8(origMii.EyeColor()) + 8
	studioMii.EyebrowColor = ignoreErrorAndIntToU8(origMii.EyebrowColor())
	if studioMii.EyebrowColor == 0 {
		studioMii.EyebrowColor = 8
	}
	studioMii.GlassesColor = ignoreErrorAndIntToU8(origMii.GlassesColor())
	if studioMii.GlassesColor == 0 {
		studioMii.GlassesColor = 8
	} else if studioMii.GlassesColor < 6 {
		studioMii.GlassesColor = studioMii.GlassesColor + 13
	}
	studioMii.HairColor = uint8(origMii.HairColor)
	if studioMii.HairColor == 0 {
		studioMii.HairColor = 8
	}
	studioMii.MouthColor = ignoreErrorAndIntToU8(origMii.MouthColor())
	if studioMii.MouthColor < 4 {
		studioMii.MouthColor = studioMii.MouthColor + 19
	}

	var byteBuffer bytes.Buffer
	// Encode to byte buffer
	for i := 0; i < studioMiiValue.NumField(); i++ {
		field := studioMiiValue.Field(i)
		if field.Kind() != reflect.Uint8 {
			// Skip unexported fields or fields that are not uint8
			continue
		}
		byteBuffer.WriteByte(byte(field.Uint()))
	}

	return byteBuffer.Bytes()
}

func setFieldValue(target reflect.Value, source reflect.Value) {
	switch source.Kind() {
	case reflect.Bool:
		// Convert boolean to uint8
		if source.Bool() {
			target.SetUint(1)
		} else {
			target.SetUint(0)
		}
	default:
		// Direct conversion for other types
		target.Set(source.Convert(target.Type()))
	}
}

// adapted from miiMap2Studio js
func Map3DSStoreDataToStudioURLData(miiMap []byte) string {
	miiMap = Map3DSStoreDataToStudioBytes(miiMap)

	lenMap := len(miiMap)

	// Initialize the random number generator
	//rand.Seed(time.Now().UnixNano())
	random := 0 //rand.Intn(256)
	randomCopy := random

	// Modify the map array
	for i := 0; i < lenMap; i++ {
		miiMap[i] = byte((7 + (int(miiMap[i]) ^ randomCopy)) % 256)
		randomCopy = int(miiMap[i])
	}

	// Create the resulting byte slice
	result := make([]byte, lenMap+1)
	result[0] = byte(random)
	copy(result[1:], miiMap)

	// Convert the byte slice to a hex string
	return hex.EncodeToString(result)
}
