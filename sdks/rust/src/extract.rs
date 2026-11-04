// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

//! Reads the `OIM_Data` chunk of a PNG. Mirrors `extractOIM` in `@oim-media/core`
//! (binary.ts) and BINARY_SPEC §3.

use std::io::Read;

use base64::Engine;
use base64::engine::{DecodePaddingMode, GeneralPurpose, GeneralPurposeConfig};
use flate2::read::{DeflateDecoder, ZlibDecoder};
use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::OimError;

const PNG_SIGNATURE: &[u8; 8] = b"\x89PNG\r\n\x1a\n";
const KEYWORDS: [&[u8]; 2] = [b"OIM_Data", b"OIM_JSON_DATA"];
/// Matches the backend limit: a bigger payload is a zip bomb, not a design.
const MAX_METADATA_BYTES: u64 = 10 * 1024 * 1024;
const BASE64: GeneralPurpose = GeneralPurpose::new(
    &base64::alphabet::STANDARD,
    GeneralPurposeConfig::new().with_decode_padding_mode(DecodePaddingMode::Indifferent),
);

/// What a `.oim` carries: its metadata as written, and the seal of its image.
#[derive(Debug, Clone, PartialEq)]
pub struct Extraction {
    pub metadata: Value,
    /// SHA-256 (lowercase hex) of the concatenated IDAT payloads; `None` without image data.
    pub image_hash: Option<String>,
}

/// Reads the metadata and image hash of a `.oim`. When a file carries two OIM
/// chunks the last one wins, as in the core.
pub fn extract(png: &[u8]) -> Result<Extraction, OimError> {
    let mut rest = png
        .strip_prefix(PNG_SIGNATURE.as_slice())
        .ok_or(OimError::NotOim)?;
    let mut payload: Option<Result<String, OimError>> = None;
    let mut idat = Sha256::new();
    let mut has_idat = false;

    while !rest.is_empty() {
        let (kind, data, next) = next_chunk(rest)?;
        rest = next;
        match kind {
            b"IDAT" => {
                idat.update(data);
                has_idat = true;
            }
            b"tEXt" | b"zTXt" | b"iTXt" => {
                if let Some(text) = oim_text(kind, data) {
                    payload = Some(text);
                }
            }
            b"IEND" => break,
            _ => {}
        }
    }

    let text = payload.ok_or(OimError::NotOim)??;
    Ok(Extraction {
        metadata: parse_metadata(&text)?,
        image_hash: has_idat.then(|| hex(&idat.finalize())),
    })
}

/// (type, data, remaining bytes after the CRC).
type Chunk<'a> = (&'a [u8], &'a [u8], &'a [u8]);

/// Splits one chunk off `bytes`.
fn next_chunk(bytes: &[u8]) -> Result<Chunk<'_>, OimError> {
    let (len, rest) = bytes.split_first_chunk::<4>().ok_or(OimError::Truncated)?;
    let len = u32::from_be_bytes(*len) as usize;
    let (kind, rest) = rest.split_at_checked(4).ok_or(OimError::Truncated)?;
    let (data, rest) = rest.split_at_checked(len).ok_or(OimError::Truncated)?;
    let (_crc, rest) = rest.split_at_checked(4).ok_or(OimError::Truncated)?;
    Ok((kind, data, rest))
}

/// The decoded text of a text chunk, or `None` when the chunk is not an OIM one.
fn oim_text(kind: &[u8], data: &[u8]) -> Option<Result<String, OimError>> {
    let nul = data.iter().position(|&b| b == 0)?;
    let (keyword, rest) = data.split_at(nul);
    if !KEYWORDS.contains(&keyword) {
        return None;
    }
    let body = rest.get(1..).unwrap_or_default();
    Some(match kind {
        b"zTXt" => match body.split_first() {
            Some((0, compressed)) => inflate(compressed),
            _ => Err(corrupt("unknown zTXt compression method")),
        },
        b"iTXt" => itxt_text(body),
        // tEXt: raw deflate written by the backend, else base64 or plain JSON text.
        _ => match inflate(body) {
            Ok(text) if text.trim_start().starts_with('{') => Ok(text),
            _ => Ok(body.iter().map(|&b| b as char).collect()),
        },
    })
}

/// iTXt body: flag, method, language\0, translated keyword\0, text.
fn itxt_text(body: &[u8]) -> Result<String, OimError> {
    let [flag, method, rest @ ..] = body else {
        return Err(corrupt("short iTXt chunk"));
    };
    let mut parts = rest.splitn(3, |&b| b == 0);
    let (Some(_lang), Some(_translated), Some(text)) = (parts.next(), parts.next(), parts.next())
    else {
        return Err(corrupt("malformed iTXt chunk"));
    };
    match (flag, method) {
        (1, 0) => inflate(text),
        (1, _) => Err(corrupt("unknown iTXt compression method")),
        _ => String::from_utf8(text.to_vec()).map_err(|_| corrupt("iTXt text is not UTF-8")),
    }
}

/// zlib first, then raw deflate: the backend compresses with wbits=-15.
fn inflate(bytes: &[u8]) -> Result<String, OimError> {
    read_limited(ZlibDecoder::new(bytes)).or_else(|_| read_limited(DeflateDecoder::new(bytes)))
}

fn read_limited(decoder: impl Read) -> Result<String, OimError> {
    let mut out = Vec::new();
    decoder
        .take(MAX_METADATA_BYTES + 1)
        .read_to_end(&mut out)
        .map_err(|e| corrupt(&e.to_string()))?;
    if out.len() as u64 > MAX_METADATA_BYTES {
        return Err(corrupt("metadata exceeds 10 MB"));
    }
    String::from_utf8(out).map_err(|_| corrupt("metadata is not UTF-8"))
}

/// JSON as is, or base64 of JSON, of zlib or of raw deflate.
fn parse_metadata(text: &str) -> Result<Value, OimError> {
    let json = if text.trim_start().starts_with('{') {
        text.to_owned()
    } else {
        let clean: String = text.chars().filter(|c| !c.is_whitespace()).collect();
        let bytes = BASE64
            .decode(clean)
            .map_err(|_| corrupt("metadata is neither JSON nor base64"))?;
        match std::str::from_utf8(&bytes) {
            Ok(plain) if plain.trim_start().starts_with('{') => plain.to_owned(),
            _ => inflate(&bytes)?,
        }
    };
    let value: Value = serde_json::from_str(&json).map_err(|e| corrupt(&e.to_string()))?;
    if !value.is_object() {
        return Err(corrupt("metadata is not a JSON object"));
    }
    Ok(value)
}

fn corrupt(why: &str) -> OimError {
    OimError::Corrupt(why.to_owned())
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}
