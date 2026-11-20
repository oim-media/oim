<!--
Copyright (c) 2026 Xue Studios LLC
SPDX-License-Identifier: Apache-2.0
-->

# OIM 2.0 Canonical Specification

**Document version emitted by the reference writer:** `2.0.0-draft.1` (`DOCUMENT_VERSION` in `@oim-media/core/v2`)  
**Contract release this text was checked against:** 1.35.2  
**Status:** Normative  
**License:** Apache-2.0  
**Authority:** Xue Studios LLC

The source of truth is code and data, and this document summarises them:

- the document schema, `packages/core/src/v2/schema.ts` and `layer-blocks.ts`, published as
  [`schema/oim2.schema.json`](schema/oim2.schema.json);
- the container and signing code in `packages/core/src` (`binary.ts`, `canonical.ts`, `limits.ts`) and
  `packages/player-oim/src/render` (`security.ts`, `keys.ts`);
- the reference painter in `packages/scene`.

Where this text and those files disagree, the files win, and the disagreement is a bug in this text.
Section 11 lists the places where the schema allows something the reference painter does not draw.

The key words MUST, MUST NOT, SHOULD, SHOULD NOT and MAY are used as in RFC 2119.

> This document describes **2.0**. The 1.x format is described by [CANONICAL_SPEC.md](CANONICAL_SPEC.md)
> and [BINARY_SPEC.md](BINARY_SPEC.md); it is legacy and no longer painted.

---

## 1. Scope, conformance and versioning

### 1.1. Scope

A `.oim` file is a PNG image that carries, in an ancillary chunk, one JSON document (the **document**)
describing layers painted over a canvas. This specification defines the container (section 2), the
document (section 3), how a reader paints it (section 4), the limits a reader enforces (section 5) and
how a document is signed and verified (section 6).

### 1.2. Conformance classes

- **Writer**: produces a `.oim`. A conforming writer MUST emit a document that validates against
  `schema/oim2.schema.json` (section 3), MUST emit the container of section 2, and MUST NOT emit a
  retired construct (section 2.5, Appendix A).
- **Reader / player**: paints a `.oim`. A conforming reader MUST follow sections 1.3, 2, 4, 5 and 6.
  It MUST NOT execute anything the file carries, MUST NOT request any resource the file names
  (section 5.4), and MUST NOT paint a file whose signature or image seal fails (section 6.4).
- **Signer**: a service that holds a private key and signs documents. A conforming signer MUST validate
  the document before signing, MUST compute `image_hash` itself from the PNG it embeds (never take it from
  the caller), MUST refuse a document with a number that has no canonical form (section 6.2), and MUST
  produce the signature of section 6.3. Verification needs no private key; a verifier is a reader.

### 1.3. Versioning

The root field `oim` is a string matching `^2\.\d+\.\d+(-[\w.]+)?$`. The reference writer emits the
value of `DOCUMENT_VERSION`, currently `2.0.0-draft.1`; every signed vector in `vectors-2/` carries it.

- A reader MUST treat any `oim` that starts with `2.` as a 2.0 document and MUST NOT refuse it for its
  minor, patch or pre-release part.
- A reader MUST NOT paint any other document. The reference player, given a document whose `oim` does not
  start with `2.` (every 1.x file), paints no layer, keeps showing the PNG, and fires `oim:error` with
  `detail.code === "unsupported-version"` on the player element.
- A 1.x file is converted once, by a tool, not by the reader: `upgrade(input)` from `@oim-media/core/v2`
  reads a 1.x document and returns `{ document, retired, unhandled }`. It is pure; it signs nothing. The
  result MUST be signed again before a reader will paint its layers (an unsigned file shows only its PNG,
  section 6.4). `SPEC_2.md` names the command-line form as `oim upgrade`; that tool is not part of this repository.
- A document that is already 2.x is returned by `upgrade()` unchanged.

---

## 2. Container

### 2.1. PNG

A `.oim` is a conforming PNG (ISO/IEC 15948) that starts with the 8-byte PNG signature. Any viewer that
does not know OIM shows it as an ordinary image. The pixels are the **base picture** (section 2.4).

### 2.2. The document chunk

The document is stored in one ancillary text chunk:

| Property | Value |
|---|---|
| Chunk type | `zTXt` |
| Keyword | `OIM_Data` |
| Compression method byte | `0x00` |
| Payload | zlib (RFC 1950) of the UTF-8 JSON text, level 9 |

Layout of the chunk data: `"OIM_Data" 0x00 0x00 <zlib bytes>`.

- The chunk MUST come after `IHDR` and before `IEND`. It MAY come before or after the `IDAT` chunks;
  writers since 1.30.0 put it after the last `IDAT`, and signed vectors exist in both orders. A reader MUST
  accept both.
- The PNG bytes of `IDAT` (and of every other chunk) MUST NOT be re-encoded when the chunk is inserted,
  because `image_hash` covers the `IDAT` payloads (section 6.5).
- A reader MUST also accept the earlier forms: keyword `OIM_JSON_DATA`; a `tEXt` chunk whose value is
  raw deflate bytes, or base64 of deflate, or base64 of plain JSON; and an `iTXt` chunk, compressed or not.
  A reader that has inflated a payload tries zlib first, then raw deflate. Writers MUST NOT emit these forms.
- A reader MUST stop inflating when the output passes **10 MiB** and treat the file as corrupt.
- The JSON text MUST be a single document object (section 3).

### 2.3. Document and PNG

The PNG is not stored inside the document. `image_hash` ties the two together (section 6.5).

### 2.4. The base picture and `oim:base`

The PNG itself is addressable from inside the document as the image source `oim:base`.

- An image layer whose `image.src` is the literal string `oim:base` (also as the `value` or as any entry of
  `modes` of a source exception, or through a `{ ref }` to an image paint whose `src` is `oim:base`)
  declares that **the file's own picture is part of the content**. The reader shows the PNG it already
  holds and does not paint that layer's image again. `oim:base` is valid only in an image layer's
  `image.src`; a paint's `src` (a fill or a stroke) takes only a `data:image/` URI.
