# @oim-media/player-ovm

`<ovm-player>`: a web component for `.ovm` interactive video, the video
counterpart of [`@oim-media/player-oim`](../player-oim/README.md). It plays the
video with the browser's own `<video>` element and draws text layers on top of it,
positioned by the tracking data stored in the file.

**Current state: minimal.** It is a single vanilla-JS file with no build step. It
has no signature verification, no events and no playback API of its own. Treat it
as a working reader for simple text overlays, not as a complete player.

## Install

```bash
pnpm add @oim-media/player-ovm
```

The package is published to GitHub Packages. See the
[install section](../../README.md#install) for the `.npmrc` lines.

```js
import "@oim-media/player-ovm"; // registers <ovm-player>
```

## Usage

```html
<ovm-player src="/video/intro.ovm" lang="en" autoplay></ovm-player>
```

The element sizes itself to a 16:9 box with a black background.

## Attributes and properties

| Name | Kind | Behaviour |
|---|---|---|
| `src` | attribute and property | URL of the `.ovm` file. Setting it loads the file. Read back as a string, empty if unset. |
| `lang` | attribute and property | Language for the text. Default `es`. Changing it redraws the text. Falls back to `en`, then `es`, then empty. |
| `autoplay` | attribute | If present on connect, the video starts automatically, subject to the browser's autoplay rules. |

## How a file is read

The metadata is looked for in three places, in order:

1. The video header, where the `OVM_Metadata` block is written.
2. The last 64 KiB of the file, fetched with a range request.
3. A sidecar file at `<src>.json`, fetched with a plain request.

If none of them yields metadata, the element shows "No OVM metadata found".

The metadata is checked for shape only. A file that fails the check shows
"Corrupted or Tampered OVM file" and is not played.

## What is drawn

For each slot in the metadata that has text in the current language, the element
creates a `div` over the video. Its position comes from `tracking_data` keyframes
at the current time, or from the static `position` when there is no tracking.
Colour, font size and font family come from the slot's `style`. Only
`fillColor`, `fontSize` and `fontFamily` are read.

Slot text is inserted as text, not as HTML.

## Not included yet

- **No signature verification.** The metadata is trusted as read. Do not use this
  player for files whose authorship or integrity matters until verification is added.
  The `oim-player` verification path is the reference.
- **No events.** Nothing is dispatched.
- **No playback API.** There are no `play()`, `pause()` or `seek()` methods on the
  element. Control the video through the browser's native `<video>` element.
- **Only text layers are drawn.** Image, vector and other layers are not rendered.

## Licence

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
