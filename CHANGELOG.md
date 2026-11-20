# Changelog

All packages share one version, equal to the contract version (`CONTRACT_VERSION`
in `@oim-media/core`). A release tag `vX.Y.Z` publishes all of them.

## 1.34.2

- core: `upgrade` paints no canvas fill for a 1.x `backgroundType: "image"`; the base PNG shows again.

## 1.34.1

- scene: 2.0 `shape` layers with `paths` geometry are painted again (the figure SVG is built by the renderer).
- player: a host without its own height sizes a 2.0 document from its width, like 1.x.
- ci: cdn-next sends `Access-Control-Allow-Origin: *`, needed by the SRI vendor loads.

## 1.34.0

- format: 2.0 ids (layers, `ref` targets, document) and font `family` reject `<`, `>`, `"` and
  control characters.
- player: the CDN build pins `lottie_light`, `upgrade`, `generative` and `patterns` with SRI
  (+0.35 KB gzip).
- player: 2.0 documents are capped at 1000 layers in total and 150 per list, nesting at 32 levels.
- player: the retirement window comes from the key that verified the signature.
- scene: artistic text escapes every SVG attribute; embedded font data must be strict base64.
- ci: wrangler pinned in the player-next deploy.

## 1.33.0

- format: `OIM_Seal` is retired. Writers stop emitting it; readers ignore it. The image stays
  sealed by the metadata's `image_hash`.
- player: a file is read once, whole. Its PNG is painted while it arrives (a PNG runs nothing);
  layers mount only after the whole file is verified. No more Range requests or partial reads
  (-1.3 KB gzip).

## 1.32.5

- player: a file whose poster read already held it whole loads; the resume request got HTTP 416
  and the player gave up (small `.oim` files on oim.media showed no layers).
- player: a 2.0 file that shows its own picture (`oim:base`) keeps it; the canvas colour was
  painted over the base PNG and hid the photo.

## 1.32.4

- player: resuming a download sends If-Range with the first response's ETag, so a head served
  from the HTTP cache is never spliced with a newer file (HTTP 416 or a corrupt file before).

## 1.32.3

- player: a drawing painted by its fill layer (gradient, pattern, generative) or a shape's
  silhouette moves with its loop timeline or loop preset; it stood still (the cards rocket).

## 1.32.2

- core: an SVG layer's gradient stroke (`strokePaint: "gradient"`) upgrades to a gradient
  `strokes[0].paint`; new `svgGradientAttrs`, the SVG gradient geometry the editor and player share.
- player: a drawing's gradient stroke is painted on its paths; a looping shape carries its
  silhouette in every track piece, so it scrolls. Player budget raised to 56 KB gzip.

## 1.32.1

- core: an SVG icon whose exported markup bakes a gradient, pattern or generative fill
  (`<defs>`, `url()`) upgrades from its original `svgRawXml` instead of becoming a rectangle.
- player: a 2.0 drawing with a gradient fill paints it cut to its paths, as pattern and
  generative already did; it used to paint the gradient over the whole box.

## 1.32.0

- Additive: every new field is optional, and a document without them renders as before. No `min_player` or capability is set for the new values.
- `maskShape` accepts the twelve frame shapes (`FRAME_SHAPES`) besides the eleven 1.x shapes and `custom`. A mask whose outline cannot be drawn (unknown name, invalid path) falls back to its box, not to a circle, and the player warns once.
- A window mask (`maskMode: "window"`) paints its frame with the shape fill model: `fillType`, `fillColor`, `fillColorRole`, `fillGradient` and `fillImage`. The 1.x `maskBgColor` keeps working as a plain colour.
- A `filter` slot accepts `geoShape` (`rectangle` by default, `circle` or a frame shape). Its clip follows `borderRadius*`, clamped to half the short side.
- The player draws the duotone filter in sRGB (`color-interpolation-filters="sRGB"`), as the editor does. Duotone layers change pixels.
- The player no longer shifts window frames and filters vertically.
- Exception to the pixel guarantee: the player draws every mask silhouette from the shared catalogue (`maskOutlinePath`). Silhouettes it used to draw from its own table change, and `svgPath` cutouts with `Q`, `S`, `T` or `A` segments are fitted into their box instead of being drawn unscaled.
- New public functions in `@oim-media/core`: `normalizePathData`, `transformPathData` (the SVG path parser shared by player and editor), `maskOutlinePath`, `maskFrameFillCss`, `filterClipPath` and `clampRadius`.

