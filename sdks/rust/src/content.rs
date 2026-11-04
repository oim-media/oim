// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

use serde_json::{Map, Value};

/// Language used when the caller does not set one, as in the web player (1.26.0).
pub const DEFAULT_LANGUAGE: &str = "en";

/// A layer's content in `lang`. Mirrors `resolveContent` in `@oim-media/player-oim`:
/// requested, `en`, `es`, `default`, then the first value; with `"*"` an own key is final.
pub fn resolve_content(content: &Value, lang: &str) -> String {
    let map = match content {
        Value::Object(map) => map,
        other => return text(other),
    };
    if map.contains_key("*") {
        return by_lang(map, lang, false)
            .unwrap_or_else(|| map.get("*").map(text).unwrap_or_default());
    }
    [lang, "en", "es", "default"]
        .iter()
        .find_map(|l| by_lang(map, l, true))
        .unwrap_or_else(|| map.values().next().map(text).unwrap_or_default())
}

fn by_lang(map: &Map<String, Value>, lang: &str, skip_empty: bool) -> Option<String> {
    map.iter()
        .filter(|(k, v)| k.to_lowercase() == lang.to_lowercase() && !v.is_null())
        .map(|(_, v)| text(v))
        .find(|s| !(skip_empty && s.is_empty()))
}

fn text(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Null => String::new(),
        other => other.to_string(),
    }
}
