# Changelog

All packages share one version, equal to the contract version (`CONTRACT_VERSION`
in `@oim-media/core`). A release tag `vX.Y.Z` publishes all of them.

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
