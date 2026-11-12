// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::indexing_slicing)]

use std::fs;
use std::path::PathBuf;
use std::time::SystemTime;

use oim::*;
use serde_json::{Value, json};

fn vectors_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../packages/spec/vectors")
}

fn vectors() -> Vec<(String, Vec<u8>, Value)> {
    let mut out: Vec<_> = fs::read_dir(vectors_dir())
        .unwrap()
        .filter_map(|e| {
            let name = e.unwrap().file_name().into_string().unwrap();
            let stem = name.strip_suffix(".oim.png")?.to_owned();
            let png = fs::read(vectors_dir().join(&name)).unwrap();
            let expected =
                fs::read_to_string(vectors_dir().join(format!("{stem}.expected.json"))).unwrap();
            Some((stem, png, serde_json::from_str(&expected).unwrap()))
        })
        .collect();
    out.sort_by(|a, b| a.0.cmp(&b.0));
    out
}

fn vector(name: &str) -> Vec<u8> {
    fs::read(vectors_dir().join(format!("{name}.oim.png"))).unwrap()
}

/// Rewrites the chunks of a PNG, recomputing nothing but what the edit needs.
fn chunks(png: &[u8]) -> Vec<(Vec<u8>, Vec<u8>)> {
    let mut out = Vec::new();
    let mut at = 8;
    while at + 8 <= png.len() {
        let len = u32::from_be_bytes(png[at..at + 4].try_into().unwrap()) as usize;
        out.push((
            png[at + 4..at + 8].to_vec(),
            png[at + 8..at + 8 + len].to_vec(),
        ));
        at += 12 + len;
    }
    out
}

fn build(chunks: &[(Vec<u8>, Vec<u8>)]) -> Vec<u8> {
    let mut out = b"\x89PNG\r\n\x1a\n".to_vec();
    for (kind, data) in chunks {
        out.extend((data.len() as u32).to_be_bytes());
        out.extend(kind);
        out.extend(data);
        out.extend([0, 0, 0, 0]); // CRC is not checked by readers
    }
    out
}

fn ztxt(meta: &Value) -> (Vec<u8>, Vec<u8>) {
    use std::io::Write;
    let mut z = flate2::write::ZlibEncoder::new(Vec::new(), flate2::Compression::default());
    z.write_all(meta.to_string().as_bytes()).unwrap();
    let mut data = b"OIM_Data\0\0".to_vec();
    data.extend(z.finish().unwrap());
    (b"zTXt".to_vec(), data)
}

/// The vector with its OIM chunk replaced by `meta`.
fn with_metadata(name: &str, meta: &Value) -> Vec<u8> {
    let mut cs: Vec<_> = chunks(&vector(name))
        .into_iter()
        .filter(|(k, d)| !(k.ends_with(b"TXt") && d.starts_with(b"OIM_")))
        .collect();
    cs.insert(1, ztxt(meta));
    build(&cs)
}

fn status(png: &[u8]) -> SecurityStatus {
    verify(&extract(png).unwrap(), SystemTime::now())
}

// --- conformance ---

#[test]
fn every_vector_extracts_and_verifies() {
    let all = vectors();
    assert!(all.len() >= 30, "found {} vectors", all.len());
    for (name, png, expected) in all {
        let e = extract(&png).unwrap_or_else(|err| panic!("{name}: {err}"));
        // Vectors signed before the image seal existed verify as unsealed, as in the Flutter suite.
        let want = if e.metadata.get("image_hash_alg").is_none() {
            SecurityStatus::ImageUnsealed
        } else if expected["reedit"] == "public" {
            SecurityStatus::VerifiedAuthorless
        } else {
            SecurityStatus::Verified
        };
        assert_eq!(verify(&e, SystemTime::now()), want, "{name}");
        assert_eq!(
            e.metadata["slots"].as_array().map(Vec::len),
            expected["slots"].as_array().map(Vec::len),
            "{name}"
        );
    }
}

#[test]
fn reedit_english_vector_is_public() {
    let e = extract(&vector("reedit-english")).unwrap();
    assert_eq!(reedit_permission(&e.metadata), ReeditPermission::Public);
}

// --- tampering ---

