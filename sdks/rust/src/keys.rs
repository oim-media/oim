// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

//! Public keys this crate trusts: the set in `packages/spec/keys.json`
//! (a test keeps them equal). Embedded, never fetched.

pub(crate) struct PublicKey {
    pub kid: &'static str,
    /// Base64url affine coordinates of the P-256 point (JWK `x`, `y`).
    pub x: &'static str,
    pub y: &'static str,
    /// Unix seconds after which this crate stops trusting the key. Only set on a
    /// compromised key; a routine rotation leaves old keys trusted.
    pub verify_until: Option<u64>,
}

pub(crate) const EMBEDDED_KEYS: [PublicKey; 2] = [
    PublicKey {
        kid: "v1",
        x: "5Qavr4M_npVognquI5k5D9K8wcXBXM9Z0mZHjqyehAs",
        y: "oh7rz5Q7SlZT_ms2buyOw0bPX77QsXimc0X92Ymj2_o",
        verify_until: None,
    },
    // Standby key, held offline by Xue Studios.
    PublicKey {
        kid: "v2",
        x: "pRSLtFHe9p8sR8jyqP5eoaBGbHdJgjjrdClda2lNp4A",
        y: "oopYYhgja8m2iAlSMPigeWw-F72KJLNCRFQzlyWdt2I",
        verify_until: None,
    },
];

/// A device clock a few days off must not switch valid works off.
pub(crate) const CLOCK_SKEW_SECS: u64 = 7 * 24 * 3600;

pub(crate) fn embedded_key(kid: &str) -> Option<&'static PublicKey> {
    EMBEDDED_KEYS.iter().find(|k| k.kid == kid)
}

#[cfg(test)]
#[allow(clippy::indexing_slicing)]
mod tests {
    #[test]
    fn match_the_spec_key_set() {
        let spec: serde_json::Value =
            serde_json::from_str(include_str!("../../../packages/spec/keys.json"))
                .unwrap_or_default();
        let keys = spec["keys"].as_array().cloned().unwrap_or_default();
        assert_eq!(keys.len(), super::EMBEDDED_KEYS.len());
        for (k, e) in keys.iter().zip(super::EMBEDDED_KEYS.iter()) {
            assert_eq!(k["kid"], e.kid);
            assert_eq!(k["jwk"]["x"], e.x);
            assert_eq!(k["jwk"]["y"], e.y);
            assert!(k.get("verifyUntil").is_none() && e.verify_until.is_none());
        }
    }
}
