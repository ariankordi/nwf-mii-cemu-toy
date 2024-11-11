## Arian's Mii Renderer (REAL) frontend (as of late 2024)
* Looking for the old rusty method of running a Mii renderer with Cemu? See the master branch: https://github.com/ariankordi/nwf-mii-cemu-toy/tree/master
* This branch is meant to integrate with [my FFL-Testing renderer-server-prototype branch](https://github.com/ariankordi/FFL-Testing/tree/renderer-server-prototype), serving as the frontend of https://mii-unsecure.ariankordi.net.
* It provides: the localized frontend/JS, NNID fetch API, and load balancing.


### (Impromptu) API documentation...
**/mii_data/{nnid} - fetches mii data for an NNID**

response is json representing nnid data including the mii data as FFSD, if you request with `Accept: application/octet-stream` the response will be the FFSD data as binary

query parameters:
* api_id: set this to 1 for pretendo (was originally designed in mind for multiple nnid servers)
* pid: in absence of an nnid, you can set this to search for a pid instead (numeric, internal nnid identifier)

**/miitomo_get_player_data/{player id} - fetches kaerutomo player own_mii and stock_mii information**

you can find your player id by copying your friend request invite link, it's the 16 character hex string after "friend_code/"

query parameters:
* target_player_id: optional, but if you specify this multiple times you will be able to search for multiple users
* namespace: optional with default of own_mii and stock_mii, you can set this multiple times, this is the miitomo player information namespace... if you set this to own_mii, you will get that player's mii, if you set to stock_mii you will see that player's sidekick miis, if you set it to mii_face_image you will get the render that player's app uploaded, though this is not defined by me.

**/cmoc_fetch/{cmoc id} - fetches RFLStoreData wii mii data from the wiilink cmoc api**

the cmoc id is the same format you see on the site: 1234-5678-9123

returns RFLStoreData in base64, or in binary if you set `Accept: application/octet-stream` header

no query parameters

**This documentation does not include the /miis/image.(png, glb, tga?) API because I'm tired.**
