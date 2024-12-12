## Arian's Mii Renderer (REAL) frontend (as of late 2024)
* Looking for the old rusty method of running a Mii renderer with Cemu? See the master branch: https://github.com/ariankordi/nwf-mii-cemu-toy/tree/master
* This branch is meant to integrate with [my FFL-Testing renderer-server-prototype branch](https://github.com/ariankordi/FFL-Testing/tree/renderer-server-prototype), serving as the frontend of https://mii-unsecure.ariankordi.net.
* It provides: the localized frontend/JS, NNID fetch API, and load balancing.
* **Impromptu directions for setting THIS repo up should also be located there...**

### How do you rehost NNID fetching if the account.nintendo.net/v1/api/miis endpoint has been down since May 2024?
It works by looking up the NNID in a database full of all NNID Miis, scraped by me from the Wii U friend presence server, on April 8th (although it is still online).

This is neat because it actually contains Miis of deleted NNIDs and even NNIDs that never used a Wii U, the one downside being it doesn't provide Mii render URLs (but that's a problem this project solves right?)

I have made both my scrapes (in Python pickle format), as well as the MariaDB database I populated with it, available through these MEGA links!

**Get them while they're fresh, won't last forever:**
* MariaDB database: https://mega.nz/file/HWJh2BrA#qoJ4Vn_Sdy7b1vWJqjGR9uVvs-yYRQJLaPmu2g2nMdE
* Original dump and scripts should be here too (**grab this one**): https://mega.nz/file/SboWHRrK#_5vuSzFAkyvz9lGy7RBqwAh3CN0OHCRQ9AbYn-Kd09s

<details>
<summary>Some words on the setup process if you want to try:</summary>


**Note: I haven't... necessarily tested rehosting the database on another machine. Reach out to me if it does or doesn't work so I can update the status and potentially fix the dumps. Thanks.**

* The MariaDB database has been tested on 11.4.3-MariaDB-1.
* Username and password is `miis:miis`.
* This is how I run it: `/usr/sbin/mariadbd --datadir=/mnt/arian-2t/nwf-cemu-setup/2024-06-04-mii-data-map-database-again-mysql/ --innodb_log_file_size=256M --innodb_buffer_pool_size=1G'`
* You will need to pass the connection string into the web server arguments, for example: `-nnid-to-mii-map-db "miis:miis@unix(/run/mysqld/mysqld.sock)/miis?parseTime=true"`
</details>

* though I should reeeeally really repost the scripts for doing this on GitHub Gist and also the dumps themselves on archive.org oh god I have forgotten to do this for moooooooonthhhhsssssssHHHHHHHHHHHHHHHHHHH
   Due to the realization that the original dump was in April and these scripts still haven't been released, I have put these scripts in 


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

**This documentation does not include the /miis/image.(png, glb, tga) API because I'm tired.**
