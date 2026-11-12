# Changelog

`oim_flutter` shares one version with every OIM package, equal to the format
contract version. The full history, for all packages, is in the repository's
[CHANGELOG.md](https://github.com/oim-media/oim/blob/main/CHANGELOG.md).

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