## 1.31.0

- No format change. The 2.0 scene painter paints a layer's blur, shadow, glow and backdrop effects, through the same `effectsToStyle` as the legacy renderer. Grain, texture, colour-grade, filter and duotone are not painted by the scene yet.

## 1.30.2

- No format change. The player paints a 2.0 file's canvas colour and its filled drawings, and an SVG layer keeps the colours of its resolved markup.
- Centred and right-aligned text sits on its box: the 0.25em italic room no longer shifts it left (web, scene and Flutter; goldens regenerated).

## 1.30.1

- No format change. The CDN player fetches generative fills and pattern tiles from `vendor/` only when a document uses them (61.4 to 53.1 KB gzip).
- A part of the player that fails to load emits `oim:error` with `code: "chunk"` and its URL; the rest of the work is still drawn.

## 1.30.0

- New `OIM_Seal` chunk: the image hash signed on its own, written after the image and before the metadata, so a player can verify and paint the poster from a partial read. Readers that do not know it ignore it.
- Players read a URL up to the seal; `poster="only"` never downloads the metadata, and the rest of the file comes with `Range`.
- The core stream metadata reader no longer stops at IDAT (the metadata now follows the image).

## 1.29.1

- The 1.x to 2.0 upgrade retires the editor-only `textRole` field (no player read it). No format change.

## 1.29.0

- 2.0: `image.src` can reference a `resources` entry (`{ "ref": "res_x" }`), so a photo used by several layers travels once.

## 1.28.0

- The player paints a 2.0 file (layers, no slots) with the same pixels as its 1.x original, and resolves `resources` refs.
- New `poster="auto|only"` attribute: `only` shows the file's image without mounting the scene (gallery mode).
- `@oim-media/spec` ships `vectors-2/`, the conformance vectors as signed 2.0 files.

## 1.27.12

- Core (`upgrade`): an SVG layer draws its content, as 1.x did, not `svgRawXml` (the
  untouched original): colours and stroke widths edited in the content are kept.

## 1.27.11

- Core (`upgrade`): a CSS corner shorthand (`"10px 25px 50px 0px"`) keeps its four corners;
  a text whose fill 1.x left transparent stays hollow instead of painting black; only the canvas
  background tiles its raw SVG, so an SVG icon is drawn, not filled.
- Scene: the colour under a photo fill is painted beneath it, clipped to the shape, as 1.x did.

## 1.27.10

- Core: experimental `@oim-media/core/v2` entry with the draft of the 2.0 document and
  `upgrade(v1)`, which reads a 1.x document as 2.0 and reports any key it could not carry. The
  published format and the root exports do not change.
- Spec: `schema/oim2.schema.json`, generated from that draft, and `tools/upgrade-report.mjs`. The
  conformance gate also checks that every vector upgrades to valid 2.0 with nothing left behind.
- Scene: new `@oim-media/scene`, the renderer the player and the editor share. The player now
  paints from the 2.0 document that `upgrade` produces, not from the 1.x fields.
- Player: a zone is drawn as a group. Its background, corners and backdrop blur are kept; its
  layers keep their own position and its flex flow is no longer applied (a file that relied on
  that flow lays out differently).
- Flutter SDK: a hover `transitionDuration` is read in milliseconds, as the contract says. It
  was multiplied by 1000, so a 200 ms transition lasted 200 s.
- Flutter SDK: 1.x zones are painted (background, corners and backdrop blur); they were not drawn
  at all.
- Spec: two new vectors, `zone-group` and `mask-window` (39 in all).

## 1.27.9

- Rust crate: a signed decimal with many digits (for example `1.0000004999999999`) could be
  read one bit off and the file reported as tampered. `serde_json` now parses with
  `float_roundtrip`.
