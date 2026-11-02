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
        .invoke_handler(tauri::generate_handler![take_initial_file, read_oim_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
