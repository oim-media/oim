# Changelog

`oim_flutter` shares one version with every OIM package, equal to the format
contract version. The full history, for all packages, is in the repository's
[CHANGELOG.md](https://github.com/oim-media/oim/blob/main/CHANGELOG.md).

## 1.33.0

- Version aligned with the 1.33.0 release; no SDK changes (the SDK never read `OIM_Seal`).

## 1.32.5

- Version aligned with the 1.32.5 release; no SDK changes.

## 1.32.4

- Version aligned with the 1.32.4 release; no SDK changes.

## 1.32.3

- Version aligned with the 1.32.3 release; no SDK changes.

## 1.32.2

- Version aligned with the 1.32.2 release; no SDK changes.

## 1.32.1

- Version aligned with the 1.32.1 release; no SDK changes.

## 1.32.0

- Tracks contract 1.32.0: 12 new mask and filter silhouettes; the frame fill uses the fill* fields.

## 1.31.0

- No change to this SDK; version follows the contract. The scene painter that gained blur, shadow, glow and backdrop effects is in the web packages (`packages/scene`).

## 1.30.2

- Centred and right-aligned text is no longer shifted left by the italic room, as on the web.

## 1.30.1

- No change to this SDK; version follows the contract.

## 1.30.0

- Version aligned with the 1.30.0 release; no Dart change (the new `OIM_Seal` chunk is ignored).

## 1.29.1

- Version aligned with the 1.29.1 release; no Dart change.

## 1.29.0

- Version aligned with the 1.29.0 release; no Dart change.

## 1.28.0

- Version aligned with the 1.28.0 release; no Dart change.

## 1.27.12

- No Flutter change; version aligned with the web packages.

## 1.27.11

- No Flutter change; version aligned with the web packages.

## 1.27.10

- A hover `transitionDuration` is read in milliseconds, as the contract says (200 ms lasted 200 s).

## 1.27.9

- A number in the metadata beyond +/-(2^53 - 1) has no canonical form: the signature of
  such a file is reported as invalid, the same as in the web player and the Rust crate.
  `hasNumberOutOfRange` is exported.

## 1.27.8

- Shadows, effects and a rectangle's stroke scale with the canvas; the stroke
  grows the box outward like the web's CSS border.
- Every face of an embedded font that shares a name is loaded.
- `allowDynamicColors: false` keeps the file's own colours.
- First release on pub.dev.

## 1.27.7

- Text is laid out by the player, like the web, instead of following the
  editor's precalculated lines (`textRuns`).
