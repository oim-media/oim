// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

use std::path::Path;
use std::sync::Mutex;
use tauri::{Emitter, Manager, State};

const MAX_OIM_FILE_BYTES: u64 = 100 * 1024 * 1024;

struct InitialFile(Mutex<Option<String>>);

fn is_allowed_oim_path(path: &str) -> bool {
    Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("oim") || ext.eq_ignore_ascii_case("png"))
        .unwrap_or(false)
}

#[tauri::command]
fn take_initial_file(state: State<'_, InitialFile>) -> Option<String> {
    state.0.lock().ok().and_then(|mut guard| guard.take())
}

#[tauri::command]
fn read_oim_file(path: String) -> Result<Vec<u8>, String> {
    if !is_allowed_oim_path(&path) {
        return Err("Unsupported file extension (expected .oim or .png)".into());
    }
    let meta = std::fs::metadata(&path).map_err(|e| format!("Cannot read file metadata: {e}"))?;
    if !meta.is_file() {
        return Err("Path is not a regular file".into());
    }
    if meta.len() > MAX_OIM_FILE_BYTES {
        return Err("File exceeds 100 MB safety limit".into());
    }
    std::fs::read(&path).map_err(|e| format!("Cannot read file bytes: {e}"))
}

#[tauri::command]
async fn read_remote_oim_file(url: String) -> Result<Vec<u8>, String> {
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err("Only HTTP/HTTPS URLs are allowed".into());
    }
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    let res = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {e}"))?;

    if !res.status().is_success() {
        return Err(format!("Remote server returned HTTP {}", res.status()));
    }

    let bytes = res
        .bytes()
        .await
        .map_err(|e| format!("Failed to read response body: {e}"))?;

    if bytes.len() > 100 * 1024 * 1024 {
        return Err("Remote file exceeds 100 MB limit".into());
    }

    Ok(bytes.to_vec())
}


#[tauri::command]
async fn set_window_fullscreen(window: tauri::WebviewWindow, fullscreen: bool) -> Result<bool, String> {
    window
        .set_fullscreen(fullscreen)
        .map_err(|e| format!("Cannot set fullscreen: {e}"))?;

    // Windows: after the switch the physical cursor could stay frozen until Alt+Tab or Esc (which
    // reset the clip rect and capture). This command runs on a worker thread, where ReleaseCapture
    // does nothing, and before the main thread has applied the fullscreen; so release on the main
    // thread, once now and again after the resize has settled.
    #[cfg(windows)]
    for delay_ms in [0u64, 150, 500] {
        let w = window.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(delay_ms));
            let _ = w.run_on_main_thread(|| unsafe {
                use windows_sys::Win32::UI::Input::KeyboardAndMouse::ReleaseCapture;
                use windows_sys::Win32::UI::WindowsAndMessaging::ClipCursor;
                ReleaseCapture();
                ClipCursor(std::ptr::null());
            });
        });
    }

    let _ = window.set_cursor_visible(true);
    let _ = window.set_focus();

    window
        .is_fullscreen()
        .map_err(|e| format!("Cannot check fullscreen state: {e}"))
}

fn main() {
    let initial_arg = std::env::args()
        .nth(1)
        .filter(|arg| is_allowed_oim_path(arg));

    tauri::Builder::default()
        .manage(InitialFile(Mutex::new(initial_arg)))
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
                let _ = window.unminimize();
            }
            if let Some(arg) = args.get(1) {
                if is_allowed_oim_path(arg) {
                    let _ = app.emit("open-file", arg);
                }
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            take_initial_file,
            read_oim_file,
            read_remote_oim_file,
            set_window_fullscreen
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_only_oim_and_png_extensions() {
        assert!(is_allowed_oim_path("poster.oim.png"));
        assert!(is_allowed_oim_path("poster.OIM"));
        assert!(is_allowed_oim_path("C:\\Users\\demo\\card.PNG"));
        assert!(!is_allowed_oim_path("secret.txt"));
        assert!(!is_allowed_oim_path("no-extension"));
    }

    #[test]
    fn read_oim_file_rejects_disallowed_extension_and_missing_files() {
        let err = read_oim_file("notes.txt".into()).unwrap_err();
        assert!(err.contains("Unsupported file extension"));

        let missing = read_oim_file("nonexistent-test-vector.oim.png".into()).unwrap_err();
        assert!(missing.contains("Cannot read file metadata"));
    }

    #[test]
    fn read_oim_file_reads_valid_png_asset() {
        let icon_path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("icons")
            .join("32x32.png");
        let bytes = read_oim_file(icon_path.to_string_lossy().into_owned())
            .expect("should read valid .png file");
        assert!(bytes.starts_with(b"\x89PNG\r\n\x1a\n"));
    }
}
