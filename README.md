
nwf-mii-cemu-toy
# Mii renderer using nwf.Mii running in Cemu
A Mii renderer designed by a script kiddie who doesn’t want to learn binary hacking. 

A Mii renderer made by me.


## Synopsis
It renders Miis within a web browser running in a Wii U emulator. Confused? Read on.

## How?
The Nintendo Web Framework is a framework allowing you to write Wii U games in JS. Cool, right? Basically a WebView.

Well, turns out it has a Mii extension that just allows you to render Miis from your game. 
It’s only stills, but it can render these to canvases, and they look exactly like Miis rendered by Nintendo. 
## Why?
For
### Why does it need Cemu?
The Mii libraries used in Nintendo games rely on APIs specific to those consoles.
For instance RFL, or the Revolution Face Library, uses the Wii GX API for rendering. Likewise, the Cafe Face Library, or FFL, uses the GX2 API for rendering.

The GX2 API is only made to work on the GX2 GPU inside the Wii U, even if you already had the source code of the FFL library. This means that without heavy rework done to port it to using another graphics library like OpenGL, which we are absolutely not doing with this because we are literally using completely unmodified binaries from Nintendo, it needs to run on a Wii U or a Wii U emulator.

It would, in theory, be possible to render Miis with this on an actual Wii U with some rework. However, the Nintendo Web Framework makes it difficult to use networking on release builds, and on a debug build, you must use debug plugins, and we don’t have one for the Mii extension. Because I believe that running a Wii U 24/7 is impractical and draws more power than if you just ran Cemu on any modern computer…

(Remember: the Wii U is so old it doesn’t implement something as simple as frequency scaling.)

… this is using Cemu for the time being. I really, sincerely wish it didn't have to be like this. Trust me, I wish that the mostest uber est fastestest Mii renderer (UFL: Ultimate Face Library!!!! 😼) could run on ARM and use Vulkan or whatever, but this is our reality.


