// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

use serde_json::Value;

/// Who may re-edit a file. Mirrors `permissionOf` in `@oim-media/core`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReeditPermission {
    Public,
    AuthorOnly,
    Sealed,
}

/// Reads `reedit` (or the pre-1.23.0 `reedicion`). An unknown value is
/// `AuthorOnly`, never `Public`: corrupt or tampered data must not loosen a permission.
pub fn reedit_permission(metadata: &Value) -> ReeditPermission {
    let is_true = |k: &str| metadata.get(k) == Some(&Value::Bool(true));
    if is_true("immutable_lock") || is_true("immutable") {
        return ReeditPermission::Sealed;
    }
    let value = match metadata.get("reedit").filter(|v| !v.is_null()) {
        Some(v) => v.as_str(),
        None => metadata.get("reedicion").map(|l| match l.as_str() {
            Some("publico") => "public",
            Some("sellado") => "sealed",
            _ => "author_only",
        }),
    };
    match value {
        Some("public") => ReeditPermission::Public,
        Some("sealed") => ReeditPermission::Sealed,
        _ => ReeditPermission::AuthorOnly,
    }
}
