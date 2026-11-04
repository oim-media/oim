// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

//! Canonical serialization: the 7 rules of BINARY_SPEC §5.1, byte for byte the
//! output of `serializeCanonical` in `@oim-media/core` (canonical.ts).

use serde_json::{Map, Number, Value};

const EXCLUDED_ROOT_KEYS: [&str; 4] = ["signature", "key_version", "timestamp", "creator_user_id"];
const LEGACY_EXCLUDED_ROOT_KEYS: [&str; 3] = ["signature", "key_version", "timestamp"];

/// The signed form of `metadata`: root exclusions, numbers rounded to 6 decimals,
/// keys by code point, compact, non-ASCII unescaped.
pub fn canonical_json(metadata: &Value) -> String {
    let mut out = String::new();
    match metadata {
        Value::Object(map) => write_object(&mut out, map, &EXCLUDED_ROOT_KEYS, true),
        _ => out.push_str("{}"),
    }
    out
}

/// Files signed before `creator_user_id` was excluded: only the three transport
/// keys are dropped, keys sorted as JavaScript's default sort (UTF-16), numbers untouched.
pub(crate) fn legacy_canonical_json(metadata: &Value) -> String {
    let mut out = String::new();
    if let Value::Object(map) = metadata {
        write_object(&mut out, map, &LEGACY_EXCLUDED_ROOT_KEYS, false);
    }
    out
}

fn write_object(out: &mut String, map: &Map<String, Value>, excluded: &[&str], normalize: bool) {
    let mut keys: Vec<&String> = map
        .keys()
        .filter(|k| !excluded.contains(&k.as_str()))
        .collect();
    if normalize {
        // UTF-8 byte order is code point order.
        keys.sort();
    } else {
        keys.sort_by(|a, b| a.encode_utf16().cmp(b.encode_utf16()));
    }
    out.push('{');
    for (i, key) in keys.iter().enumerate() {
        if i > 0 {
            out.push(',');
        }
        write_string(out, key);
        out.push(':');
        if let Some(v) = map.get(key.as_str()) {
            write_value(out, v, normalize);
        }
    }
    out.push('}');
}

fn write_value(out: &mut String, v: &Value, normalize: bool) {
    match v {
        Value::Null => out.push_str("null"),
        Value::Bool(b) => out.push_str(if *b { "true" } else { "false" }),
        Value::Number(n) => out.push_str(&format_number(n, normalize)),
        Value::String(s) => write_string(out, s),
        Value::Array(items) => {
            out.push('[');
            for (i, item) in items.iter().enumerate() {
                if i > 0 {
                    out.push(',');
                }
                write_value(out, item, normalize);
            }
            out.push(']');
        }
        Value::Object(map) => write_object(out, map, &[], normalize),
    }
}

/// JavaScript prints numbers with `Number.prototype.toString`; rule 3 rounds
/// non-integers with `toFixed(6)` first.
fn format_number(n: &Number, normalize: bool) -> String {
    if n.is_i64() || n.is_u64() {
        return n.to_string();
    }
    let Some(mut x) = n.as_f64() else {
        return "null".into();
    };
    if normalize && x.fract() != 0.0 {
        x = format!("{x:.6}").parse().unwrap_or(x);
    }
    ryu_js::Buffer::new().format(x).to_string()
}

/// `serde_json` escapes exactly like `JSON.stringify` for valid UTF-8.
fn write_string(out: &mut String, s: &str) {
    out.push_str(&Value::String(s.to_owned()).to_string());
}
