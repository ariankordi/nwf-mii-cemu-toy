# nwf-mii-cemu-toy
Locally hosted Mii renderer using Nintendo Web Framework's Mii extension.

Not recommended for actual use as of now. Actual Mii renderer is planned soon using the [FFL decomp](https://github.com/ariankordi/FFL-Testing).
## unfinished
This project has been at a standstill since I realized some of its conceptual flaws and pretty much didn't feel like working on it any further, at least for the backend - the frontend I'll still update.
### directions
Don't expect support from me for any part of this process, but here's a brief tutorial on how to get this up.
* Craft a NWF app, copying `index.html` and `js` from `nwf-app` into your game's `content/app` folder.
* In order for this to work, you **need** an app with the following extensions:
    - `jsextension_ext-mii-private.rpl` (Mii renderer, essential)
        * The Mii extension won't work without FFLRes files in `0005001B10056000`, or the `content/assets/ffl` folder.
    - `jsextension_ext-amiibo.rpl` (mechanism in which to quickly receive Mii data)
        * You can probably rework this to not require the amiibo extension, but it would have to be through something crazy, like, constantly polling `nn::act::GetMiiEx` with an arbitrary slot or something since this is already using out-of-tree Cemu mods.
    - `jsextension_ext-fileio.rpl` and `jsextension_ext-eval.rpl` are both required for the JS REPL, which you may or may not use.
        * While `eval` is required for running custom code, file-based communication is our only form of data in or out. However, if you can get networking functioning, that can be another option along with OSConsole via nwf.utils.log().
    - All extensions need to be copied to `code` and then they need an entry in `config.xml` in order to be enabled.
        * If JS stops working after you try to sideload an extension, then, that extension is probably incompatible with the SDK version of your game.

You can use the following game as a base, as it contains the first two extensions and should be all you need: `00050000101CFA00` (Word Puzzles by POWGI)

You can extract the eval and fileio extensions from `00050000101E7900` (SPLASHY DUCK)

If you want to experiment with extensions, please make sure the `nwf:version` matches in the game/s `content/app/config.xml` (v33 is the latest), and the SDK versions match by viewing the strings (1.9.5 is the last)
* Compile Cemu, applying the patches in `2024-03-23-cemu.diff` to your tree.
    - Cemu has build instructions here: https://github.com/cemu-project/Cemu/blob/main/BUILD.md
    - You also need to add `processor-go/ipc.h` to `Cemu/src/Cafe/HW/Latte/Renderer/Vulkan/` before compiling.
    - If there's conflicts while merging, try to use older Git revisions of Cemu from around the time these commits were made to this repo. This hasn't been tested with the latest Cemu revisions as of writing this.
* Run Cemu and the game, which should show some black text on a white background.
    - Make sure that your MLC has all files necessary for working with Miis. In other words, if games like New Super Mario Bros. U or anything else that uses Miis crashes, this will pretend to work but won't work.
* If you want to play with the REPL, open `python playground/repl3.py`, using the game's `/user/common/temp/` folder (only exists when it is open), and try typing some JS commands after you've initialized it.
* Compile and run `processor-go` by going into the directory, running `go build`, and then `./processor-go`.
    - This is the main web server for this service.
    - It only supports one request at a time.

Example request: `/render.png?type=face&expression=normal&width=512&scale=2&bgColor=%2300ff00&data=data=AwFAMJoQIAAdfpgjULENrXILeXYnoAAAARxKAGEAcwBtAGkAbgBlAAAAAAAAABMhEwB7ASFuQxoNNMcWAAYSwgwAACmzU0hQAAAAAAAAAAAAAAAAAAAAAAAAAAAAALs%2B`

You should be able to see the frontend if you head to / on the web server.

Usually Cemu will consume an excessive amount of CPU if you're not on Windows. The program should automatically suspend and unsuspend the Cemu process, making it look frozen when it's really not (it may also suspend Cemu while it's loading the game, so load it first and then open the server). As of writing, this suspending mechanism doesn't quite work on Windows - the process is able to be suspended but not unsuspended...

### Localization Credits!!!
Thanks to @GabIsAwesome for the Portuguese (Brazil) translation.

~~All other translations are AI-generated.~~