#[test]
fn changed_image_is_a_mismatch() {
    let mut cs = chunks(&vector("basic-text"));
    let idat = cs.iter_mut().find(|(k, _)| k == b"IDAT").unwrap();
    idat.1[0] ^= 1;
    let png = build(&cs);
    assert_eq!(status(&png), SecurityStatus::ImageMismatch);
    assert!(is_refused(SecurityStatus::ImageMismatch));
}

#[test]
fn changed_signed_field_is_invalid() {
    let mut meta = extract(&vector("basic-text")).unwrap().metadata;
    meta["slots"][0]["id"] = json!("tampered");
    assert_eq!(
        status(&with_metadata("basic-text", &meta)),
        SecurityStatus::InvalidSignature
    );
    assert!(is_refused(SecurityStatus::InvalidSignature));
}

#[test]
fn missing_signature_is_unsigned() {
    let mut meta = extract(&vector("basic-text")).unwrap().metadata;
    meta.as_object_mut().unwrap().remove("signature");
    assert_eq!(
        status(&with_metadata("basic-text", &meta)),
        SecurityStatus::Unsigned
    );
    assert!(!is_refused(SecurityStatus::Unsigned));
}

#[test]
fn unknown_key_is_reported() {
    let mut meta = extract(&vector("basic-text")).unwrap().metadata;
    meta["key_version"] = json!("v99");
    assert_eq!(
        status(&with_metadata("basic-text", &meta)),
        SecurityStatus::UnknownKey
    );
}

#[test]
fn malformed_signature_is_invalid_not_a_crash() {
    for bad in ["%%%", "AAAA", "QUJD"] {
        let mut meta = extract(&vector("basic-text")).unwrap().metadata;
        meta["signature"] = json!(bad);
        assert_eq!(
            status(&with_metadata("basic-text", &meta)),
            SecurityStatus::InvalidSignature,
            "{bad}"
        );
    }
}

#[test]
fn key_version_must_be_a_string() {
    let mut meta = extract(&vector("basic-text")).unwrap().metadata;
    meta["key_version"] = json!(1);
    assert_eq!(
        status(&with_metadata("basic-text", &meta)),
        SecurityStatus::Unsigned
    );
}

// --- extraction ---

#[test]
fn not_a_png_is_not_oim() {
    assert_eq!(extract(&[]), Err(OimError::NotOim));
    assert_eq!(extract(b"\xFF\xD8\xFF\xE0"), Err(OimError::NotOim));
}

#[test]
fn png_without_oim_chunk_is_not_oim() {
    let cs: Vec<_> = chunks(&vector("basic-text"))
        .into_iter()
        .filter(|(k, _)| !k.ends_with(b"TXt"))
        .collect();
    assert_eq!(extract(&build(&cs)), Err(OimError::NotOim));
}

#[test]
fn cut_file_is_truncated() {
    let png = vector("basic-text");
    assert_eq!(extract(&png[..100]), Err(OimError::Truncated));
}

#[test]
fn oversized_chunk_length_is_truncated() {
    let mut png = b"\x89PNG\r\n\x1a\n".to_vec();
    png.extend(u32::MAX.to_be_bytes());
    png.extend(b"tEXt");
    assert_eq!(extract(&png), Err(OimError::Truncated));
}

#[test]
fn corrupt_payload_is_corrupt() {
    let mut cs: Vec<_> = chunks(&vector("basic-text"))
        .into_iter()
        .filter(|(k, _)| !k.ends_with(b"TXt"))
        .collect();
    cs.insert(
        1,
        (b"zTXt".to_vec(), b"OIM_Data\0\0not zlib at all".to_vec()),
    );
    assert!(matches!(extract(&build(&cs)), Err(OimError::Corrupt(_))));
}

#[test]
fn last_oim_chunk_wins() {
    let mut cs = chunks(&vector("basic-text"));
    let at = cs.iter().rposition(|(k, _)| k == b"IEND").unwrap();
    cs.insert(at, ztxt(&json!({"title": "second"})));
    assert_eq!(extract(&build(&cs)).unwrap().metadata["title"], "second");
}