After all, I am a script kiddie.
#### There’s a decomp, can’t you just replace the GX2 calls with OpenGL calls, or something?
This would require a ton of effort because while (todo add info from https://github.com/aboood40091/GX2-Tests)
In theory, yes, after you do the rest of the work to make the library work outside of the Wii U environment.

But you can’t work with _just_ FFL alone, as I highlight in a later FAQ section. 

## Comparison
|                  | nwf-mii-cemu-toy | NNID Renderer | Mario Kart Wii                   | Studio Renderer                      |
|------------------|------------------|---------------|----------------------------------|--------------------------------------|
| Style            | Wii U (FFL)      | Wii U (FFL)   | Wii (RFL) (TBD IT MAY BE CUSTOM) | Miitomo, Switch, 2.0 (AFL/nn::mii?) |
| Accepts Mii data | ✅                |               | 🏚                                | ✅                                    |
| Expressions      | All              | Some (6)      |                                  | All                                  |
| Full Body        |                  | ✅             |                                  | ✅                                    |
| Self-hosted      | ✅                |               | 🏉                                |                                      |
| Resolution       | Up to 1080px     | 96px, 128px   |                                  | 96px to 512px                        |
| Instance Count   |                  |               |                                  | ✅                                    |
| Cam/Pos Control  |                  |               |                                  | ✅                                    |
|                  |                  |               |                                  |                                      |
|                  |                  |               |                                  |                                      |
| Speed            | Up to 5s 🫠       |               |                                  | Instant ✅                            |

f

f

f

f

g

f

g

gf

# Running
If you mean running away, by all means, feel free. In terms of installing this, it will be complex, so brace yourself. 


# FAQ
Look here for troubleshooting, but I’ll also answer questions about other renderers. You can ask more questions by making an issue. 
### What about PF2M’s Mii Renderer, or mii.tools, or mii-js, which Pretendo uses?
All of these use Nintendo’s studio.mii.nintendo.com site for rendering. This was introduced in late 2018, I believe?
Now, don’t get me wrong, it’s a fantastic way of rendering 

But as we continue to further custom servers for the Wii U and 3DS era, I think it’s crucially important to reduce any reliance on Nintendo, which this is a direct example of. In a sense, it feels kind of wrong to mooch off of Nintendo servers for this, even if we have no other choice, especially knowing that they could just pull the plug on this at any time. I’m honestly astounded how the API for this managed to exist in this way, and Nintendo probably knows that people are using it this way, to begin with.

Not to mention, it’s kind of out of place for switch me to appear on the 3DS and we you, especially in places, like Miiverse, and ESPECIALLY when studio-rendered Miis have had incorrect lighting on Pretendo for the longest time…
### What about the FFL decomp?
As insane as it is that someone actually decompiled it, something that I wouldn’t think I would ever have seen in years prior, it’s sadly not everything we need in order to render me exactly like the Nintendo service. 
### What about the way that MrBean35000VR renders Wii-style Miis on the CTGP Revolution leaderboards? https://www.chadsoft.co.uk/time-trials/players/1C/A9763E027891C5.html
Wait, what?!
### What about the symbols for “AFL” in the export table of libcocos2dcpp.so/dylib in Miitomo binaries?
👀
### Why don’t you just put the work into making your very own custom Mii renderer from scratch?
I’m sorry, ~~I don’t speak watermelon~~. That is just WAY too much work for my monky brain to comprehend doing…

You’d probably spend a majority of your time in misery looking at decompiled code, or spend days wondering why your renders aren’t 1:1 with the official renderer.

Ultimately, Miis are still Nintendo IP anyway, so if you’re already going to be Infringing™ you may as well take the path of least resistance while you’re at it. 
### But uhhh uhhh... [I remade the Mii Maker in Blender AND IT'S FREE](https://www.youtube.com/watch?v=8lrBrbdAn6w)
No. No. It's just not the same! 😭

### Will requesting a Mii in a lower resolution result in a faster response?
I know nobody will actually ask this, but I know that some may ask themselvessc in their head, so I will provide the answer: **No.**

The time you have to wait to get a response from this involves waiting for the Mii to transfer to Cemu, waiting for it to render out, copying the pixels and encoding them. The last few steps are blazing fast compared to waiting for Cemu, which relies on the slow, emulated CPU.

The time spent encoding is minuscule in comparison, especially if you use JPEG or HEIC which can make use of hardware accelerated encoding. Either way, the size of the image output, regardless of any format, even PNG, is going to be tiny because Miis aren’t very complex, they compress well.

So, go ahead and request your Mii in 128px or 256px, instead of considering 96px or lower.

---
page? or also put in readme too?:

# Conceptual Flaws
**TL;DR: For the love of God, do not rely on this website! Handle errors and look out for greenscreen remnants, or specify a custom background!!**

This
* Slow processing

The process to send and render a Mii is actually pretty quick, it's just the screenshotting and excavation from the emulator that takes a while.

With all that being said, realistically speaking, for something like an account server or another service that can _cache_ our images... it's not like you're constantly rendering the same person's Mii. It should be FINE.
* No alpha channel, we have to rely on chroma-key.

This actually isn't as bad as it sounds in this context. Since the models come out aliased and jaggy-looking, we can actually remove the background pretty solidly. The issue comes into play when you either have a character with large eyes or glasses, which have fuzzy areas around them, or huge glasses that are supposed to have transparency in general.

Of course this is FAR from ideal

, I was in denial for a bit

If you are about to plug this into something like a Miiverse clone, you may want to select a static background color - when you do, this avoids any issues with green spill.

* Max resolution of 1080/540 at 2x downscale.

Since we have nothing but screenshots, we are restricted to outputting the screen size of the system, 1920x1080. We could in theory chunk out the
, but I don't know that I want to spend that much more effort on that, given the state of everything else.

Since all renders from this are jaggy and don't look great compared to any others, in order for the images to look remotely good, we would need to render them at twice the resolution you request them at.

Thankfully, 1080 divided by 2 is 540 and that resolution should be the max you could possibly want, after all 512 is the maximum that Mii Studio will give you.

We could in theory render at a max of 1600 (NWF's maximum but can probably be binary hacked to be higher) to give you 800, and scale on the Wii U side, or just, downscale everything on the Wii U side to save screen real estate. Problem with that is that it fuzzes out the corners, which completely ruins the concept of having a perfect chroma-key with minimal processing.

* Occasional failure/timeouts

This one is lower on the list because I'll try to handle them as best as I can, but, for sometimes for some unexplainable reason, the NWF Mii renderer just fails.

It will either put out a blank image, or an image that looks, withered away? (TODO find a screenshot of this to put here)

I'll try to detect these and make it regenerate the image, although this will add more time. I'm pretty sure whenever one of these fails happens it logs it to OSConsole but I mean, I don't think I can do anything about it.

Now, my algorithm to detect images that are blank or withered away is to check if the very middle pixel is present or not. That's a pretty low bar, so some withered or corrupted images may get through. Just be mindful of that.

**You should always inspect the images this generates in general.** For instance, if you're rendering a batch, go ahead and find a way to view all of the images - shouldn't take that long.

Timeouts happen when we do not see the image that NWF generates when we expect.

* No full body images. (TBD MAYBE NOT INCLUDE THIS)

We're sorry, but NWF just doesn't support this. I know how bummed out you must be to not be able to see your or your friend (amiga)'s Mii's seggsy body in 8K.

Given everything else surrounding this, I'm surprised it works as well as it does, and you should be too. The Mii libraries on each system are usually involved with rendering faces, and rendering bodies requires bringing in your own models. I have no doubt that with direct FFL calls we could get it to work, or maybe even if we hacked the NWF renderer's viewport,

## Proposed fixes?
If you want to help out and you are skilled with 

Particularly if you are a Cemu developer, I'd love to talk to you!
* Fixing exporting canvases in NWF in Cemu

For some reason I don't understand, on Cemu when you call getImageData or toDataURL on a canvas in any NWF game, the output is garbage and unusable. However, this doesn't happen in the web browser. That shouldn't be surprising to anyone who is familiar with NWF, since it adds more functionality and probably optimizations to their canvas implementation.

The fact of the matter is that, since we can't export the canvas, there's no easy way to get these Mii images out, other than... screenshots. Using those adds complication too, since we have to invent a new way to know which output image is which.

Fixing NWF canvases would make it very simple and straightforward to run this as a server, although not the most efficient, as the PNG encoding would be happening in the emulated Wii U, and we aren't able to use a fast PNG encoder, or JXL, WebP, AVIF, HEIC, AVCI, whatever.

* Adding a hack to dump every rendered Mii buffer to Cemu

By looking at the GX2 call logs when rendering a Mii, it's obvious that it allocates a new color buffer for each one. Therefore, logically, if you are able to get in right before they clear it, you could extract a perfectly pristine Mii image in RGBA format (transparency), which also shouldn't be restricted by the TV resolution in any way.

This is probably the preferred method over extracting the canvas since we would get a raw bitmap we can encode any way we want, even if we still do have to solve the problem of identifying the Mii somehow - If we're binary hacking already, I mean, it comparatively shouldn't be that much work.

* God mode: FFL decomp, WITH body rendering

I already brought up in the readme that, while there is an FFL decomp out there, FFL doesn't handle bodies at all. Well... yes, and no.
I have found this "FFLBodyRes.dat" file in 

If some absolute chad can make a renderer with the FFL decomp, with a huge amount of functionality and e.g directly write to files,

that would be epic

, it would be very trivial to make a server out of it.

