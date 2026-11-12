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

/// Integers JavaScript holds exactly; beyond it a JSON integer becomes the nearest double.
const MAX_SAFE_INTEGER: u64 = 1 << 53;

/// Largest magnitude a signed number may have (2^53 - 1): every JSON parser reads it exactly.
const MAX_CANONICAL_NUMBER: u64 = (1 << 53) - 1;

/// Whether the metadata carries, at any depth, a number with no canonical form.
/// Beyond 2^53 - 1 parsers disagree on the value they read, so such a file's
/// signature is invalid (BINARY_SPEC 5.1 rule 3).
pub fn has_number_out_of_range(value: &Value) -> bool {
    match value {
        Value::Number(n) => {
            if let Some(i) = n.as_i64().map(i64::unsigned_abs).or(n.as_u64()) {
                return i > MAX_CANONICAL_NUMBER;
            }
            n.as_f64()
                .is_none_or(|x| !x.is_finite() || x.abs() > MAX_CANONICAL_NUMBER as f64)
        }
        Value::Array(items) => items.iter().any(has_number_out_of_range),
        Value::Object(map) => map.values().any(has_number_out_of_range),
        _ => false,
    }
}

/// JavaScript prints numbers with `Number.prototype.toString`; rule 3 rounds
/// non-integers with `toFixed(6)` first.
fn format_number(n: &Number, normalize: bool) -> String {
    let exact_int = n.as_i64().map(i64::unsigned_abs).or(n.as_u64());
    if exact_int.is_some_and(|i| i <= MAX_SAFE_INTEGER) {
        return n.to_string();
    }
    let Some(mut x) = n.as_f64() else {
        return "null".into();
    };
    if normalize && x.fract() != 0.0 {
        x = to_fixed_6(x);
    }
    ryu_js::Buffer::new().format(x).to_string()
}

/// `Number(x.toFixed(6))`. Rust's formatter breaks an exact tie to even; `toFixed`
/// picks the larger magnitude, so an exact tie (`0.0078125`) is rounded up by hand.
fn to_fixed_6(x: f64) -> f64 {
    let magnitude = x.abs();
    // A tie has at most 7 decimals; 40 exact digits show the zeros after it.
    let exact = format!("{magnitude:.40}");
    let decimals = exact.split_once('.').map_or("", |(_, d)| d);
    let is_tie = decimals.get(6..7) == Some("5")
        && decimals
            .get(7..)
            .is_some_and(|r| r.bytes().all(|b| b == b'0'));
    let rounded: f64 = if is_tie {
        let down: f64 = format!("{magnitude:.6}").parse().unwrap_or(magnitude);
        let up = exact
            .get(..exact.len() - 34)
            .and_then(|s| s.parse::<f64>().ok())
            .unwrap_or(down)
            + 1e-6;
        format!("{up:.6}").parse().unwrap_or(down)
    } else {
        format!("{magnitude:.6}").parse().unwrap_or(magnitude)
    };
    rounded.copysign(x)
}

/// `serde_json` escapes exactly like `JSON.stringify` for valid UTF-8.
fn write_string(out: &mut String, s: &str) {
    out.push_str(&Value::String(s.to_owned()).to_string());
}