- Spec: `canonical-cases.json` is a known-answer case for the canonical form, checked by the
  TypeScript, Rust and Dart implementations. `BINARY_SPEC.md` 5.1 says plainly that the
  canonical form is OIM's own profile, not RFC 8785 (JCS).
- Spec: the conformance gate now also runs `tools/canonical-check.mjs`, which rebuilds the
  canonical form and verifies every vector's signature.
- Docs: one expansion of the name, Object Interactive Media; the vector count is 37.
- Contract (BINARY_SPEC 5.1 rule 3): a number in the metadata must be finite and within
  ±(2^53 − 1). Beyond that the implementations read different values (four different
  answers for `1e21`), so it has no canonical form: signers refuse it and the web player,
  the Flutter SDK and the Rust crate report the signature as invalid. No vector and no
  file made by the editor carries such a number.

## 1.27.8

- Release: the packages are published to the public registries, with no token: `@oim-media/*`
  on npm, `oim_flutter` on pub.dev and `oim-media` on crates.io. GitHub Packages is no longer
  updated.

- Flutter player: shadows, `effects` (drop-shadow, glow, blur), layer blur and filter blur scale
  with the canvas. They stayed at design pixels, so on a small player they were too large.
- Flutter player: a rectangle's stroke scales with the canvas and grows the box outward, as
  the web's CSS border does (the box keeps its vertical centre and its `textAlign` anchor). It
  used to stay at design pixels and sit inside the box.
- Spec tools: web goldens render with grey text anti-aliasing (`--disable-lcd-text`); LCD colour
  fringes depend on the screen and no other renderer draws them.
- Spec tools: web goldens render with `text-rendering: geometricPrecision`. Headless Linux
  Chrome rounded each glyph advance to whole px, so a line could fit where the exact width
  (editor, Flutter, Windows) wraps. All goldens regenerated; `artistic-text` now passes in
  Flutter without an exception.
- Flutter player: embedded fonts that share a name (one family, several weights, like
  `@font-face` rules) all load; only the first did, so bold text drew with the regular subset
  and lost glyphs. A moving pattern no longer throws when its palette changes.
- Flutter player: `allowDynamicColors: false` ignores the work's palettes and keeps the literal
  colours, like `allow-dynamic-colors="false"` on the web element.
- Flutter player: on phones and with reduced motion a language change fades the layers that
  change (120 ms), as the web does; the whole-canvas blur stays for desktop. Reduced motion used to
  swap with no transition.
- Flutter player: the `texture` effect is drawn (the eight presets, on layers and on the canvas),
  with noise that matches the browser's. It was ignored.
- Flutter player: layer effects (`blur`, and `drop-shadow` and `glow` on non-text layers) are
  drawn, following the silhouette as on the web. Only text shadows were drawn before.
- Flutter player: `artistic-text` layers are drawn (3D extrusion, curve, strokes and built-in
  gradients), as on the web. They were blank.
- Web player: artistic text is sized against the real canvas width. On a canvas wider than
  800 px it came out smaller than in the editor (107 px instead of 160 on a 1200 px canvas).
- Spec: `artistic-text-cases.json` holds the shared curve, line and extrusion cases.
- Flutter player: a text glow or drop shadow from `style.effects` is drawn, as on the web.
  It was missing, so a glowing title showed flat.
- Flutter player: line-height leading is split evenly above and below the text, as in CSS.
  A title with `lineHeight: 1` sat about 12 px too high.
- Tools: `OIM_VECTORS=<folder>` makes `render-web-goldens.mjs` and the Flutter parity test
  render any folder of works, to compare real files between web and Flutter.

## 1.27.7 — 2026-11-07

- Flutter player: text is laid out by the player, like the web, instead of following the
  editor's precalculated lines (`textRuns`). A short label such as «EST. 94» no longer breaks
  in two and spills out of its badge.
- Flutter viewer: the interface follows the system language (Spanish or English), like the
  Tauri viewer. It was Spanish only.
- Tauri viewer (Windows): the mouse pointer no longer freezes after entering full screen
  with the toolbar button.
  No format change.

## 1.27.6 — 2026-11-07