- A writer that wants the PNG to be the bottom of the composition SHOULD list one such layer first.
  `upgrade()` writes it first, with id `oim-base`, covering the canvas, and every vector in `vectors-2/` has it.
- **No-thumbnail default.** A writer that does not want image viewers without OIM support to show the layers
  renders into the PNG only the background the author chose (a plain or textured canvas, or a photo) and
  lists the `oim:base` layer. Everything else is painted live from the document. Such a file looks like
  its background in a plain image viewer and complete in a player.
- **Full poster.** A writer MAY instead render every layer into the PNG, as a preview, and list **no**
  `oim:base` layer. A reader (`hasBaseLayer(document)` is false) treats the PNG then as a poster: it shows
  it until the layers are painted and then fades it out, and the `poster="only"` player option shows just
  the PNG. A poster PNG MUST NOT be relied on for any content the layers do not also draw.
- Whether the PNG is a base or a poster is decided only by the presence of an `oim:base` image layer.

### 2.5. Retired container constructs

`OIM_Seal`, a `tEXt` chunk of 1.30.0 to 1.32.x holding a signed hash of the image placed before the
document, is **retired** (1.33.0). Writers MUST NOT emit it. Readers MUST ignore it if present; two vectors
in `vectors-2/` still carry one (`filter-shape`, `mask-frame-fill`). The image is sealed by `image_hash`
(section 6.5) and a PNG that is only shown runs nothing, so a poster needs no seal of its own.

---

## 3. The document

All objects are **strict**: a key that this section does not list is a validation error, except inside
`extensions` (section 3.17), inside `params` of an animation, and in the open maps of
`resources`, `variables` and `text.content`, whose keys are chosen by the author. An absent field means
its default; no object carries a switched-off value.

### 3.1. Root

| Field | Type | Required | Meaning |
|---|---|---|---|
| `oim` | string | yes | Version, section 1.3. |
| `id` | string 0..128 | no | Document identifier. No `<`, `>`, `"` or control characters. |
| `name` | string ≤256 | no | Title of the work. |
| `description` | map language → string ≤1000 | no | What the whole work shows, for screen readers. |
| `canvas` | object | yes | `width`, `height`: positive numbers in design pixels. `fills`: array of paints, ≤8, the background (section 3.4). |
| `languages` | string[] 1..64 | yes | Languages of the document, each 1..16 characters. The first is the default. |
| `variables` | object | no | Section 3.14. |
| `resources` | map name → paint | no | Shared paints, section 3.15. |
| `fonts` | array | no | Embedded fonts, section 3.16. |
| `layers` | Layer[] ≤150 | yes | Bottom to top. |
| `reedit` | `public` \| `author_only` \| `sealed` | no | Section 3.18. |
| `extensionsUsed` | string[] (each ≤64) | no | Section 3.17. |
| `extensionsRequired` | string[] (each ≤64) | no | Section 3.17. |
| `extensions` | open map | no | Section 3.17. |
| `image_hash`, `image_hash_alg`, `signature`, `key_version`, `signed_at` | string | signed files | Section 6. |

Signed files written by the production signer also carry a root `timestamp` (ISO 8601, time of packaging).
It is outside the signature (section 6.3) and a reader MUST ignore it. The strict schema does not list it;
see section 11.

Example of a minimal document (unsigned):

```json
{
  "oim": "2.0.0-draft.1",
  "canvas": { "width": 800, "height": 600 },
  "languages": ["en"],
  "layers": [
    { "id": "oim-base", "type": "image", "box": { "x": 0, "y": 0, "width": 800, "height": 600 }, "image": { "src": "oim:base" } },
    { "id": "title", "type": "text", "box": { "x": 80, "y": 60, "width": 400, "height": 90 }, "text": { "content": { "en": "Hello" }, "font": { "size": 40 }, "align": "center" } }
  ]
}
```

### 3.2. Layers

A layer is an object with a `type` and a fixed set of blocks. The **common fields** of every layer:

| Field | Type | Meaning |
|---|---|---|
| `id` | string 1..128 | Required. Unique in the whole document, children included (a repeated id is an error). No `<`, `>`, `"` or control characters. |
| `type` | `text` \| `shape` \| `image` \| `lottie` \| `group` | Required. |
| `name` | string ≤256 | Author's name. |
| `box` | object | Required. Section 3.3. |
| `opacity` | number 0..1 | Of the layer as a whole. Default 1. |
| `visible` | boolean | Default true. `false` starts the layer hidden (an action can show it). |
| `blend` | `multiply` \| `screen` \| `overlay` \| `darken` \| `lighten` \| `color-dodge` \| `color-burn` \| `difference` | Absent is normal. |
| `languages` | string[] 1..64 | The layer is shown only in these languages; absent means every language. Each 1..16 characters. |
| `extensions` | open map | Section 3.17. |

The **blocks** a type admits (`LAYER_BLOCKS`). A block on a type that does not admit it is an error. The
**required** block of a type is marked with `*`; every other block is optional.

| Block | `text` | `shape` | `image` | `lottie` | `group` |
|---|:-:|:-:|:-:|:-:|:-:|
| `fills` | ✓ | ✓ | | | |
| `strokes` | ✓ | ✓ | ✓ | | |
| `effects` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `animations` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `motion` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `mask` | ✓ | ✓ | ✓ | | |
| `geometry` | | ✓* | | | |
| `corners` | | ✓ | ✓ | | |
| `text` | ✓* | | | | |
| `image` | | | ✓* | | |
| `a11y` | | ✓ | ✓ | | |
| `interactions` | ✓ | ✓ | ✓ | | ✓ |
| `children` | | | | | ✓* |

`lottie` layers also carry the type-specific field `lottie`: `{ src?: string, loop?: boolean }`.

Counts: `fills` ≤8, `strokes` ≤8, `effects` ≤16, `animations` ≤16, `interactions` ≤8, `children` ≤150 per layer.
A `group` paints its `children` in order; a child's `box` is expressed in canvas units, not relative to the group.

### 3.3. Box

