# OIM Viewer Desktop (`@oim-media/viewer-desktop`)

Native desktop viewer (Windows, macOS, Linux) for **Object Interactive Media (`.oim` / `.oim.png`)** built with **Tauri v2**, `@oim-media/player-oim`, and `@oim-media/core`.

## Download (Prebuilt Installers)

End users do not need to compile from source. Prebuilt Windows installers (`OIM Viewer_<version>_x64-setup.exe`, `OIM Viewer_<version>_x64_en-US.msi`, and portable `oim-viewer.exe`) are automatically built by CI and attached to every [GitHub Release](https://github.com/oim-media/oim/releases).

---

## Features

- **Zero-duplication architecture**: Mounts `<oim-player>` directly from `@oim-media/player-oim` and reads metadata/permissions through `@oim-media/core` (`permissionOf`, `isValidDynamicColorRole`, `isSafeCssColor`).
- **Cryptographic Signature Verification**: Displays ECDSA P-256 verification status (`Verified`, `Key expired`, `Unsigned`), signing key ID (`kid`), and re-edit permission (`reeditable` / `locked`).
- **Multilingual & Multi-page**: Reads `languages` and `pages` directly from `<oim-player>` with instant language and page switching.
- **Named Color Palettes (`1.20.0+`) & Dynamic Colors**: Switches author-defined palettes (`metadata.palettes` / `defaultPalette`) and dynamic color roles (`primary`, `secondary`, `accent`, `background`, `text`) live.
- **Technical Specs Inspector (`Info`)**: Displays signature state, contract version, aspect ratio, page count, languages, palettes, and re-edit permission.
- **Native OS Integration**: Supports Windows/macOS/Linux file associations (`.oim`, `.png`), single-instance file forwarding, native OS drag-and-drop (`tauri://drag-drop`), and strict WebView CSP.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+O` / `Cmd+O` | Open `.oim` / `.oim.png` file |
| `PageUp` / `PageDown` | Previous / Next page |
| `Ctrl+Shift+T` | Toggle canvas background (`dark` / `light` / `checker`) |
| `F11` | Toggle Fullscreen |
| `Esc` | Close open popover or exit Fullscreen |

---

## Development & Build (Contributors)

```bash
# Run unit tests and frontend build
pnpm --filter ./apps/viewer-desktop test
pnpm --filter ./apps/viewer-desktop build

# Run Rust IPC unit tests
cargo test --manifest-path apps/viewer-desktop/src-tauri/Cargo.toml

# Launch native Tauri desktop window (requires Rust toolchain)
pnpm --filter ./apps/viewer-desktop tauri dev

# Build native installers (.msi / .exe / .dmg / .AppImage)
pnpm --filter ./apps/viewer-desktop tauri build
```

## License

Apache-2.0 — Copyright (c) 2026 Xue Studios LLC.
