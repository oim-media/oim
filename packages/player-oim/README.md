# @oim-media/player-oim

`<oim-player>`: a framework-free web component that shows an
[OIM](../../README.md) interactive image. It reads the metadata hidden in the
`.oim` PNG, verifies the signature, and composes the layers, animations and
interactions on top of the base image.

A `.oim` file is still a PNG. Where there is no OIM player, the picture is still there.

## Install

```bash
pnpm add @oim-media/player-oim
```

The package is published to GitHub Packages. Your `.npmrc` must map the scope to
that registry, and the token needs the `read:packages` scope even for this public
package. See the [install section](../../README.md#install).

Two ways to load it:

```js
// 1. As a module (bundler or native ESM). Registers <oim-player> on import.
import "@oim-media/player-oim";
```

```html
<!-- 2. As a classic script: one file, defines <oim-player> and window.OimPlayer. -->
<script src="node_modules/@oim-media/player-oim/dist/oim-player.js"></script>
```

The second form is also reachable as the subpath `@oim-media/player-oim/cdn`.
The single file is about **59 KB gzip** and includes the verifier. Lottie is not
in it: it is loaded from `dist/vendor/` only when a file uses it. A test keeps the
file under a 59 KB budget.

## Usage

```html
<oim-player src="/art/poster.oim.png" lang="en" fit="cover" placeholder="/art/poster-thumb.jpg"></oim-player>
```

`src` is required. Anything the element reads as an attribute can also be set
through the JS API below.

## Attributes

Attributes marked *observed* take effect when they change at runtime. The others
are read when the file loads; changing them afterwards does nothing until `src`
changes again.

| Attribute | Default | Values and behaviour | Observed |
|---|---|---|---|
| `src` | none | URL of the `.oim` file. Setting it again reloads the element. | yes |
| `placeholder` | none | Thumbnail shown until the engine paints. Only `http:`, `https:`, `blob:` and `data:image/` URLs are used; anything else is ignored. A thumbnail that fails to load is removed. | yes |
| `lang` | `en` | Language of the text layers. Changing it switches language without reloading. With no `lang`, the player uses English; if the file has no text in that language, it falls back to `en`, then `es`, then the first language present. | yes |
| `activate-on` | visible | `hover`: the file moves only while the pointer is over it (on devices with a pointer; touch devices behave as `visible`). `manual`: the page decides with `play()` and `pause()`. Visibility still decides when the file is built. | yes |
| `fit` | `contain` | `contain` or `cover`. | yes |
| `align` | `center` | `center`, `top` or `bottom`. | yes |
| `dropdown-blur` | on | Deprecated: no effect, removed in 2.0.0. | yes |
| `allow-lottie` | on | `false` disables Lottie layers. | yes |
| `palette` | document default | Name of one of the file's palettes. Unknown names are ignored. Applies only when `allow-dynamic-colors` is on. | yes |
| `auto-rotate-lang` | off | Milliseconds between the languages present in the file. Non-numeric or non-positive values use 3000 ms. Stops while the player is paused. | yes |
| `disable-animations` | from `mode` | `true` stops animations, `false` enables them even without `mode="full"`. Reduced motion (`prefers-reduced-motion: reduce`) always stops them. | yes |
| `disable-actions` | from `mode` | `true` disables clicks and hover actions, `false` enables them. Reduced motion does **not** disable actions. | yes |
| `mode` | still | `full` enables animations and actions. Any other value, or no value, means still. The `disable-*` attributes override it. | yes |
| `show-slots` | `true` | `false` draws only the base image; interactive layers are not drawn. | yes |
| `allow-zoom` | off | `true` enables wheel, pinch and drag zoom. Only the exact value `true` enables it. | no |
| `allow-dynamic-colors` | on | `false` stops the file's named palettes from being applied (no `--oim-palette-*` values are written). | no |

Precedence for `mode`, `disable-animations` and `disable-actions`, strongest first:
the `mount()` options, then the attribute, then `mode`, then the default. Reduced
motion overrides the animation setting only.

`show-controls` is set by `OimPlayer.mount()`. Deprecated: no effect, removed in 2.0.0
(see [Known gaps](#known-gaps)).

## JavaScript API

### `OimPlayer.mount(container, src, options?)`

Creates an `<oim-player>` inside `container` (an element or its `id`) and replaces
the container's children. Returns the element, or `null` (with a console error) if
the container does not exist. `mount` is also a named export.

```ts
import { OimPlayer, type OimPlayerOptions, type OimPlayerInstance } from "@oim-media/player-oim";

const options: OimPlayerOptions = { fit: "cover", align: "top", allowZoom: true };
const player: OimPlayerInstance | null = OimPlayer.mount("hero", "/art/poster.oim.png", options);
```

| Option | Type | Effect |
|---|---|---|
| `allowZoom` | boolean | Same as `allow-zoom`. |
| `allowDynamicColors` | boolean | Same as `allow-dynamic-colors`. |
| `showSlots` | boolean | Same as `show-slots`. |
| `allowLottie` | boolean | Same as `allow-lottie`. |
| `disableAnimations` | boolean | Overrides the attribute and `mode`. |
| `disableActions` | boolean | Overrides the attribute and `mode`. |
| `dropdownBlur` | boolean | Deprecated: no effect, removed in 2.0.0. |
| `showLanguageSelector` | boolean | Deprecated: no effect, removed in 2.0.0. |
| `fit` | `contain` or `cover` | Same as `fit`. |
| `align` | `center`, `top` or `bottom` | Same as `align`. |
| `placeholder` | string | Same as `placeholder`. |

### Element members

| Member | Description |
|---|---|
| `src` | Get or set. A `Blob` can be set as a property; a string also sets the attribute. |
| `lang` | Get or set. |
| `languages` | Read-only array of the languages the file has, derived from its layer content. Empty until the file has loaded. |
| `currentLang` | Read-only. The language being shown. |
| `getMetadata()` | The parsed metadata, or `null`. Calling it loads the file if it has not loaded yet. |
| `getSecurityStatus()` | One of the [security statuses](#security), or `null` before loading. Also loads the file. |
| `setLang(lang)` | Switches language and loads the file if needed. |
| `setZoom(zoom)` | Sets the zoom factor, clamped to the engine's limits (1 to 4). |
| `play()` / `pause()` | Starts or stops animations. `pause()` adds the `oim-player-paused` class. |
| `seek(time)` | No effect on `.oim` files: the image engine has no timeline. |
| `getEngine()` | The internal engine object. Not a stable API. |
| `destroy()` | Releases the engine and removes the element from the DOM. |

## Events

All events are dispatched on the `<oim-player>` element. `oim:incomplete` and `oim:unsupported` bubble and cross shadow boundaries; the others do not.

| Event | `detail` | When |
|---|---|---|
| `oim:loaded` | `{ type: "image", metadata, security }` | The file has been verified and painted. |
| `oim:action` (cancelable) | `{ slot, name, trigger, targets, types }` | A layer with actions is activated. `slot` is the internal id; `name` is the author's layer name, and names are not unique. Call `preventDefault()` to skip the player's own effect. A file cannot navigate by itself: listen and navigate in your page. |
| `oim:langchange` | `{ lang }` | The language changed. |
| `oim:incomplete` | `{ message, mensaje, ...MissingSupport }` | The file asks for something this player lacks, or needs a newer contract. |
| `oim:unsupported` | `{ message, mensaje, ...MissingSupport }` | As `oim:incomplete`, and the player cannot render the file faithfully (`cannotRender` is `true`). |
| `error` | the error | Loading failed, or the file was refused because it was altered. |

`MissingSupport` has `requiredVersion`, `versionTooOld`, `missingCapabilities`,
`missingRequiredCapabilities` and `cannotRender`.

**Deprecated key.** `detail.mensaje` is the Spanish name of `detail.message` and
holds the same text. It is kept for existing embedders and **removed in 2.0.0**,
the same policy as the Spanish `data-oim-*` attributes. Use `message`.

```js
el.addEventListener("oim:incomplete", (e) => {
  console.warn(e.detail.message, e.detail.missingCapabilities);
});
```

## State attributes

The engine sets these on the `<oim-player>` element. Each is written under its
English name and its Spanish legacy name, which is kept until 2.0.0.

| English | Legacy | Set when |
|---|---|---|
| `data-oim-loaded` | `data-oim-cargado` | The engine has been created. Space is reserved until this is set. |
| `data-oim-unsigned` | `data-oim-sin-firma` | The file has no signature. Only the base image is shown. |
| `data-oim-key-retired` | `data-oim-clave-retirada` | The file was signed with a key this player no longer trusts. Only the base image is shown. |
| `data-oim-unsupported` | `data-oim-sin-soporte` | The file uses capabilities this player lacks. Space-separated names. |
| `data-oim-missing-required` | `data-oim-requeridas-faltantes` | The file requires capabilities this player lacks. Space-separated names. |
| `data-oim-required-version` | `data-oim-version-exigida` | The file needs a newer contract. The value is the version. |

Elements inside the player also carry `data-oim-group` (legacy `data-oim-grupo`).
Three have no Spanish alias: `data-oim-passthrough` on slots that ignore pointer
events, `data-oim-flip` on flipped layers, and `data-oim-lottie` on the Lottie
script element.

Until `data-oim-loaded` is set, the element reserves 200 px of height so that a
list of players does not collapse. An author rule always overrides that height.

## CSS hooks

| Hook | Use |
|---|---|
| `.oim-player-host` | Class added on connect. The element is a box. |
| `.oim-player-paused` | Class added by `pause()` and removed by `play()`. Animations inside are paused. |
| `::part(viewport)`, `::part(overlay)`, `::part(base)`, `::part(error)` | Style the parts of the player's shadow tree. |
| `--oim-color-<role>` | Overrides a colour role used by layers. Set it on the element or an ancestor. |
| `--oim-palette-<role>` | Written by the engine from the active palette. Read it; do not set it. |

Colour roles: `primary`, `on-primary`, `secondary`, `on-secondary`, `surface`,
`on-surface`, `outline`, `accent`, `text-primary`, `text-secondary`, `text-muted`,
`text-on-accent`.

Parallax tracks set `--oim-parallax-unit` (one loop length in px) and, when the
layer pauses on hover, `--oim-parallax-hover: paused`. The unit also has a Spanish
alias, `--oim-parallax-unidad`, with the same value.

## Security

The player verifies the signature before it shows anything. The verifier runs in a
Web Worker when the page allows one, and on the main thread otherwise. It checks the file's metadata against the signature, and the image's
SHA-256 against the sealed `image_hash`.

`getSecurityStatus()` returns one of:

| Status | Shown | Meaning |
|---|---|---|
| `verified` | yes, full | Signed and intact, with an author. |
| `verified_authorless` | yes, full | Signed and intact, with the `public` re-edit permission. The stamp does not claim the file is the original. |
| `image_unsealed` | yes, full | Signed before the image seal existed. The metadata is verified; the image is not checked. |
| `unsigned` | base image only | No signature. Interactive layers need one. |
| `expired_key` | base image only | Signed with a key past its `verify_until` date, judged by the device clock. Ask the author to export again. |
| `invalid_signature` | **no, refused** | The metadata was altered after signing. An `error` event is raised. |
| `image_mismatch` | **no, refused** | The image does not match the sealed hash. An `error` event is raised. |
| `no_metadata` | base image | The PNG has no OIM metadata. |
| `corrupt` | no | The metadata does not match the contract. |

Keys: the player embeds the public keys published in `@oim-media/spec`'s
`keys.json` (`v1` and `v2` at this release). A key it does not embed is requested
from `https://api.oim.media/v1/media/keys`. A page can point that at its own
backend with `window.OIM_PLAYER_CONFIG = { keysUrl: "..." }`, set before the
player loads. The player never holds a private key.

Network use: the `.oim` file itself, the key endpoint when needed, and the Lottie
library from the package's `dist/vendor/` when a file uses Lottie. The player makes
no analytics requests.

A valid signature proves the file has not changed since it was signed. It does not
prove that the file is the original work: a `public` file can be re-signed by
anyone.

## Bundle size

`dist/oim-player.js` (the classic-script build) is **59.0 KB gzip** at this release
(60,443 bytes by Node's default gzip). The test budget is 59 KB. The bundle imports
`@oim-media/core` by file rather than by package index, which keeps zod out of it.

## Changed in 1.26.0

- The default language is **English**. Before 1.26.0 the player defaulted to
  Spanish when `lang` was not set, so a file with both languages showed Spanish.
  Now it shows English. Set `lang="es"` to keep Spanish.
- The fallback order for a file that lacks the requested language is unchanged.
- No format change.

## Known gaps

These are deprecated: they are accepted and stored, but do nothing. Removed in 2.0.0:

- `showLanguageSelector` (option) and `show-controls` (attribute, set by `mount`).
- `dropdownBlur` (option) and `dropdown-blur` (attribute).

`seek()` is a no-op for `.oim` files.

## Licence

Apache-2.0. Lottie is third-party and carries its own licence; see
`dist/THIRD_PARTY_NOTICES` in the published package. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