| Field | Type | Meaning |
|---|---|---|
| `x`, `y` | number | Required. Position in design pixels. |
| `width`, `height` | number ≥0 | Optional. Left out, the layer fits its content, grown from its anchor. A width alone is a reference width (what an endless loop measures its copies by). |
| `anchor` | `top-left` \| `top` \| `top-right` \| `left` \| `center` \| `right` \| `bottom-left` \| `bottom` \| `bottom-right` | Which point of the box sits at `x, y`. Absent is `top-left`. |
| `rotation` | number | Degrees, clockwise. |
| `flipX`, `flipY` | boolean | Mirror on the layer's own axes. |

The box is the painted rectangle: there is no implicit centring and no relative unit. See section 4.

### 3.4. Paints

A **paint** is one of the following objects. `opacity` is a number 0..1 on every paint except `{ ref }`.

| `kind` | Fields |
|---|---|
| `color` | `value`: a colour (3.5). |
| `gradient` | `gradient` or `preset` (exactly one). `gradient`: `type` (`linear` \| `radial` \| `conic`), `angle` (number), `stops` (2..32 of `{ color, at }`, `at` 0..1). `preset`: a name ≤64. |
| `image` | `src` (string; a `data:image/` URI), `fit` (`contain` \| `cover` \| `fill` \| `none` \| `scale-down`), `crop` (`{ x: 0..100, y: 0..100, zoom: 1..10 }`), `flipX`, `flipY`, `filters` (3.8). |
| `pattern` | `pattern`: `preset` (name ≤64), `colors` (≤16 colours), `bg` (colour), `scale`, `sizes`/`counts`/`dispersions` (numbers, ≤16), `svgs` (strings, ≤16), `fit` (≤32), `motion` (`direction`: `right` \| `left` \| `up` \| `down` \| `zoom-in` \| `zoom-out` \| `pulse`; `period` >0; `speed`), `tile`: `{ viewBox: number[4], paths: pathEntry[1..64] }` (a stored drawing; with it `preset` and `svgs` are ignored). |
| `generative` | `generative`: `generatorId` (`^[a-z0-9-]+$`, ≤64), `seed` (number), `params` (map of ≤64-char keys to number, string ≤256 or boolean), `colors` (`mode`: `monochrome` \| `palette`; `stops`: ≤16 colours; `direction`: `forward` \| `reverse` \| `radial`; `background`: colour; `backgroundVisible`: boolean). |
| `texture` | `texture`: `type` (1..32), `color`, `angle`, `crossed` (boolean), `thickness` ≥0, `size` ≥0. A drawn texture of lines or dots. |
| *(reference)* | `{ "ref": id }` only: the paint named `id` in `document.resources` (3.15). |

`canvas.fills` and a layer's `fills` paint in array order, first at the bottom.

A **stroke** is `{ paint, width, align?, style? }`: `paint` is a paint, `width` a length (3.5), `align` is
`center` (default) \| `inside` \| `outside`, `style` is `solid` \| `dashed` \| `dotted`.

### 3.5. Colours and lengths

A **colour** is a string of at most 128 characters that matches the whitelist `CSS_COLOR_PATTERN`
(`dynamic-colors.ts`): a hex colour with 3, 4, 6 or 8 digits; `rgb()`, `rgba()`, `hsl()` or `hsla()` whose
arguments are only digits, letters, `.`, `,`, `%`, `/`, `+`, `-` and spaces; the keywords `transparent`,
`currentColor`, `none`, `inherit`; or `var(--name)` / `var(--name, fallback)` with a fallback that is itself
one of these, nested at most twice. Anything else is invalid; a reader MUST NOT paint it.

A **scalar** (a colour, or a length such as `text.font.size`, a stroke `width`, `maxWidth`) is one of:

- a literal;
- a **binding** `{ "var": name, "fallback"?: literal }`: the value of the variable `name` (section 3.14),
  else `fallback`; `name` is 1..64 characters;
- an **exception** `{ "value": literal, "modes": { mode: literal } }`: `value`, except in the named modes.
  The reference reader selects the exception by language.

### 3.6. Effects

`effects` entries are objects discriminated by `kind`:

| `kind` | Fields |
|---|---|
| `shadow` | `x`, `y`, `blur` ≥0, `spread`, `color`, `opacity` 0..1, `inner` (boolean). |
| `glow` | `radius` ≥0 (required), `color`, `intensity`. |
| `blur` | `radius` ≥0 (required). |
| `backdrop` | The image filters of 3.8, applied to what is behind the layer. |
| `filter` | The image filters of 3.8, applied to the layer itself. |
| `grain` | `intensity` 0..100, `size` ≥0, `blend` (≤32), `color`. |
| `color-grade` | `preset` (required, 1..64), `intensity` 0..100. Presets: `warm-vintage`, `cool-cinema`, `cyberpunk`, `monochrome-contrast`, `teal-orange`, `bleach-bypass`, `cross-process`, `sepia`. An unknown preset paints nothing. |
| `texture` | `preset` (required, 1..64), `intensity` 0..100, `blend` (≤32), `scale`, `color`. Presets: `film-grain-35mm`, `fine-noise`, `dust-scratches`, `vintage-paper`, `rough-canvas`, `halftone-dots`, `scanlines`, `concentric-rings`. |

Effects apply in array order to the whole layer.

### 3.7. Geometry and corners

`geometry` (required on `shape`) is discriminated by `kind`. Every kind may carry `trim`
(`{ start?: 0..1, end?: 0..1 }`, how much of the outline is drawn).

| `kind` | Fields |
|---|---|
| `rect`, `ellipse`, `line` | none |
| `polygon` | `sides`: integer 3..64. |
| `star` | `points`: integer 3..64; `inner`: 0..1. |
| `preset` | `name` (1..64): a catalogue shape: `triangle`, `star`, `arrow`, `diamond`, `hexagon`, `circle`, `heart`, `line`, `blob`, `scribble`, `pill`, `octagon`, `pentagon`, `cross`, `moon`, `cloud`, `drop`, `bolt`, `bubble`, `flower`, `burst`, `arch`. |
| `paths` | `viewBox`: 4 numbers; `paths`: 1..2000 entries `{ d (required), fillRule ("evenodd"), fill (≤128), stroke (≤128), strokeWidth ≥0, cap (round \| square), join (round \| bevel), opacity 0..1, transform (6 numbers) }`. The drawing is scaled from its `viewBox` into the box. |