- Web player: a photo frame drawn with its own `svgPath` no longer shows a box in its
  fill colour around the photo.
- Flutter player, closer to the web:
  - `opacity` is read as 0..100, as the contract says;
  - the retired `blendMode` and the non-contract `borderColor`/`borderWidth` are not drawn;
  - media filters apply only to image layers and to an image fill's picture;
  - custom paths use their `svgViewBox`; `container` layers are painted;
  - text without a colour is black, not white;
  - text sits where the web puts it (vertical centring, slot `align`, the 0.25em padding).
- Visual parity gate: every vector has a web golden; CI compares the Flutter player
  pixel by pixel. Two new vectors: `background-pattern-order`, `shape-shadows`.
  No format change.

## 1.27.5 — 2026-11-07

- Flutter player, closer to the web:
  - embedded WOFF2 fonts are read (works made before 1.27.0);
  - the canvas background stays behind the layers when it is listed last;
  - background patterns use the tile the file carries;
  - shapes draw their outline (`strokeColor`/`strokeWidth`) and a shadow that
    follows the shape, under a picture fill;
  - SVG layers are drawn;
  - a unitless `letterSpacing` is ignored, as browsers do;
  - the viewport blurs when the language changes;
  - text no longer inherits the host app's style.
- Flutter player: parallax speed in canvas pixels, no seam between tiles,
  centred text alignment. No format change.

## 1.27.4 — 2026-11-07

- Viewers: changing a filter right after clearing the search no longer shows
  the previous results.
- Flutter player: shapes filled with a picture and image layers whose content
  is a language map now show their image (they were grey or empty).
- Flutter viewer: the gallery shows thumbnails and plays a work only on hover.
  No format change.

## 1.27.3 — 2026-11-07

- Viewers (desktop and Flutter): the library is read from
  `library.oim.media/v1/showcase`, paginated with «Load more», and search and
  category run on the server over the whole library. The viewers no longer
  ship a database URL or key. No format change.

## 1.27.2 — 2026-11-06

- Player: an image layer moved by keyframes is no longer clipped by its own
  box. A jumping layer vanished and a travelling one only showed near its
  home position. No format change.

## 1.27.1 — 2026-11-06

- Contract 1.27.1: a `"woff"` entry may carry `STAT`. Static fonts carry it
  and HarfBuzz keeps it when instancing, so 1.27.0 rejected valid exports;
  the variation tables are `fvar`, `gvar`, `avar`, `HVAR` and `MVAR`. No
  format change.
- Release: the GitHub release is created before the binary jobs upload.
- Flutter: embedded fonts. Each `"woff"` entry is unwrapped to an sfnt
  (zlib per table) and registered with `FontLoader` under its `name`; text
  uses the entry of its family and style closest to its weight. `"woff2"`
  entries (files before 1.27.0) are skipped, as the contract allows: the
  text paints in the family the platform has. Vector 34,
  `embedded-font-woff`, checks the `fonts` declaration.
- Contract 1.27.0: embedded fonts in WOFF. `fonts[].format` is `"woff"`
  (written from now on) or `"woff2"` (read forever). A `"woff"` entry is a
  static instance: no `fvar`, `gvar`, `avar`, `HVAR` or `MVAR` (`STAT` may
  stay: static fonts carry it, and HarfBuzz keeps it when instancing), so
  readers outside the browser paint the weight it declares. WOFF needs only
  zlib, which every language ships. `embeddedFontProblem(format, bytes)` in
  core checks the magic and the static rule; the web player loads both
  formats. No `min_player`: an older player skips a `"woff"` entry and paints
  the family it has.
- Flutter: masks, frame shapes and languages. A `mask` layer in `window` mode
  paints its frame with the silhouette as a hole (canvas or `container`
  coverage, outline with `maskStrokeWidth`); in `cutout` mode it clips the
  layers below it, with `maskFeather` blurring the edge; `cuts` place several
  silhouettes. Geo layers paint their `geoShape`. Layers with `languages` show
  only in those languages, and `oimLanguages(metadata)` lists the languages of
  a file, as the web player's `languages`.