#[test]
fn text_chunks_in_every_encoding() {
    use base64::Engine;
    use std::io::Write;
    let meta = json!({"title": "ñ"});
    let mut raw = flate2::write::DeflateEncoder::new(Vec::new(), flate2::Compression::default());
    raw.write_all(meta.to_string().as_bytes()).unwrap();
    let raw = raw.finish().unwrap();
    let b64 = base64::engine::general_purpose::STANDARD.encode(&raw);

    let text_raw = [b"OIM_Data\0".as_slice(), &raw].concat();
    let text_b64 = [b"OIM_Data\0".as_slice(), b64.as_bytes()].concat();
    let itxt = [
        b"OIM_JSON_DATA\0\0\0en\0\0".as_slice(),
        meta.to_string().as_bytes(),
    ]
    .concat();
    for (kind, data) in [(b"tEXt", text_raw), (b"tEXt", text_b64), (b"iTXt", itxt)] {
        let png = build(&[
            (b"IHDR".to_vec(), vec![0; 13]),
            (kind.to_vec(), data),
            (b"IEND".to_vec(), vec![]),
        ]);
        let e = extract(&png).unwrap();
        assert_eq!(e.metadata, meta);
        assert_eq!(e.image_hash, None);
    }
}

#[test]
fn legacy_text_chunk_vector_extracts() {
    assert!(extract(&vector("legacy-text-chunk")).is_ok());
}

#[test]
fn image_hash_is_sha256_of_idat() {
    use sha2::{Digest, Sha256};
    let png = vector("basic-text");
    let idat: Vec<u8> = chunks(&png)
        .into_iter()
        .filter(|(k, _)| k == b"IDAT")
        .flat_map(|(_, d)| d)
        .collect();
    let want: String = Sha256::digest(&idat)
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect();
    assert_eq!(
        extract(&png).unwrap().image_hash.as_deref(),
        Some(want.as_str())
    );
}

// --- canonical form ---

// The case lives in packages/spec/canonical-cases.json so every implementation
// rebuilds the same signed bytes. It is read from text on purpose: the JSON
// parser is part of what is under test (serde_json needs float_roundtrip).
#[test]
fn canonical_matches_the_shared_known_answer_case() {
    let path =
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../packages/spec/canonical-cases.json");
    let case: Value = serde_json::from_str(&fs::read_to_string(path).unwrap()).unwrap();
    assert_eq!(
        canonical_json(&case["input"]),
        case["expected"].as_str().unwrap()
    );
}

