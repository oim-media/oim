# OIM (Object Interactive Media) Container Binary Specification

**Version:** 1.0  
**Date:** 2026-09-22  
**Status:** Normative / In force  
**Authors:** OIM Architecture Team

---

## 1. Summary and Objectives

A **`.oim`** (or **`.oim.png`**) file is an enriched, interactive and verifiable multimedia document carried inside an image file that conforms to the standard **ISO/IEC 15948:2004 (PNG)** specification.

The objectives of this binary design are:
1. **Universal compatibility (visual fallback):** Any image viewer, browser or client without OIM support can decode and render the file as a standard, high-fidelity static PNG image.
2. **Zero network dependency (self-contained):** The document encapsulates all of its vector geometry, multilingual texts, animations, typefaces and interactive metadata within the image itself.
3. **Cryptographic integrity and ECDSA signature (zero-trust):** The file embeds an asymmetric digital signature that indelibly binds the interactive metadata to the rendered pixels (`IDAT` chunks), preventing substitution or manipulation of the canvas or its layers.

---

## 2. Anatomy of the PNG Binary Container

Every OIM file begins strictly with the canonical 8-byte PNG signature:

```binary
89 50 4E 47 0D 0A 1A 0A  (\x89PNG\r\n\x1a\n)
```

### 2.1. PNG Chunk Structure

Each chunk in the PNG file follows the standard 4-field layout:

| Field | Length | Description |
|---|---|---|
| **Length** | 4 bytes (Big-Endian) | Length of the `Data` field (excludes `Type` and `CRC`). |
| **Type** | 4 bytes (ASCII) | Four-character identifier (e.g. `IHDR`, `tEXt`, `IDAT`, `IEND`). |
| **Data** | *Length* bytes | Chunk payload. |
| **CRC-32** | 4 bytes (Big-Endian) | CRC-32 checksum computed over `Type` + `Data`. |

### 2.2. Placement and Injection of OIM Metadata

OIM metadata is preferably stored in an ancillary text chunk:

- **Chunk type:** `zTXt` (written since 29 Oct 2026). Readers also accept `tEXt` (earlier files) and `iTXt`.
- **Chunk keyword:** `OIM_Data` (historically `OIM_JSON_DATA` was also recognised).
- **Location in the file:**
  - **AFTER** `IHDR` (and any palette/colour header chunks, if present).
  - **BEFORE** or **AFTER** the image `IDAT` chunks.
  - **ALWAYS BEFORE** the closing `IEND` chunk.

> **Critical note on injection:** The metadata chunk must be inserted **surgically at byte level** into the PNG binary stream, without re-rendering or re-encoding the `IDAT` blocks, preserving the exact cryptographic hash of the canvas.

---

## 3. Encoding and Compression of the Payload

The payload of the `zTXt` chunk has the following structure:

```
[ Keyword: "OIM_Data" ] + [ Null Separator: 0x00 ] + [ Method: 0x00 ] + [ zlib(JSON), binary ]
```

No Base64: measured on 29 Oct 2026, the file is 12–23 % smaller than with the
earlier `tEXt` form (`"OIM_Data\0"` + Base64 of raw Deflate), which readers
still accept.

### 3.1. Packaging Flow (Serializer)

1. The OIM metadata object (conforming to `OimMetadataSchema`) is serialised to a JSON string encoded in **UTF-8**.
2. The UTF-8 string is compressed with **zlib** (RFC 1950: 2-byte header, DEFLATE, Adler-32), level 9.
3. The `zTXt` chunk is assembled:
   - `Length`: `8` (keyword) + `1` (null byte) + `1` (method) + `len(zlib)`
   - `Type`: `7A 54 58 74` (`zTXt`)
   - `Data`: `"OIM_Data\0\0"` + `<zlib_bytes>`
   - `CRC-32`: computed over `Type` and `Data`.

### 3.2. Extraction and Decompression Flow (Reader)

A `zTXt` is read by skipping the NUL and the method byte and decompressing with
zlib. For the earlier `tEXt` form, a conforming decoder must process the payload
with the following fault tolerance:
1. Extract the value of the chunk after the `0x00` delimiter.
2. Decode the Base64 string into binary bytes.
3. If the decoded plain text already starts with `{` (uncompressed JSON from debugging/draft), process it directly with `JSON.parse`.
4. If it contains compressed binary data:
   - Try to decompress with **Zlib Deflate** (`new DecompressionStream('deflate')` or `zlib.inflateSync`).
   - If that fails, try to decompress with **Raw Deflate** (`new DecompressionStream('deflate-raw')` or `zlib.inflateRawSync`).
5. Decode the resulting bytes with `TextDecoder("utf-8")` and parse the JSON.

---

## 4. The Image Integrity Seal (`image_hash`)

To guarantee that a set of valid, signed interactive metadata cannot be cut out and pasted onto an arbitrary image (canvas-transplant attack), the format implements an image seal over the IDAT stream:

### 4.1. Calculation Algorithm

```
image_hash = SHA256( IDAT_payload_1 || IDAT_payload_2 || ... || IDAT_payload_n )
```

