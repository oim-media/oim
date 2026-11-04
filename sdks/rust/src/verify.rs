// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

//! The single place that decides a file's security status. Mirrors
//! `securityVerdict` in `@oim-media/player-oim` and `verifyOim` in the Flutter SDK.

use std::time::{SystemTime, UNIX_EPOCH};

use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::engine::{DecodePaddingMode, GeneralPurpose, GeneralPurposeConfig};
use p256::EncodedPoint;
use p256::ecdsa::signature::Verifier;
use p256::ecdsa::{Signature, VerifyingKey};
use serde_json::Value;

use crate::canonical::{canonical_json, legacy_canonical_json};
use crate::keys::{CLOCK_SKEW_SECS, PublicKey, embedded_key};
use crate::{Extraction, ReeditPermission, reedit_permission};

/// The seal scheme the backend writes in `image_hash_alg`: SHA-256 of the IDAT payloads.
const IMAGE_HASH_ALG: &str = "sha256-idat";
const URL_SAFE_ANY_PAD: GeneralPurpose = GeneralPurpose::new(
    &base64::alphabet::URL_SAFE,
    GeneralPurposeConfig::new().with_decode_padding_mode(DecodePaddingMode::Indifferent),
);

/// What can be said about a file, from strongest to weakest claim. Same
/// vocabulary as the player, plus `UnknownKey`: this crate never fetches a key.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SecurityStatus {
    Verified,
    VerifiedAuthorless,
    ImageUnsealed,
    Unsigned,
    ExpiredKey,
    InvalidSignature,
    ImageMismatch,
    UnknownKey,
}

/// Altered files are refused outright: neither their image nor their layers are shown.
pub fn is_refused(status: SecurityStatus) -> bool {
    matches!(
        status,
        SecurityStatus::ImageMismatch | SecurityStatus::InvalidSignature
    )
}

/// Judges a file's signature and image seal with the embedded keys; `now` decides key expiry.
pub fn verify(extraction: &Extraction, now: SystemTime) -> SecurityStatus {
    let meta = &extraction.metadata;
    let (Some(signature), Some(kid)) = (
        meta.get("signature")
            .and_then(Value::as_str)
            .filter(|s| !s.is_empty()),
        meta.get("key_version").and_then(Value::as_str),
    ) else {
        return SecurityStatus::Unsigned;
    };
    let Some(key) = embedded_key(kid) else {
        return SecurityStatus::UnknownKey;
    };
    if !signature_is_valid(meta, key, signature) {
        return SecurityStatus::InvalidSignature;
    }
    if key_expired(key, now) {
        return SecurityStatus::ExpiredKey;
    }

    let seal = match (
        meta.get("image_hash_alg").and_then(Value::as_str),
        meta.get("image_hash").and_then(Value::as_str),
    ) {
        (Some(IMAGE_HASH_ALG), Some(hash)) if !hash.is_empty() => hash,
        _ => return SecurityStatus::ImageUnsealed,
    };
    match &extraction.image_hash {
        Some(actual) if actual.eq_ignore_ascii_case(seal) => {}
        _ => return SecurityStatus::ImageMismatch,
    }

    if reedit_permission(meta) == ReeditPermission::Public {
        SecurityStatus::VerifiedAuthorless
    } else {
        SecurityStatus::Verified
    }
}

// shortcut: the key's `notAfter` (signing window) is not checked, since no key
// declares one; add it with `signed_at` parsing when a key gets one.
fn signature_is_valid(meta: &Value, key: &PublicKey, signature: &str) -> bool {
    let clean: String = signature.chars().filter(|c| !c.is_whitespace()).collect();
    let Ok(bytes) = URL_SAFE_ANY_PAD.decode(clean.replace('+', "-").replace('/', "_")) else {
        return false;
    };
    let (Ok(sig), Some(vk)) = (Signature::from_slice(&bytes), verifying_key(key)) else {
        return false;
    };
    if vk.verify(canonical_json(meta).as_bytes(), &sig).is_ok() {
        return true;
    }
    // Files published before `creator_user_id` was excluded kept it in the signed bytes.
    meta.get("creator_user_id").is_some_and(|v| !v.is_null())
        && vk
            .verify(legacy_canonical_json(meta).as_bytes(), &sig)
            .is_ok()
}

fn verifying_key(key: &PublicKey) -> Option<VerifyingKey> {
    let x = URL_SAFE_NO_PAD.decode(key.x).ok()?;
    let y = URL_SAFE_NO_PAD.decode(key.y).ok()?;
    // `into()` below panics on any other length.
    if x.len() != 32 || y.len() != 32 {
        return None;
    }
    let point =
        EncodedPoint::from_affine_coordinates(x.as_slice().into(), y.as_slice().into(), false);
    VerifyingKey::from_encoded_point(&point).ok()
}

fn key_expired(key: &PublicKey, now: SystemTime) -> bool {
    let Some(limit) = key.verify_until else {
        return false;
    };
    let now = now.duration_since(UNIX_EPOCH).map_or(0, |d| d.as_secs());
    now > limit.saturating_add(CLOCK_SKEW_SECS)
}