`corners` (on `shape` and `image`) is a number ≥0 (all corners) or an array of exactly 4 numbers ≥0.

### 3.8. Image filters

`filters` (in an image paint, an image block, and in `backdrop` and `filter` effects) is
`{ preset?, blur?, brightness?, contrast?, saturate?, hueRotate? }`: `preset` is a name ≤64; the numbers are
≥0 except `hueRotate`. Presets: `grayscale`, `sepia`, `high-contrast`, `vintage`, `cool`, `warm`, `faded`,
`cinema`, `nordic`, `sunset`, `noir`, `dramatic`, `cyberpunk`, `pastel`, `vhs`. An unknown preset is ignored.

### 3.9. Text

The `text` block of a `text` layer:

| Field | Type | Meaning |
|---|---|---|
| `content` | map language → string | Required. The words, per language. |
| `font` | object | `family` (≤256, no `<`, `>`, `"`, control characters), `size` (length), `weight` (number or string ≤16), `italic` (boolean). |
| `align` | `left` \| `center` \| `right` \| `justify` | Default `left`. |
| `lineHeight` | number or string ≤16 | |
| `letterSpacing` | number | In design pixels. |
| `transform` | `uppercase` \| `lowercase` \| `capitalize` | |
| `decoration` | string ≤64 | |
| `maxWidth` | length | |
| `marks` | map name → mark | Styles for `{name}…{/name}` spans of `content`; literal braces are doubled (`{{`, `}}`). A mark is `{ color, colorRole, bold, italic, underline, highlight }`; `colorRole` is one of `primary`, `on-primary`, `secondary`, `on-secondary`, `surface`, `on-surface`, `outline`, `accent`, `text-primary`, `text-secondary`, `text-muted`, `text-on-accent`; `highlight` is `{ style: marker \| box \| pill \| underline-thick, color, colorRole, paddingX, paddingY, borderRadius }` (padding and radius 0..64). |
| `runs` | map language → `{ fontSize, lineHeight, lines: [{ text, width, yOffset }] }` | Precalculated lines (≤500 per language) for readers with no paragraph layout. A reader that lays out text itself ignores them. |
| `highlight` | `{ enabled, color, style, paddingX, paddingY, borderRadius }` | Whole-text highlight. |
| `dropCap` | `{ enabled, lines: 2 \| 3, fontFamily, color, marginRight }` | |
| `artistic` | `{ preset (≤64), curve: { type: arc \| wave \| arch, amount }, extrusion: { depth ≥0, angle, color, shading } }` | Artistic text. |

**Languages and fallback.** A reader selects the document language from `languages`: the entry equal to the
reader's requested language (case-insensitive), else the first entry with the same primary subtag, else
`languages[0]`. A text then shows `content[language]`; if that entry is absent or empty, it shows `content.en`,
then `content.es`, then the first non-empty entry of `content`. (The last chain is what the reference painter
does; it is the 1.x behaviour kept so upgraded files look the same.) The language is chosen once and applies
to the whole document, including exceptions in scalars (3.5), image `src` exceptions (3.10) and `a11y`.

### 3.10. Image

The `image` block of an `image` layer: `src`, `fit`, `crop`, `filters` (3.8).

`src` is one of: a string (`oim:base`, or a `data:image/` URI); `{ value, modes }` (a picture per language; an
empty string means that language shows none); or `{ ref }`, the name of an image paint in `resources`.
`fit` and `crop` are as in 3.4. Pixel sources are only `data:image/png`, `jpeg`, `jpg`, `webp` or `gif` with
base64 (section 5.4).

### 3.11. Masks

`mask` is `{ mode?, invert?, feather?, scope? }`: `mode` is `window` \| `cutout`, `invert` is boolean,
`feather` ≥0, `scope` is `group` \| `canvas`. Mask support in the reference painter is partial (section 11).

### 3.12. Animations and motion

An animation:

| Field | Type | Meaning |
|---|---|---|
| `on` | `load` \| `loop` \| `enter` \| `hover` \| `press` \| `action` | Trigger. |
| `target` | `layer` \| `chars` \| `words` \| `lines` | What moves. Only `text` layers admit `chars`, `words`, `lines`; other types admit only `layer`. Absent is `layer`. |
| `preset` | string 1..64 | A named animation. Exactly one of `preset` and `tracks`. |
| `params` | open map | Preset-specific parameters. |
| `tracks` | 1..16 | Exactly one of `preset` and `tracks`. |
| `duration` | number ≥0 | **Milliseconds.** |
| `delay` | number ≥0 | Milliseconds. |
| `stagger` | number ≥0 | Intended: milliseconds between the units of a text target (section 11). |
| `easing` | easing | Default per preset. |

A **track** is `{ property, keyframes }`: `property` is one of `opacity`, `x`, `y`, `scale`, `rotation`,
`blur`, `trimStart`, `trimEnd`; `keyframes` has 2..240 entries `{ t, v, e? }`: `t` is 0..1, the share of the
animation's `duration`; `v` is the value (`opacity` as 0..1, `x` and `y` as canvas pixels, `scale` a factor,
`rotation` degrees, `blur` canvas pixels); `e` is the easing of the segment it starts. Values between
keyframes are straight lines unless `e` says otherwise.

An **easing** is `linear`, `ease-in`, `ease-out`, `ease-in-out`, `steps(1, end)`, or four numbers
`[x1, y1, x2, y2]` (a cubic Bézier).

**Presets.** The schema does not enumerate preset names (any string ≤64); the names a reader knows are
defined by the reader. The reference painter knows:

- `on: "loop"`: `pulse`, `float`, `bounce`, `spin`, `glow` (default durations 2, 3, 1.2, 4 and 2 seconds
  when `duration` is 0);
