# OIM Viewer Desktop (`@oim-media/viewer-desktop`)

Native desktop viewer (Windows, macOS, Linux) for **Object Interactive Media (`.oim` / `.oim.png`)** built with **Tauri v2**, `@oim-media/player-oim`, and `@oim-media/core`.

---

## Features

- **Zero-duplication architecture**: Mounts `<oim-player>` directly from `@oim-media/player-oim` and reads metadata/permissions through `@oim-media/core` (`permissionOf`, `isValidDynamicColorRole`, `isSafeCssColor`).
- **Cryptographic Signature Verification**: Displays all 9 `OimSecurityStatus` states (`verified`, `verified_authorless`, `image_unsealed`, `expired_key`, `invalid_signature`, `image_mismatch`, `corrupt`, `no_metadata`, `unsigned`) and blocks tampered files (`OIM_ALTERED`).
- **Multilingual & Auto-Rotate**: Reads `player.languages` directly from `<oim-player>` with instant language switching and 3-second auto-rotation (`auto-rotate-lang`).
- **Named Color Palettes (`1.20.0+`)**: Switches author-defined palettes (`metadata.palettes` / `defaultPalette`) via the native `palette` attribute on `<oim-player>`.
- **Technical Specs Inspector (`I`)**: Displays file name, size, PNG `IHDR` dimensions, OIM schema version, interactive layer count/breakdown, and `reedit` policy (`public`, `author_only`, `sealed`).
- **Native OS Integration**: Supports Windows/macOS/Linux file associations (`.oim`, `.png`), single-instance file forwarding, native OS drag-and-drop (`tauri://drag-drop`), and strict WebView CSP.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+O` / `Cmd+O` | Open `.oim` / `.oim.png` file |
| `Space` | Play / Pause animations |
| `L` | Toggle interactive layers (`show-slots`) |
| `I` | Toggle Technical Specs popover |
| `F11` / `Esc` | Toggle Fullscreen |

---

## Development & Build

```bash
# Run web preview / frontend tests
pnpm --filter @oim-media/viewer-desktop test
pnpm --filter @oim-media/viewer-desktop build

# Launch native Tauri desktop window (requires Rust toolchain)
pnpm --filter @oim-media/viewer-desktop tauri dev

# Build native installers (.msi / .exe / .dmg / .AppImage)
pnpm --filter @oim-media/viewer-desktop tauri build
```

## License

Apache-2.0 — Copyright (c) 2026 Xue Studios LLC.
