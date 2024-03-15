package main

import (
	"encoding/base64"
	"fmt"
	"os"
	"github.com/sigurn/crc16"
)

func main() {
	var base64Data string

	if len(os.Args) < 2 {
		fmt.Println("Usage: go run script.go <base64Data>")
		//return
		base64Data = "AwEAQNDqNZfMQP131K+wv1n8kW4jgAAApltTAEMATwBUAFQAMAA4ADUAMgAAAGc5AgA5B7RIRBL3IsQGrQwTagwAOCmxMUhQUwBjAG8AdAB0ACAATQAuAAAAAAAAAA50"
	} else {
		// Base64 data from command-line argument
		base64Data = os.Args[1]
	}

	// Decode base64 data
	data, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		fmt.Println("Error decoding base64:", err)
		return
	}

	if len(data) < 2 {
		fmt.Println("Data too short")
		return
	}

	crcData := data[:len(data)-2] // Data without the last 2 bytes
	crcExpected := data[len(data)-2:] // Last 2 bytes

	table := crc16.MakeTable(crc16.CRC16_XMODEM)
	crcCalculated := crc16.Checksum(crcData, table)

	crcExpectedValue := uint16(crcExpected[0])<<8 + uint16(crcExpected[1])
	if crcCalculated == crcExpectedValue {
		fmt.Println("CRC check passed: calculated CRC matches expected CRC.")
	} else {
		fmt.Printf("CRC check failed: calculated CRC (%X) does not match expected CRC (%X).\n", crcCalculated, crcExpectedValue)
	}
}