- `on: "hover"`: `grow`, `shrink`, `lift`, `glow`;
- reveals, for a `target: "layer"` animation: `fade`, `slide-up`, `slide-down`, `slide-left`, `slide-right`,
  `scale`;
- text, with a `chars`, `words` or `lines` target: `fade-chars`, `slide-up`, `bounce-chars`, `reveal-mask`,
  `scale-in`, `rise-words`, `typewriter`, `wave-chars`, `glitch-cyberpunk`, `glitch-slice`.

A reader MUST ignore an animation whose preset it does not know; the file stays valid.

**Triggers.** `load` runs once when the layer is painted; `loop` repeats forever; `hover` runs while the pointer
is over the layer and reverses when it leaves; `enter` is how the layer appears (and, reversed, leaves) when an
action shows or hides it; `action` runs when a `play` action (3.13) targets the layer; `press` is declared by the
schema (section 11).

**Motion.** `motion` is `{ loop?: { speedPxSec, direction?, mirror?, pauseOnHover? } }`. `loop` scrolls the
layer's content endlessly sideways: `speedPxSec` is −500..500 canvas pixels per second; `direction` is
`left_to_right` or `right_to_left` (default `right_to_left`); `mirror` mirrors every other copy so the seam
does not show (default true); `pauseOnHover` is boolean. The pointer-following parallax of 1.x does not exist in 2.0.