- All chunks with the exact type `IDAT` are traversed, in the strict order in which they appear in the PNG container.
- Only the payload of each chunk is extracted (`Data`, discarding the 4 length bytes, the 4 `IDAT` type bytes and the 4 CRC bytes).
- All the bytes of the compressed raw image data are concatenated.
- The **SHA-256** digest is computed and expressed in **lowercase hexadecimal** (64 characters).

### 4.2. Metadata Fields
- `image_hash`: Resulting SHA-256 hexadecimal string.
- `image_hash_alg`: Literal `"sha256-idat"`.

---

## 5. ECDSA P-256 Cryptographic Signature Specification

A signed `.oim` file guarantees the authorship, integrity and non-repudiation of the design.

- **Cryptosystem:** ECDSA over the **NIST P-256** elliptic curve (secp256r1 / prime256v1).
- **Hash function:** SHA-256.
- **Signature format:** raw IEEE P1363 (`r || s`, 32 bytes for $r$ + 32 bytes for $s$ = exactly **64 binary bytes**).
- **JSON serialisation:** Base64 of the 64 binary bytes in the `signature` property. *(No ASN.1/DER encoding is used.)*

### 5.1. Canonical Serialisation Rules (OIM profile)

So that any implementation in any language (TypeScript, Python, Rust, Go, Swift) verifies the signature identically, without a single byte of discrepancy, the payload to be signed or verified is built by strictly following these **7 rules**.

This is OIM's own profile, **not RFC 8785 (JCS)**: rule 3 rounds numbers and rule 4 orders keys by code point, where JCS keeps the number and orders by UTF-16 code unit. A stock JCS library does not produce these bytes. [`canonical-cases.json`](canonical-cases.json) is a known-answer case every implementation in this repository is tested against.


1. **Base object:** Take the decoded OIM metadata dictionary.
2. **Root exclusions:** Exclude from the root only the fields:
   - `signature`
   - `key_version`
   - `timestamp`
   - `creator_user_id` *(excluded for privacy, GDPR / zero-knowledge)*.  
   *(Note: if any of these keys exist in nested objects or styles, they are not removed.)*
3. **Numeric normalisation:**
   - If a decimal number has an exact integer value (e.g. `2.0` or `-0.0`), it is formatted as an integer (`2`, `0`).
   - Floating-point numbers are formatted to a maximum of **6 decimal places** with standard symmetric rounding.
   - **Range:** every number in the metadata, at any depth, must be finite and no larger in magnitude than **2^53 − 1** (`9007199254740991`). Beyond that, JSON parsers disagree on the value they read, so the number has no canonical form: a signer must refuse the metadata and a verifier must report the signature as invalid.
4. **Lexical key ordering:** All object keys (at the root and recursively at every level and inside arrays) are sorted by ascending Unicode code point.
5. **Compact serialisation:** No whitespace between keys, colons or commas: `{"a":1,"b":"dos"}`.
6. **UTF-8 preservation:** Do not escape non-ASCII Unicode characters with `\uXXXX` sequences. They are emitted directly as native UTF-8 (e.g. `"Zürich"` instead of `"Z\u00fcrich"`).
7. **Digest:** The resulting bytes encoded in UTF-8 are passed directly to the SHA-256 + ECDSA P-256 verification/signing function.

---

## 6. Embedded Font Handling (`fonts`)

Since version 1.3.0, the `.oim` format is self-contained and makes no calls to third-party CDNs to render typefaces:

- **Structure of the `fonts` array at the root:**
  ```json
  [
    {
      "family": "Bricolage Grotesque",
      "name": "oim-a9f81-BricolageGrotesque",
      "weight": 700,
      "style": "normal",
      "format": "woff2",
      "data": "<base64_string_of_the_subsetted_woff2_binary>"
    }
  ]
  ```
- **Strict subsetting:** The embedded WOFF2 binaries must be subsetted only to the glyphs present in the project's texts, to minimise the total weight of the PNG (typically 4 KB to 18 KB per variant).
- **Registration in the reader:**
  1. Decode `data` from Base64.
  2. Register the font via `FontFace` (in browsers) or register it in the native system's font engine under the unique identifier `name`.
  3. Bind the slots that refer to `family` to the resolved variant.

---

## 7. Summary Table of Fields and Compatibility

| Feature | Chunks / Key | Format | Mandatory |
|---|---|---|---|
| **Base image** | `IDAT` | Standard compressed PNG | Yes |
| **OIM metadata** | `zTXt` (`OIM_Data`) | zlib(JSON), binary | Yes |
| **IDAT seal** | `image_hash` | SHA-256 hex | Yes (since v1.2) |
| **Digital signature** | `signature` | Base64(ECDSA P1363 64B) | Optional in drafts, required in published files |
| **Key version** | `key_version` | String (e.g. `"v1"`) | Required if signed |
| **Signing date** | `signed_at` | ISO-8601 UTC | Required if signed |
| **Typefaces** | `fonts` | Array with WOFF2 Base64 | Recommended |
| **Named palettes** (1.20.0) | `palettes`, `defaultPalette` | Object name → (role → CSS colour); string | Optional |

### Named palettes (1.20.0)

`palettes` and `defaultPalette` are optional at the root of the document. The
rules for names, roles, the limit of six palettes and the resolution order are
in `README.md` (section "Named palettes"). A reader that does not know them
ignores both keys and paints each layer's fixed colours.