#[test]
fn canonical_numbers_follow_javascript() {
    let cases = [
        (json!({"b": 1, "a": 2.0}), r#"{"a":2,"b":1}"#),
        (json!({"n": -0.0}), r#"{"n":0}"#),
        (json!({"n": 2.0000001}), r#"{"n":2}"#),
        (json!({"n": 1e-7}), r#"{"n":0}"#),
        (json!({"n": 0.1 + 0.2}), r#"{"n":0.3}"#),
        (json!({"n": 1.5}), r#"{"n":1.5}"#),
        (json!({"n": 123456.1234567}), r#"{"n":123456.123457}"#),
        (json!({"n": 0.000001}), r#"{"n":0.000001}"#),
    ];
    for (v, want) in cases {
        assert_eq!(canonical_json(&v), want);
    }
}

#[test]
fn canonical_drops_transport_keys_at_root_only() {
    let v = json!({"signature": "s", "key_version": "v1", "timestamp": 1, "creator_user_id": "u", "x": {"signature": 1}});
    assert_eq!(canonical_json(&v), r#"{"x":{"signature":1}}"#);
}

#[test]
fn canonical_orders_by_code_point_and_keeps_utf8() {
    let v = json!({"😀": 1, "\u{FFFF}": 2, "t": "ñ\n"});
    assert_eq!(
        canonical_json(&v),
        "{\"t\":\"ñ\\n\",\"\u{FFFF}\":2,\"😀\":1}"
    );
}

// --- content and permission ---

#[test]
fn resolve_content_matches_the_players() {
    assert_eq!(DEFAULT_LANGUAGE, "en");
    assert_eq!(
        resolve_content(&json!({"es": "Hola", "en": "Hello"}), "es"),
        "Hola"
    );
    assert_eq!(
        resolve_content(&json!({"es": "Hola", "en": "Hello"}), "fr"),
        "Hello"
    );
    assert_eq!(
        resolve_content(&json!({"es": "", "en": "Hello"}), "es"),
        "Hello"
    );
    assert_eq!(resolve_content(&json!({"pt-BR": "Olá"}), "pt-br"), "Olá");
    assert_eq!(
        resolve_content(&json!({"*": "img.png", "en": ""}), "en"),
        ""
    );
    assert_eq!(
        resolve_content(&json!({"*": "img.png", "en": "b.png"}), "es"),
        "img.png"
    );
    assert_eq!(resolve_content(&json!({"de": "Hallo"}), "fr"), "Hallo");
    assert_eq!(
        resolve_content(&json!({"z": "first", "a": "second"}), "fr"),
        "first"
    );
    assert_eq!(resolve_content(&Value::Null, "fr"), "");
    assert_eq!(resolve_content(&json!("plain"), "fr"), "plain");
}

#[test]
fn reedit_permission_reads_legacy_and_defaults_safely() {
    assert_eq!(reedit_permission(&json!({})), ReeditPermission::AuthorOnly);
    assert_eq!(
        reedit_permission(&json!({"reedit": "public"})),
        ReeditPermission::Public
    );
    assert_eq!(
        reedit_permission(&json!({"reedit": "weird"})),
        ReeditPermission::AuthorOnly
    );
    assert_eq!(
        reedit_permission(&json!({"reedicion": "publico"})),
        ReeditPermission::Public
    );
    assert_eq!(
        reedit_permission(&json!({"reedicion": "sellado"})),
        ReeditPermission::Sealed
    );
    assert_eq!(
        reedit_permission(&json!({"reedit": "public", "reedicion": "sellado"})),
        ReeditPermission::Public
    );
    assert_eq!(
        reedit_permission(&json!({"reedit": "public", "immutable_lock": true})),
        ReeditPermission::Sealed
    );
}

#[test]
fn crate_version_is_the_contract_version() {
    let core = fs::read_to_string(
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../packages/core/src/compatibility.ts"),
    )
    .unwrap();
    assert!(core.contains(&format!(
        "export const CONTRACT_VERSION = \"{CONTRACT_VERSION}\";"
    )));
}

// --- review findings ---

#[test]
fn canonical_ties_round_up_in_magnitude_like_to_fixed() {
    for (v, want) in [
        (json!({"a": 0.0078125}), r#"{"a":0.007813}"#),
        (json!({"a": -0.0078125}), r#"{"a":-0.007813}"#),
        (json!({"a": 0.0390625}), r#"{"a":0.039063}"#),
    ] {
        assert_eq!(canonical_json(&v), want);
    }
}

#[test]
fn canonical_integers_beyond_2_53_print_like_javascript() {
    let v: Value =
        serde_json::from_str(r#"{"a":9007199254740993,"b":100000000000000000000000}"#).unwrap();
    assert_eq!(canonical_json(&v), r#"{"a":9007199254740992,"b":1e+23}"#);
}

#[test]
fn idat_after_iend_is_hashed_like_the_core() {
    let mut cs = chunks(&vector("basic-text"));
    cs.push((b"IDAT".to_vec(), vec![1, 2, 3]));
    assert_eq!(status(&build(&cs)), SecurityStatus::ImageMismatch);
}

#[test]
fn deflated_text_chunk_wins_over_a_later_ztxt() {
    use std::io::Write;
    let mut raw = flate2::write::DeflateEncoder::new(Vec::new(), flate2::Compression::default());
    raw.write_all(br#"{"title":"first"}"#).unwrap();
    let text = [b"OIM_Data\0".as_slice(), &raw.finish().unwrap()].concat();
    let png = build(&[
        (b"tEXt".to_vec(), text),
        ztxt(&json!({"title": "second"})),
        (b"IEND".to_vec(), vec![]),
    ]);
    assert_eq!(extract(&png).unwrap().metadata["title"], "first");
}

#[test]
fn a_later_broken_chunk_keeps_the_earlier_payload() {
    let png = build(&[
        ztxt(&json!({"title": "ok"})),
        (b"zTXt".to_vec(), b"OIM_Data\0\0broken".to_vec()),
        (b"IEND".to_vec(), vec![]),
    ]);
    assert_eq!(extract(&png).unwrap().metadata["title"], "ok");
}

#[test]
fn null_reedit_falls_back_to_legacy_key() {
    assert_eq!(
        reedit_permission(&json!({"reedit": null, "reedicion": "publico"})),
        ReeditPermission::Public
    );
}
