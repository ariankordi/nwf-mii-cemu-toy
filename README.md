## Arian's Mii Renderer (REAL) frontend (2024, 2025, 2026)

Contains the frontend JavaScript + Mii conversion and QR code logic, NNID fetch API, and load balancing for the backend renderer.

* If you're looking for the site, it's here: [mii-unsecure.ariankordi.net](https://mii-unsecure.ariankordi.net)
* If you're wondering why it's called what it is, that's because it is [effectively forked from an older experiment linked here.](https://github.com/ariankordi/nwf-mii-cemu-toy/tree/master)
* This frontend is meant to integrate with [my Mii renderer server "FFL-Testing"](https://github.com/ariankordi/FFL-Testing/tree/renderer-server-prototype).

The [Mii QR code logic](/assets/js/qr/) may be helpful for other projects, and is Zlib licensed.

### How do you rehost NNID fetching if the account.nintendo.net/v1/api/miis endpoint has been down since May 2024?
It works by looking up the NNID in a database full of all NNID Miis, scraped by me from the Wii U friend presence server, on April 8th (although it is still online).

This is neat because it actually contains Miis of deleted NNIDs and even NNIDs that never used a Wii U, the one downside being it doesn't provide Mii render URLs (but that's a problem this project solves right?)

I have made both my scrapes (in Python pickle format), as well as the MariaDB database I populated with it, available through these MEGA links!

**Get them while they're fresh, won't last forever:**
* MariaDB database: https://mega.nz/file/SboWHRrK#_5vuSzFAkyvz9lGy7RBqwAh3CN0OHCRQ9AbYn-Kd09s
* Original dump and scripts should be here too (**grab this one**): https://mega.nz/file/HWJh2BrA#qoJ4Vn_Sdy7b1vWJqjGR9uVvs-yYRQJLaPmu2g2nMdE

<details>
<summary>Some words on the setup process if you want to try:</summary>


**Note: I haven't... necessarily tested rehosting the database on another machine. Reach out to me if it does or doesn't work so I can update the status and potentially fix the dumps. Thanks.**

* The MariaDB database has been tested on 11.4.3-MariaDB-1.
* Username and password is `miis:miis`.
* This is how I run it: `/usr/sbin/mariadbd --datadir=/mnt/arian-2t/nwf-cemu-setup/2024-06-04-mii-data-map-database-again-mysql/ --innodb_log_file_size=256M --innodb_buffer_pool_size=1G'`
* You will need to pass the connection string into the web server arguments, for example: `-nnid-to-mii-map-db "miis:miis@unix(/run/mysqld/mysqld.sock)/miis?parseTime=true"`
</details>

* though I should reeeeally really repost the scripts for doing this on GitHub Gist and also the dumps themselves on archive.org oh god I have forgotten to do this for moooooooonthhhhsssssssHHHHHHHHHHHHHHHHHHH
   - Due to the realization that the original dump was in April and I still haven't gotten around to formally releasing these, I have put these scripts in `2024-06-nnid-scrape-scripts`. No instructions are provided, and they probably don't work either.