- Flutter: text marks, precalculated lines and text animations. `{name}…{/name}`
  marks paint with `style.marks` (colour, bold, italic, underline; a highlight
  as a plain background); `style.textRuns` places each line where the exporter
  measured it; `typewriter`, `wave-chars`, the six entrances and both glitches
  animate as on the web, and stop with `disableAnimations`. Pinned by
  `packages/spec/marks-cases.json` and the new `text-effect-cases.json`, which
  the web also passes. Embedded `.woff2` fonts are not loaded yet.
- Flutter: gradient, pattern and grain fills. `fillGradient` (CSS linear and
  radial) fills shapes and text; pattern fills, pattern layers and the canvas
  background pattern are tiled and moved as on the web, with their colour
  roles; per-layer grain is the browser's `feTurbulence` noise (seed 7) cut to
  the layer and blended with it. The tile layout is pinned by
  `packages/spec/pattern-cases.json`, which the web core also passes.
- Flutter: interactive layers respond. `states.hover` scales, rotates and fades
  the layer and runs its actions until the pointer leaves; `states.active`
  actions (`show`, `hide`, `toggle`, `setText`, `play`) run on tap; the legacy
  `interaction.toggle_elements` works too. Layers with `isVisible: false` start
  hidden and appear with their `reveal` (fade, slides, scale). `play` runs a
  `trigger: "action"` animation once. The rule is pinned by
  `packages/spec/action-cases.json`, which the web player also passes.
- Flutter: layers with `style.animation` now move. Structured keyframes, the
  `pulse`, `float`, `bounce` and `spin` loops and the `grow`, `shrink` and
  `lift` hover effects play as on the web; `trigger: "action"` rests on its
  first keyframe until actions arrive. `glow` is not played yet.
- Core: `sampleKeyframes` and `easeProgress` state what a keyframed layer looks
  like at a given time. The cases are in `packages/spec/keyframe-cases.json`,
  and the web and Flutter players both pass them.
- Player: the `palette` attribute and the file's default palette now apply when the
  file loads; before, the palette was resolved before the file was read and no
  `--oim-palette-*` value was written until the attribute changed.
- Native Dart/Flutter SDK (`sdks/flutter`): reads `.oim` files, verifies the
  ECDSA signature and the image seal offline, and renders with `OimPlayer`.
  Passes every conformance vector.
- Flutter viewer (`apps/viewer-flutter`) for Android, iOS and Windows.
- Tauri desktop viewer (`apps/viewer-desktop`) with a public library gallery.
- Flutter SDK: default language is English and text falls back like the web
  player (requested, `en`, `es`, first); it used to start with the file's first
  language and prefer `es`.
- The desktop viewer requests only the public library columns.
- CI: pull requests from forks never run on the self-hosted runner.
- Rust crate (`sdks/rust`): reads `.oim` files, verifies the signature and the
  image seal offline, and resolves layer text and re-edit permission. Passes
  every conformance vector. Installed from git.

## 1.26.1 — 2026-11-01

- The `reedit-english` conformance vector is signed by the production service,
  and the conformance gate no longer skips unsigned vectors. No format change.

## 1.26.0 — 2026-11-01

- The player's default language is English when `lang` is not set.

## 1.25.1 — 2026-11-01

- Typings list the `expired_key` security status; dead player options are
  marked deprecated.

## 1.25.0 — 2026-11-01

- Player events carry `detail.message`. Package READMEs.

## 1.24.0 — 2026-11-01

- The player renders its `placeholder` until the `.oim` paints.

## 1.23.2 — 2026-11-01

- Typings match the runtime; license headers on every file.

## 1.23.1 — 2026-11-01

- zod 4.6 and happy-dom 21.

## 1.23.0 — 2026-11-01

- Format keys and exported names in English (`reedit: "public" | "author_only"
  | "sealed"`). Files signed with the Spanish keys are still read, forever.

## 1.22.2 — 2026-11-01

- English `player-ovm`, reference `.oim` fixture.

## 1.22.1 — 2026-10-31

- Cleanup release.

## 1.22.0 — 2026-10-31

- First release from this repository.
