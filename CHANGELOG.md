# Changelog

All packages share one version, equal to the contract version (`CONTRACT_VERSION`
in `@oim-media/core`). A release tag `vX.Y.Z` publishes all of them.

## Unreleased

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
