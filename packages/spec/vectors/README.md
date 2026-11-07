# Conformance vectors

Each vector is a real `.oim` with the result that a reader must produce when
opening it. The JSON Schema in `../schema/` says what **shape** a `.oim` has;
this says what **result** comes out of a specific one.

```
<name>.oim.png        the file, signed, exactly as the system produces it
<name>.expected.json  what a conforming reader must extract from it
```

## The Normative Vectors

A reduced suite cannot tell apart an implementation that **reads the format**
from one that **gets a simple case right by chance**. These 36 vectors cover the
initial 20-vector matrix plus every capability added since contract 1.10.0:

| # | Vector | What it covers |
|---|---|---|
| 1 | `basic-text` | The minimum: PNG container, `zTXt` chunk, zlib, two languages, geometry in `cqw` |
| 2 | `groups-and-parallax` | Simple hierarchy (`childIds` / `groupId`) and depth (`parallax`) |
| 3 | `interactive` | `isInteractive`, `states.active.actions`, per-side corners and `min_player` |
| 4 | `multilang-cjk-rtl` | Complex multilingual coverage: Spanish, Japanese (CJK: `こんにちは世界`) and Arabic (RTL: `مرحبا بالعالم`) |
| 5 | `typography-styling` | Advanced typography: `fontFamily`, `fontWeight`, `fontStyle: "italic"`, `textTransform`, `letterSpacing`, `lineHeight` |
| 6 | `nested-groups` | Multi-level hierarchy: a root group containing a subgroup with child elements |
| 7 | `asymmetric-borders` | Independent corner radii per corner (`borderRadius: "10px 25px 50px 0px"`) |
| 8 | `shadow-effects` | Shadow system: `shadowEnabled`, `shadowColor`, `shadowBlur`, `shadowOffsetX`, `shadowOffsetY`, `shadowOpacity` |
| 9 | `color-blending-opacity` | Visual composition: layer opacity (`opacity: 70`) and blend modes (`blendMode: "multiply"`) |
| 10 | `strokes-and-borders` | Vector stroke and outlines: `borderWidth`, `borderColor`, `strokeStyle: "dashed"` |
| 11 | `parallax-infinite` | Continuous horizontal looping parallax effect (`mode: "infinite_horizontal"`, `speed_px_sec`, `direction`) |
| 12 | `interactive-hover` | Cursor interactive state: `states.hover` with `scale`, `rotation`, `opacity` |
| 13 | `interactive-chained-actions` | Several interactive actions chained when a layer is activated (`toggle`, `hide`) |
| 14 | `filter-effects` | CSS visual filters: `filterBlur`, `filterBrightness`, `filterContrast`, `filterSaturate`, `filterHueRotate` |
| 15 | `text-runs-precalculated` | Precalculated layout for native non-web renderers (`textRuns` with `lines`, `width`, `yOffset`) |
| 16 | `multi-container-layout` | Several `container` slots organising the spatial layout of the document |
| 17 | `extreme-aspect-ratios` | Ultra-wide panoramic canvas (`1600x400`, 4:1 ratio) testing container consistency |
| 18 | `transparent-background` | Strictly transparent background (`fillColor: "transparent"`) under the normative colour rule |
| 19 | `layer-ordering-zindex` | Strict stacking sequence with slots overlapping at identical coordinates |
| 20 | `full-monty-composite` | Comprehensive master document combining multilingual content, active/hover interactivity, groups, parallax and shadows |
| 21 | `legacy-text-chunk` | The same document as `basic-text` in the legacy container: a `tEXt` chunk with base64 of raw deflate |
| 22 | `layer-blur` | Layer blur (`layerBlur`) on the style of a text and of a shape |
| 23 | `layer-grain` | Per-layer grain (contract 1.10.0): `grain`, `grainIntensity`, `grainSize` and `grainBlend` |
| 24 | `flip` | Layer flip (contract 1.14.0): `flipX` and `flipY` on rotated shapes |
| 25 | `crop` | Image crop (contract 1.15.0): `imageCrop` framing an image at x 20 %, y 70 % and zoom 2 |
| 26 | `accessibility` | Accessibility (contract 1.16.0): document `description`, per-language `alt` and `decorative` |
| 27 | `image-fill` | Image fill (contract 1.17.0): shapes filled with an embedded photo and `fillImageCrop` |
| 28 | `media-filters` | Media filters (contract 1.18.0): `filterPreset` on a photo and on a circular frame with blur and stroke |
| 29 | `frame-shapes` | Frame shapes (contract 1.19.0): a cloud, a custom SVG path (`svgViewBox`) and a star with a flipped photo |
| 30 | `palettes` | Named palettes (contract 1.20.0): `dark` and `light`, `defaultPalette: "dark"`, and colour roles |
| 31 | `pattern-color-roles` | Colour roles in patterns and shadows (contract 1.21.0) |
| 32 | `reveal-and-play` | Per-layer reveal and the `play` action (contract 1.22.0) |
| 33 | `reedit-english` | Re-edit permission in English (contract 1.23.0): `reedit: "public"`, signed by the production service |
| 34 | `embedded-font-woff` | Embedded font (contract 1.27.0): Inter bold as a static WOFF subset (`fonts[].format: "woff"`) |
| 35 | `background-pattern-order` | A pattern background listed last still paints under every layer; pattern tile size; unitless `letterSpacing` on centred text |
| 36 | `shape-shadows` | Hard shadows on a circle and on a circular photo frame: the shadow follows the shape, not its box |

## How to use it from another language

1. Open the `.oim` as a PNG and look for the metadata chunk: `zTXt` (key `OIM_Data`; the one written since 29 Oct 2026), or `tEXt` / `iTXt` (keys `OIM_Data` or `OIM_JSON_DATA`).
2. Decompress the payload: if it comes in base64, decode it first; decompression is **raw deflate** (no zlib header, RFC 1951) or standard zlib.
3. Interpret the result as UTF-8 JSON: these are the document's metadata.
4. Compare with `<name>.expected.json`, ignoring its `description` field.

What is compared is what two implementations can genuinely disagree on: the
geometry **already normalised** to `cqw` or user units, the hierarchy, the depth,
the typography and the declared interactivity. Not the whole metadata — a full
dump breaks every time the compiler adds a field, and then it gets regenerated
without a look, which is a vector that no longer checks anything.

## The signature

All 36 vectors are signed with the public key published in `packages/spec/keys.json`.
The signature covers the canonical serialisation
of the metadata and the cryptographic hash of the pixels (`image_hash` over the `IDAT` chunks).
A reader that verifies must rebuild that canonical form following the seven rules
specified in the `README.md` at the root of `packages/spec`; one that only reads the format
may ignore it, but then it must not claim to validate authorship.

## How they were generated

The vectors are generated by Xue Studios' signing service, through the same
production pipeline that signs every published `.oim`: the slots are normalised
to `cqw`, the file is sanitised, signed and embedded. The generator is not part
of this repository; the output is committed here as-is, so every implementation
reads the same files.

`interactive` is the exception: it comes from a real editor export, and that is
why it carries things the normalisation pipeline alone does not produce.

The base image weighs about 3 KB and is reused across vectors. A published
`.oim` weighs megabytes because it carries its rasterised canvas inside; the
image is not what these vectors check.

## Keeping them from rotting

`packages/core/src/conformance-vectors.test.ts` runs them in every suite: if the
reference implementation changes what it produces, the vectors fail. It is
circular on purpose and in one direction — the reference defines the result, and
the test prevents it from moving without the vectors moving with it.

The day a second reader exists and disagrees, there is a concrete file to discuss
instead of two opinions.
