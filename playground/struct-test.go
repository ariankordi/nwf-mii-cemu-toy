package main

import (
    "bytes"
    "encoding/binary"
    "hash/crc32"
    "os"
    
    "strconv"
    
    "io/ioutil"
    
    "net/http"
)

type RenderParameters struct {
    // This "hash" is a CRC32 for now, which I know isn't a hash.
    // It can be used as a marker pattern for the start of the data
    MiiDataHash     uint32
    Resolution      uint16
    Mode            uint8
    Expression      uint8
    BackgroundR     uint8
    BackgroundG     uint8
    BackgroundB     uint8
    Scale           uint8
    // For splitting an image into multiple chunks
    HorizontalTotal uint8
    HorizontalChunk uint8
    // All chunks are assumed to be split evenly.
}

func main() {
    if len(os.Args) < 2 {
        panic("No file path provided for Mii data")
    }
    
    miiDataBytes, err := ioutil.ReadFile(os.Args[1])
    if err != nil {
        panic(err)
    }
    
    var expression int
    if len(os.Args) > 2 {
        expression, _ = strconv.Atoi(os.Args[2])
    }
    // 0 expression MUST become 24 or UTF-16BE null string will terminate early.
    if expression == 0 {
        expression = 24
    }

    miiCRC := crc32.ChecksumIEEE(miiDataBytes)
    // Sample data for the RenderParameters struct
    params := RenderParameters{
        //MiiDataHash:     0xDEADBEEF, // Just a sample hash
        MiiDataHash:     miiCRC,
        Resolution:      1024,
        Mode:            0,
        Expression:      uint8(expression),
        BackgroundR:     0,
        BackgroundG:     255,
        BackgroundB:     0,
        Scale:           2,
        HorizontalTotal: 0,
        HorizontalChunk: 0,
    }

    // Convert struct to bytes
    encodedParams := &bytes.Buffer{}
    // not only are the multi-byte numbers big endian...
    // ... but the arrangement in general is for UTF-16BE 
    err = binary.Write(encodedParams, binary.BigEndian, params)
    if err != nil {
        panic(err)
    }

    // buffer to accomodate zeroes for amiibo, as well as mii data at the end
    buf := make([]byte, 172)
    // Fill amiiboData as needed, example:
    buf[0x2C] = 0x10
    copy(buf[0x4C:], miiDataBytes)
    copy(buf[0x38:], encodedParams.Bytes())

    // Prepare and send the POST request
    resp, err := http.Post("http://127.0.0.1:12345", "application/octet-stream", bytes.NewReader(buf))
    if err != nil {
        panic(err)
    }
    defer resp.Body.Close()

    // Read the response (for demonstration purposes)
    responseBody, _ := ioutil.ReadAll(resp.Body)
    println(string(responseBody))

    // Asynchronous request example (commented-out)
    /*
        go func() {
            resp, err := http.Post("http://127.0.0.1:12345", "application/octet-stream", bytes.NewReader(amiiboData))
            if err != nil {
                log.Println("Error sending async request:", err)
                return
            }
            defer resp.Body.Close()

            if resp.StatusCode >= 400 {
                log.Println("Bad response status code:", resp.StatusCode)
            }
        }()
    */
}