A reader MUST NOT animate when the host asks for no motion (the `disable-animations` attribute, or the
reader's reduced-motion preference); it paints the resting state.

### 3.13. Interactions

`interactions` is an array (≤8) of `{ on, actions }`: `on` is `press` or `hover`; `actions` has 1..64 entries
`{ type, target, value? }`: `type` is `show`, `hide`, `toggle`, `setText` or `play`; `target` is the `id` of a
layer in the same document; `value` (≤10000 characters) is the new words for `setText`. A `press` runs its
actions and is not undone; a `hover` reverts its `show`, `hide` and `toggle` when the pointer leaves.
`setText` replaces the words of the target for the current language. `play` runs the target's animations with
`on: "action"`.

There are **no navigation actions**: an interaction cannot open a link, load a document, post a message or
change the page. This is a rule of the format, not a default (section 5.4). The reference player announces
each firing with the cancelable `oim:action` event (section 4); if the host calls `preventDefault()`, the
local effect does not run. `disable-actions` removes interactions altogether.

### 3.14. Variables and colour bindings

`variables` is `{ modes?, defaults?, values? }`:

- `modes`: map mode name → 1..64 option names (each 1..64 characters). Two modes are meaningful:
  `palette` (the named palettes) and `language`.
- `defaults`: map mode → option, for example `{ "palette": "dark" }`.
- `values`: map variable name → a string ≤256 or a number, or a map option → string ≤256 or number.

A named palette is the set of colours `values[role][paletteName]` for the colour roles of 3.9 (`primary`,
`on-primary`, …, `text-on-accent`). A colour bound by `{ "var": "<role>" }` takes the active palette's colour
for that role, else its `fallback`, else it paints nothing. The active palette is the one the host requests
(the `palette` attribute); else, when the document defines palettes named `dark` and `light`, the one that
matches the viewer's colour scheme; else `defaults.palette`. A host page may override a role with the CSS
custom property `--oim-color-<role>`.

### 3.15. Resources

`resources` maps a name to a paint. A `{ "ref": name }` in `canvas.fills`, a layer's `fills`, a stroke's `paint`
or an image layer's `src` is replaced by that paint before painting (`resolveRefs`). A stroke whose ref is
missing is dropped; an image layer whose ref is missing or is not an image paint loses its `image` block; a
missing fill ref is dropped. A resource that points at another resource is followed at most four times.

### 3.16. Fonts

`fonts` is an array of embedded variants:
`{ family (1..128), name, weight (integer 100..900), style (normal | italic), format (woff | woff2), data }`.
`name` MUST match `^oim-[0-9a-f]{8}-[A-Za-z0-9 ]{1,64}$` and is the face's unique registered name. `data` is
base64 and decodes to at most 400 KiB. A `woff` entry is a static instance (no `fvar`, `gvar`, `avar`, `HVAR`
or `MVAR`; `STAT` may remain) subset to the glyphs in use; writers emit `woff`, readers MUST also read `woff2`.
The decoded bytes start with the magic of the declared format (`wOFF` or `wOF2`). A reader registers each
face under its `name` before the first paint and binds a `font.family` to it; a face that fails to load falls
back to the family.

### 3.17. Re-edit, extensions and a11y

`reedit` says who may re-edit the work: `public` (anyone), `author_only`, `sealed` (nobody). Absent, or any
other value, MUST be read as `author_only`, never as `public`. The field travels inside the file and is
covered by the signature; enforcement belongs to the registry that holds authorship, not to the reader.

`extensions` (on the document and on a layer) is the only open map: keys and values are free. A reader MUST
ignore an extension it does not know. `extensionsUsed` lists the extensions a writer used; `extensionsRequired`
those without which the work is not faithfully shown. A reader that sees a required extension it does not
implement SHOULD say so to the host and SHOULD NOT claim a faithful render. (The reference player does not read
either list yet; section 11.)

`a11y` (on `shape` and `image`) is `{ alt?: map language → string, decorative?: boolean }`. A decorative
layer is hidden from assistive technology; otherwise a reader SHOULD expose `alt` for the current language, and
the document's `description`.

### 3.18. Complete example

```json
{
  "oim": "2.0.0-draft.1",
  "name": "Sale",
  "description": { "en": "A sale poster", "es": "Un cartel de rebajas" },
  "canvas": { "width": 1080, "height": 1080, "fills": [{ "kind": "color", "value": "#101014" }] },
  "languages": ["en", "es"],
  "variables": {
    "modes": { "palette": ["dark", "light"] },
    "defaults": { "palette": "dark" },
    "values": { "accent": { "dark": "#ffffff", "light": "#101014" } }
  },
  "resources": { "wash": { "kind": "gradient", "gradient": { "type": "linear", "angle": 90, "stops": [{ "color": "#1c1c24", "at": 0 }, { "color": "#101014", "at": 1 }] } } },
  "layers": [
    {
      "id": "card", "type": "shape", "name": "Card",
      "box": { "x": 140, "y": 300, "width": 800, "height": 420 },
      "geometry": { "kind": "rect" },
      "corners": 32,
      "fills": [{ "ref": "wash" }],
      "strokes": [{ "paint": { "kind": "color", "value": { "var": "accent", "fallback": "#ffffff" } }, "width": 2, "align": "inside" }],
      "effects": [{ "kind": "shadow", "y": 12, "blur": 40, "color": "rgba(0, 0, 0, 0.5)" }],
      "a11y": { "decorative": true }
    },
    {
      "id": "headline", "type": "text",
      "box": { "x": 540, "y": 460, "width": 700, "anchor": "center" },
      "text": {
        "content": { "en": "Big {sale}", "es": "Gran {sale}" },
        "font": { "family": "Inter", "size": { "value": 96, "modes": { "es": 88 } }, "weight": 700 },
        "align": "center",
        "marks": { "sale": { "italic": true } }
      },
      "animations": [{ "on": "load", "target": "words", "preset": "rise-words", "duration": 600, "stagger": 80 }],
      "interactions": [{ "on": "press", "actions": [{ "type": "toggle", "target": "badge" }] }]
    },
    {
      "id": "badge", "type": "shape",
      "box": { "x": 540, "y": 640, "width": 160, "height": 60, "anchor": "center" },
      "geometry": { "kind": "preset", "name": "pill" },
      "fills": [{ "kind": "color", "value": "#ffffff" }],
      "visible": false,
      "animations": [{ "on": "enter", "preset": "scale", "duration": 250 }]
    }
  ],
  "reedit": "author_only"
}
```

---

## 4. Rendering model

[`SPEC_2.md`](SPEC_2.md) is the rendering reference; it, the vectors and their goldens
(`vectors-2/golden`) are the executable check. This section summarises the rules a reader applies.

1. **Coordinates.** Everything is in design pixels of the canvas. `box.x`/`y` is the top-left corner of the
   painted rectangle, unless `anchor` moves the anchor point to `x, y` (3.3). The reader scales the canvas to
   its container preserving the aspect ratio and centres it; there is no relative unit in the document.
2. **Paint order.** `canvas.fills` first, then `layers` in array order, bottom to top. Inside a group, its
   `children` in array order. There is no z-index. Within a layer: its fills (first at the bottom), then
   its strokes, then its effects over the result.
3. **Transform.** The box is placed (position, then anchor shift, then `rotation`, then `flipX`/`flipY`);
   the layer's animations move it relative to that.
4. **Strokes.** `align: center` (the default) straddles the geometry's edge, half inside and half outside;
   `inside` and `outside` put the stroke wholly on that side. The box never changes size because of a stroke.
   A 400 × 200 box at (80, 80) with a 10 px stroke reaches x 75–485 (`center`), 80–480 (`inside`) or 70–490
   (`outside`).
5. **Text.** A text with no `runs` is aligned by `text.align` and centred vertically in its box. A text
   with no `width` fits its content, grown from its anchor.
6. **Opacity and blend.** `opacity` and `blend` apply to the layer as a whole (children included). A layer
   blends with the layers under it inside the canvas, never with the page behind the reader.
7. **Language.** One language is selected for the whole document (3.9) and used for every text, exception and
   picture. A layer's `languages` list, when present, restricts the layer to those languages (section 11).
8. **Hidden.** A `visible: false` layer is not shown until an action shows it.
9. **Base picture.** See 2.4.
10. **Motion.** A reader paints the resting state when motion is disabled, and runs no animation while the
    host has paused it.

### The reference player (informative)

`@oim-media/player-oim` defines the custom element `<oim-player>`.

- Attributes: `src`, `placeholder`, `poster`, `lang`, `activate-on`, `fit`, `align`, `dropdown-blur`,
  `allow-lottie`, `palette`, `auto-rotate-lang`, `disable-animations`, `disable-actions`, `mode`, `show-slots`.
  `allow-lottie` is off unless set; `mode="full"` enables animation and actions, and the default shows a
  still image with its language.
- Events (bubbling from the element): `oim:loaded` (`detail`: `type`, `metadata`, `security`), `oim:error`
  (`detail`: `code`, `message`; codes include `unsupported-version` and `chunk`), `oim:action` (cancelable;
  `detail`: `slot`, `name`, `trigger`, `targets`, `types`), `oim:langchange` (`detail.lang`). `oim:incomplete`
  and `oim:unsupported` report the 1.x `capabilities` and `min_player` fields and do not apply to a strict 2.0
  document.

---

## 5. Security

A `.oim` is foreign data and travels to third parties. A reader treats everything in it as untrusted.

### 5.1. Strict objects and sanitised strings

Every object is strict (section 3). `id` (document and layer), `name` of a layer, `font.family`, and the
`family` of an embedded font reject `<`, `>`, `"` and control characters (U+0000–U+001F, U+007F) so they can
never become markup or an attribute break. A reader MUST NOT insert a document string as HTML: text is set as plain text.

### 5.2. Colours

Every colour passes the whitelist of 3.5. A reader MUST NOT paint a colour that does not match it, and MUST NOT
splice a document string into CSS other than through that whitelist. Free CSS is not part of the format.

### 5.3. Limits

| Limit | Value | Where |
|---|---|---|
| Layers per list (`layers`, each `children`) | 150 (`MAX_SLOTS`) | schema, player, signer |
| Layers in a document, groups included | 1000 (`MAX_TOTAL_LAYERS`) | player (and any signer) |
| Group nesting depth, top level = 1 | 32 (`MAX_LAYER_DEPTH`) | player |
| Decompressed document | 10 MiB | reader (section 2.2) |
| `fills` / `strokes` per layer | 8 / 8 | schema |
| `effects`, `animations` per layer | 16 / 16 | schema |
| `interactions` per layer; `actions` per interaction | 8; 64 | schema |
| Tracks per animation; keyframes per track | 16; 2..240 | schema |
| Gradient stops | 2..32 | schema |
| Pattern `colors`, `sizes`, `counts`, `dispersions`, `svgs` | ≤16 each | schema |
| Paths per `paths` geometry; per pattern `tile` | 1..2000; 1..64 | schema |
| `languages` (document, layer) | 1..64 entries of 1..16 characters | schema |
| Variable modes | ≤64 options of ≤64 characters | schema |
| Embedded font data | 400 KiB decoded | schema |
| Colour string; `id`; layer `name` | 128; 128; 256 | schema |
| Interaction `value`; document `description` per language | 10000; 1000 | schema |

A document over a limit is corrupt. The reader MUST refuse it before it paints and before it copies it in full.
A signer MUST NOT sign it. A signer MAY set lower limits; it MUST NOT set higher ones, because a file no reader
shows is worse than a refusal. The total and depth limits are checked by the player's validation, not by
`documentSchema`.

### 5.4. No network, no navigation

A reader MUST NOT make any request because a file asks it to, or reveal who is looking at it.

- Image sources are inline: `oim:base`, or `data:image/{png,jpeg,jpg,webp,gif};base64,…`. An `http(s)` URL,
  a relative path or any other scheme is not a picture source and MUST NOT be fetched.
- A Lottie layer carries its animation inline (JSON, or a JSON `data:` URL); a reader MUST NOT fetch a URL there,
  runs it without expressions or `eval`, and does so only when the host allows it (`allow-lottie`).
- Fonts are embedded (3.16); a reader MUST NOT fetch one from a CDN for a family the file carries.
- Interactions cannot navigate (3.13).
- Besides loading the file itself, the only thing a reader asks the network for is the signer's public keys,
  and only when a signature names a key it does not embed (section 6.3).

### 5.5. Unsigned and altered files

A file that is unsigned shows its PNG and no layer. A file whose signature or image seal fails is refused.
Section 6.4.

---

## 6. Signing

### 6.1. Fields

A signed document carries at the root: `image_hash`, `image_hash_alg`, `signed_at`, `signature`,
`key_version`, and the signer's `timestamp` (outside the signature).

### 6.2. The canonical form

The bytes that are signed are the **canonical form** of the document, implemented by `serializeCanonical`
(`canonical.ts`) and the same in every implementation (`canonical-cases.json` is the known-answer test). It
is the profile of [BINARY_SPEC.md](BINARY_SPEC.md) section 5.1, **not** RFC 8785:

1. Take the decoded document.
2. Remove from the root only `signature`, `key_version`, `timestamp` and `creator_user_id`. (`signed_at`,
   `image_hash` and `image_hash_alg` stay in and are covered.) The same names nested elsewhere are kept.
3. Numbers: a number with an integer value is written as an integer (`2.0` and `-0.0` become `2`, `0`); any other
   is rounded to at most 6 decimal places. Every number at any depth MUST be finite and not exceed ±(2⁵³ − 1);
   otherwise there is no canonical form: a signer MUST refuse the document and a verifier MUST treat the
   signature as invalid.
4. Object keys, at every depth, are ordered by ascending Unicode code point (not UTF-16 code unit).
   Array order is kept.
5. Compact JSON: no whitespace outside strings.
6. Non-ASCII characters are written as UTF-8, never as `\uXXXX` escapes.
7. The result is encoded as UTF-8.

### 6.3. The signature

- Algorithm: ECDSA over NIST P-256 with SHA-256.
- Value: the 64 bytes `r ‖ s` (IEEE P1363, not ASN.1 DER), base64-encoded, in `signature`.
- `key_version` names the signing key (`kid`), for example `v1` or `v2`. `signed_at` is an ISO 8601 timestamp with
  seconds and a time-zone designator, written by the signer and inside the signed bytes.
- The public keys are published in [`keys.json`](keys.json) and by the signer at
  `https://api.oim.media/v1/media/keys`. A reader embeds the keys it knows and fetches the list only for a
  `key_version` it does not.

### 6.4. Verification

A reader verifies in this order:

1. Extract the document (section 2). No document: the file is a plain image (`no_metadata`).
2. Validate the limits of section 5.3. A violation: `corrupt`, refuse.
3. If `signature` or `key_version` is absent: `unsigned`.
4. Otherwise rebuild the canonical form (6.2) and verify the signature with the key `key_version`. A number with
   no canonical form, an unknown key, or a failed verification: `invalid_signature`, refuse. When the
   embedded key fails, the reader MAY retry once with the key the server publishes for the same `kid`.
5. If the key was retired (`not_after` earlier than `signed_at`) the signature is invalid. A key the player no
   longer trusts by its own clock (`verify_until`) gives `expired_key`.
6. Compute the image seal (6.5). If `image_hash_alg` is `sha256-idat` and `image_hash` is a string, they MUST
   equal the computed hash, compared case-insensitively; otherwise `image_mismatch`, refuse. If the seal is
   absent, the result is the weaker `image_unsealed`.
7. Otherwise the file is `verified`, or `verified_authorless` when its `reedit` is `public` (a public file can be
   re-signed by anyone, so it earns a weaker stamp).

What the reader does with each result:

| Result | Reader behaviour |
|---|---|
| `verified`, `verified_authorless`, `image_unsealed` | Paints the layers. |
| `unsigned`, `expired_key` | Shows the PNG and paints no layer. |
| `no_metadata` | Shows the PNG. |
| `invalid_signature`, `image_mismatch`, `corrupt` | Refuses the file: it is not shown as the work (the reference player raises an error and reports a tampered or corrupt file). |

### 6.5. The image seal

`image_hash` is the SHA-256, as 64 lowercase hexadecimal characters, of the concatenation, in file order, of the
payloads (`Data` only) of every `IDAT` chunk. `image_hash_alg` is the literal `sha256-idat`. Because the
signature covers `image_hash`, a signed document cannot be pasted onto a different image. A signer MUST compute
the hash from the PNG it embeds; a hash supplied by the caller proves nothing.

Embedding the document changes no `IDAT` byte.

---

## 7. Conformance

The 2.0 conformance corpus is `vectors-2/`: 48 signed `.oim.png` files that exercise text and multilingual
content, strokes, effects, masks, patterns, generative and image fills, animation presets, interactions, groups,
loops, palettes, fonts and re-edit. Each has a golden image `vectors-2/golden/<name>.web.png` rendered by the web
reference (one vector, `background-pattern-order`, has none yet). A vector has no `.expected.json`: the
expectation is the golden. Known differences of a renderer go in an `exceptions.json` beside the goldens, with a
reason; an excepted vector that passes fails the run (`vectors-2/golden` has none today).

Procedure (800 px wide, device pixel ratio 1, animations disabled, white background, `sans-serif` host font),
metric (pixel channel difference above 40, 3 × 3 erosion, fail above 0.4 % area or a 576 px blob) and
calibration are those of [CANONICAL_SPEC.md](CANONICAL_SPEC.md) section 9.1 and `tools/parity-core.mjs`.

```bash
pnpm --filter @oim-media/spec parity:v2      # web player against the goldens
pnpm --filter @oim-media/spec parity:scene   # scene painter against the goldens
pnpm conformance                              # 1.x vectors upgrade to valid 2.0 documents, canonical form
pnpm --filter @oim-media/core exec vitest run
```

A reader in another language writes `<vector>.png` per vector following the procedure and compares with
`node packages/spec/tools/parity.mjs <renders-dir> --renderer <name> --out <diff-dir>`.

A writer is checked by validating its documents against `schema/oim2.schema.json` (generated from
`documentSchema`; a test fails if the two drift). Every JSON example in this document validates against
`documentSchema`.

---

## 8. Appendix A: differences from 1.x

| Topic | 1.x | 2.0 |
|---|---|---|
| Root | `slots`, `zones`, `lang`, `canvas.natural_*`, `media_type`, `min_player`, `capabilities` | `layers` (tree), `languages`, `canvas.width/height`; no capability list; extensions |
| Layer types | `text`, `image`, `lottie`, `geo`, `shape`, `draw`, `svg`, `artistic-text`, `pattern`, `filter`, `container`, `group`, `component`, `mask`, `zone` | `text`, `shape`, `image`, `lottie`, `group`; the rest are blocks (`mask`, `text.artistic`, pattern/texture paints, `filter` effect) |
| Position | `position` in percent, `width_px`, `cqw` units | `box` in design pixels, `anchor` |
| Style | one flat `style` object | one block per idea, only on the types that admit it |
| Hierarchy | `groupId`, `childIds`, `zone_id` | `children` |
| Paint order | `slots` order, background pattern always behind | array order, no exception |
| Colours | `fillColor`, `*Role` fields, `palettes` | `{ var }` bindings, `variables.modes.palette` |
| Opacity | 0..100 | 0..1 |
| Animation | `loop`/`hover` presets in seconds, keyframes `t` in seconds, `reveal`, `textAnimationType` | `animations` in milliseconds with `on`, `preset` or `tracks`, `t` as 0..1 |
| Pointer parallax | `parallax` | retired; only the endless `motion.loop` remains |
| Interaction | `isInteractive`, `states.hover/active` | `interactions` with `press`/`hover`; no navigation |
| Re-edit | `reedit` and `immutable_lock` | `reedit` only |
| Unknown keys | passed through | validation error (except `extensions`) |
| PNG | the picture painted under the slots | `oim:base` layer, or a poster |
| Container | `tEXt` base64 deflate, later `zTXt`; `OIM_Seal` 1.30–1.32 | `zTXt` `OIM_Data`; `OIM_Seal` retired |
| Readers | paint 1.x | do not paint 1.x; `unsupported-version` |

---

## 9. Appendix B: retired in 2.0

`textRole`, `textHighlight` (whole-text highlight stays only as `text.highlight`), `custom_loop_css`,
`custom_keyframes`, `parallax` (pointer), `blur-chars`, `reedicion` (Spanish alias), `allowed_domains`,
`elements`, short slot aliases (`p`, `s`, `st`, `c`, `t`), `OIM_Seal`. `upgrade()` reports what it dropped in
`retired` and anything it could not convert in `unhandled`.

---

## 10. Appendix C: where the code is

| Subject | File |
|---|---|
| Document schema | `packages/core/src/v2/schema.ts`, `layer-blocks.ts` |
| 1.x → 2.0 | `packages/core/src/v2/upgrade.ts`, `upgrade/` |
| Limits | `packages/core/src/limits.ts` |
| Container | `packages/core/src/binary.ts` |
| Canonical form | `packages/core/src/canonical.ts` |
| Verification | `packages/player-oim/src/render/security.ts`, `keys.ts` |
| Painting | `packages/scene/src` |

---

## 11. Appendix D: what the schema allows and the reference painter does not draw

Checked against release 1.35.2. A reader that does not draw one of these is still conforming to the schema; a
writer SHOULD NOT rely on them being painted.

- `geometry.trim` and the `trimStart` / `trimEnd` tracks: not drawn.
- An animation with `on: "press"`: not run (only `load`, `loop`, `hover`, `enter` and `action` are).
- `animation.stagger`: not read; a text entrance takes its spacing from `params.speed`.
- A gradient paint with `preset` and no `gradient`: draws nothing; only an explicit `gradient` is drawn.
- `layer.languages`: the document language is chosen, but a layer's own `languages` list is not used to hide it.
- Length bindings `{ var }` for a text's `font.size` or `maxWidth` are not resolved; literals and
  `{ value, modes }` are. Colour bindings are resolved.
- `extensionsUsed`, `extensionsRequired`: not read.
- A cutout mask inside a group, and a `{ ref }` chain through several resources beyond four steps: not drawn.
- Text marks in 2.0 are not limited by the schema to the 1.x pattern `^[a-z][a-z0-9-]{0,23}$` and 8 per
  layer; writers SHOULD respect them because the shared parser of `{name}…{/name}` does.
- `timestamp` at the root of a signed file is written by the signer and is rejected by the strict schema.
- The document version string is a draft (`2.0.0-draft.1`), accepted by the `^2\.` rule.
