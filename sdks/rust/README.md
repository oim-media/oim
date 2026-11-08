# oim (Rust)

Read, verify and interpret `.oim` files from Rust. No network, no renderer:
the public keys are embedded, and packaging or signing is the CLI's job.

```toml
[dependencies]
oim-media = { git = "https://github.com/oim-media/oim" }
```

```rust
use std::time::SystemTime;

let png = std::fs::read("work.oim.png")?;
let file = oim::extract(&png)?;
let status = oim::verify(&file, SystemTime::now());
if oim::is_refused(status) {
    return Err("altered file".into());
}
for slot in file.metadata["slots"].as_array().into_iter().flatten() {
    println!("{}", oim::resolve_content(&slot["content"], oim::DEFAULT_LANGUAGE));
}
```

| Function | What it does |
|---|---|
| `extract(&[u8])` | Metadata (`serde_json::Value`) and the SHA-256 of the image data. Errors: `NotOim`, `Corrupt`, `Truncated`; it never panics. |
| `verify(&Extraction, now)` | `SecurityStatus`: the ECDSA P-256 signature over the canonical form, and the image seal. |
| `reedit_permission(&Value)` | `Public`, `AuthorOnly` or `Sealed`; an unknown value is `AuthorOnly`. |
| `resolve_content(&Value, lang)` | A layer's text: requested language, `en`, `es`, `default`, first value. |
| `canonical_json(&Value)` | The signed bytes (BINARY_SPEC §5.1). |

The crate version is the contract version. Tests run every conformance vector
in `packages/spec/vectors`: `cargo test`.
