# oim-spec — the format contract

This is **not** a library. It is the definition of the `.oim` format, in data,
so that an implementation in any language can be correct without reading the
TypeScript.

```
BINARY_SPEC.md    Binary specification of the PNG container, compression and signature.
CANONICAL_SPEC.md Canonical specification of the metadata (slots, styles, types and options).
schema/           JSON Schema of the metadata. Generated, never edited by hand.
vectors/          Example .oim files with their expected result.
```

## Why it exists

The two repositories had copied the same code instead of sharing it, and the
copies drifted: `grupos.ts` accumulated 546 lines that differed between the
player and the editor, `layerComposition.ts` 775. A player in Swift or in Rust
would repeat that mistake once per language.

A contract in TypeScript only serves TypeScript. This directory is the part
that survives the language.

## Who is the authority today

Today the source of truth is still `packages/core/src/schema.ts`: the JSON in
`schema/` is **generated** from that Zod schema, and a test fails if someone
edits the Zod without regenerating. This is deliberate — a generated contract
cannot drift from its implementation, which is exactly the failure this closes.

The day a second implementation exists, the direction reverses: the JSON
becomes the source and the TypeScript one more of the implementations that
satisfy it. Not before: maintaining by hand a specification that nobody else
reads is how contracts that lie accumulate.

## Regenerate

```
pnpm --filter @oim-media/core test -- -u
```

## Check whether the contract and the files have drifted

```
node tools/contract-summary.mjs          # readable report
node tools/contract-summary.mjs --json   # the same data, for another tool
node tools/contract-summary.mjs --write  # writes contract-summary.json

node tools/canonical-check.mjs           # the signature: rebuilds the canonical form
                                         # and verifies the real vectors
```

A test watches that the JSON Schema follows the Zod, but **nothing compared the
contract against real signed files**. That gap had already let four divergences
through, found by hand on 18 September 2026; the worst, `reedicion` — who may
re-edit the work — goes in every file and is not declared anywhere.

The script reports, it does not fix or fail. Turning drift into a red test is
the right end state, but first the drift must be resolved: a test that starts
red teaches everyone to ignore it.

## `content` and the main `*` (since 1.2.0)

On media layers (image, Lottie, vector), `content` can store the main media
under the key `"*"` and only the exceptions under their language code:

    "content": { "*": "oim-media:abc", "pt": "oim-media:def" }

Reading rule: if `content` has `"*"`, the requested language uses **its own key
if it exists, even if empty**; if it does not exist, it uses `"*"`. There are no
further fallbacks. Without `"*"` (every file prior to 1.2.0, and every text),
the usual rule applies: the requested language, then `en`, `es`, `default` and
the first key,
## `reedicion` and `name` at the root (since 1.4.0)

Since 1.23.0 the permission is written as `reedit` (see below); `reedicion` is
read as a legacy alias.

Both were in **every** published file and in **no** version of the contract. A
reader built by reading only the contract could not know they existed.

`reedicion` was the worse of the two because **it decides a permission**:

    "reedicion": "publico" | "solo_autor" | "sellado"

An unknown value falls back to `solo_autor`, **never to `publico`**: the default
of a permission system is chosen by what happens when something goes wrong. A
reader that ignored it would treat as re-editable a work that is not.

It travels together with `immutable_lock`, and this is not redundancy:
`reedicion` is the declaration — it travels inside the file, so anyone who opens
it knows what its author intended — and `immutable_lock` is what the backend
stores and enforces. A declaration without enforcement is a suggestion; an
enforcement without a declaration is a closed door with no sign. `reeditPermission.ts`
is the canonical source of that rule, and it writes both fields at once so that
they cannot be separated.

`name` is the title of the work. Do not confuse it with `slot.name` or
`fonts[].name`.

## Names in English (since 1.23.0)

The format keys are in English. `reedit` replaces `reedicion`, with the values
`public`, `author_only` and `sealed` in place of `publico`, `solo_autor` and
`sellado`. Writers emit only the English keys.

`reedicion` is read forever as a legacy alias. Every file signed before 1.23.0
carries it, and the signature covers the keys as they were written, so a reader
verifies the signature first and maps the legacy key afterwards
(`normalizeLegacyKeys`). An unknown value still falls back to `author_only`.

The exported names of the packages are English too. The Spanish ones remain as
deprecated aliases until 2.0.0. The player's `data-oim-*` attributes are doubled
in the same contract version: the English names are added and the Spanish ones
keep working.

## What is retired is marked, not deleted (since 1.4.0)

`terms_accepted` and `redirect_membership_verified` carry `deprecated: true` in
the JSON Schema, which is the **machine-readable** way of saying it: a new reader
does not have to interpret a comment to know it must not write them.

Version 1.1.0 left them behind when it retired `allow_external_urls`: their only
readers — the backend's signing paths — sit behind `if allow_external_urls`, a
key the contract no longer declares, so **the check cannot fire for a conforming
file**.

Marked and not deleted, on purpose. The backend still honours them if a file
carries the retired key; removing them from the contract would make it lie in
the other direction, which is the same failure with the sign flipped.

**`allowed_domains` is not on that list, although it has been said otherwise.**
It is still alive and the player enforces it: `worker.ts` turns it into
`isDomainAllowed` and `securityVerdict` answers `domain_blocked`. A test exists
that prevents it from being declared dead again.

Nothing is removed and `min_player` does not go up: an old file is still valid,
and a reader that ignores the four keys behaves exactly as before.

## Embedded fonts (since 1.3.0)

The root may carry `fonts`: one entry per font variant the work uses, trimmed to
the characters it can display.

    { "family": "Lora", "name": "oim-3f9a1c2b-Lora", "weight": 700,
      "style": "italic", "format": "woff2", "data": "<base64>" }

A reader that understands it registers each entry under the name in `name` and
paints the layers of family `family` with that name first. A reader that does
not understand it ignores it: the layers still say `family` and are painted as
before. That is why `fonts` does not raise `min_player`.

**Online fonts are inherited behaviour** since 17 September 2026: the editor no
longer offers them and every new file carries its fonts inside. The reference
player keeps its Google loader only for files already published, and a new
reader does not have to implement it: without `fonts`, it is painted with the
system's fallback typeface. An `.oim` does not request anything from third
parties when it is opened, which is what 1.1.0 decided when it retired
`allow_external_urls`.

## Style stops being free text (since 1.8.0)

Version 1.6 declared about forty style keys that the editor already wrote, but
almost all as free strings: declaring a key without saying what it accepts
documents that it exists, not how it is read. Version 1.8.0 gives them a shape:

- **A single colour type**, `cssColor`, for the sixteen colour keys. It accepts
  hex, `rgb()`/`hsl()`, `transparent`, `none`, `currentColor`, `inherit` and
  `var(--name)` with a fallback, because dynamic colours go into real files. It
  is the portable twin of `isSafeCssColor`, the player's sanitiser: a test
  requires that **everything the contract accepts, the player accepts**, never the
  other way around.
- **Closed vocabularies** where the editor already closes them: colour roles, the
  14 patterns, the 8 pattern directions, the text gradient and text animation,
  and `geoShape` gains `scribble`, which was written but not declared.
- **The three `any` have a shape**: `cuts` (mask cutouts), `fillGenerative`
  (generator, seed, parameters and colours) and `fillGradient`.

`fillGradient` was the serious hole. It ends up in `background-image`, which
accepts a list of images, so `linear-gradient(red, blue), url(https://third-party/beacon)`
made opening the file request a resource from a third party. Now the contract
accepts **a single** gradient with colour functions inside, and the player discards
anything else even if the file does not validate against the contract.

Measured on 24 September 2026: the 42 `.oim` files on disk, including the 20
vectors, validate against 1.8.0.

## No raw CSS (since 1.9.0)

`animation.custom_loop_css`, `custom_keyframes` and `custom_hover_css` carry
`deprecated: true` and **no player may apply them**. `loop: "custom"` and
`hover: "custom"` paint nothing.

They were CSS from the file pasted as-is into a style sheet. The filter only
rewrote `url(...)`, and there were three other ways of requesting a resource that
passed through intact: `@import "https://…"`, `image-set("https://…" 1x)` and a
`url` written with a CSS escape (`\75rl(…)`). `custom_hover_css` did not even go
through the filter and was pasted inside `{ … }`, so a `}` could leave the rule
and rewrite the entire player, including its own warnings.

The editor never wrote them and no file uses them: they are removed rather than
chasing the grammar of CSS with a blocklist. `cssAnimation` stays, restricted to
the only form the editor writes,
`background-animation-<direction> <n>s linear infinite`.

## Named palettes (since 1.20.0)

The root of the `.oim` may carry `palettes` and `defaultPalette`:

- **`palettes`**: a map from name to palette. Each palette assigns colours to the
  twelve roles of `DYNAMIC_COLOR_ROLES` (the eight from before plus `text-primary`,
  `text-secondary`, `text-muted` and `text-on-accent`). At most six palettes. A
  name matches `^[a-z][a-z0-9-]{0,23}$`. Colours are not validated in the
  contract: the reader discards those that fail `isSafeCssColor` and keeps the
  rest, the same as with a layer colour.
- **`defaultPalette`**: the name of the default palette. If it does not name a
  palette in `palettes`, the reader ignores it.

**Resolution order** (`resolvePalette` in `@oim-media/core`):

1. The palette requested by the host (the player's `palette` attribute).
2. If the document carries `dark` and `light`, the one that `prefers-color-scheme` asks for.
3. `defaultPalette`.
4. None: each layer uses its fixed colour.

The result is written to the viewer as `--oim-palette-<role>`, and
`resolveCssColor(role, fixed)` emits `var(--oim-color-<role>, var(--oim-palette-<role>, fixed))`.
The host's `--oim-color-*` still win over the palette, and `allow-dynamic-colors="false"`
overrides all of them.

A 1.20.0 file read by an earlier player is shown with each layer's fixed
colours. Nothing breaks.

## Conformance vectors

`vectors/` holds 20 signed `.oim` files and their expected reads, plus
`reedit-english`, which is unsigned (`"signed": false`) because the signing
service could not produce it for 1.23.0. The signed ones are generated by Xue
Studios' signing service through the production pipeline and committed to this
repository; the generator itself is not part of it. See
[`vectors/README.md`](vectors/README.md).

## Precedent

Lottie separated its specification from every implementation into `lottie/lottie-spec`
— `/schema` split by object, `/tests` with vectors — and let each player be
named as it wished in its ecosystem (`lottie-web`, `lottie-ios`,
`com.airbnb.android:lottie`). There is no `@lottie/*` scope: the identity
lives in the specification, not in the package name.

## The canonical form of the signature

Without this section, a second implementation can read the entire format and
still **be unable to verify a single signature**. It is the only part of the
contract that completely blocks a new reader: everything else can be ignored and
degraded, the signature cannot.

The signature is **ECDSA P-256 with SHA-256**, in raw IEEE P1363 format — `r || s`,
32 bytes each, 64 in total — encoded in base64 inside `signature`. It is not
DER: whoever uses a library that returns DER has to convert it.

### The bytes that are signed

Neither the chunk nor the JSON as written in the file is signed. What is signed
is the result of these seven rules, in this order:

1. **Start from the metadata object** already decoded from the chunk.
2. **Remove from the root** `signature`, `key_version`, `timestamp` and
   `creator_user_id`. Only from the root: if those names appear nested, they stay.
3. **Normalise the numbers**: round to **6 decimals** and, if the result has no
   fractional part, emit it as an integer (`2.0000001` → `2`).
4. **Sort the keys** of all objects, recursively, by Unicode code point. Also
   inside the objects that appear in arrays.
5. **Serialise compactly**: no spaces, separators `,` and `:`.
6. **Do not escape non-ASCII**: `Zürich` is emitted as-is, not as `Z\u00fcrich`.
7. **Encode in UTF-8**. Those bytes are the ones that are signed and the ones
   that are verified.

`signed_at` goes **inside** the signature and `timestamp` **outside**. This is
not an oversight: `timestamp` can be rewritten without breaking anything, and the
key-expiry check needs a date that cannot be forged.

`creator_user_id` is excluded because it is personal data, and a signed file is
exactly what its author can no longer delete.

### The image seal

`image_hash` is the **hexadecimal SHA-256 of the concatenation of the payloads of
the `IDAT` chunks** of the PNG — only the data, without length, without type and
without CRC — and `image_hash_alg` is `sha256-idat`.

Because `image_hash` is one more metadata field, **the signature covers it**: with
a valid signature, the seal can no longer be changed. That is why the order
matters and is not negotiable: normalise the PNG, compute the seal, sign, and
insert the chunk **at byte level without re-encoding the image**. A simple "save
again" after signing changes the `IDAT` and the seal stops matching forever.

Files prior to 11 September 2026 carry no seal and are accepted without one.

### Where this used to break

Until 20 September 2026 the two reference implementations — `serialize_canonical`
in Python and `serializeCanonical` in TypeScript — agreed **by construction, not
by agreement**, and disagreed on three inputs. With `packages/core/src/canonical.ts`
as the single source on the TypeScript side, measured again on 24 September:

| Input | Python | TypeScript | Status |
|---|---|---|---|
| `creator_user_id` at the root | removes it | removes it | **closed** |
| decimal with more than 6 digits | rounds | rounds | **closed** |
| keys outside the BMP | code point | code point | **closed** |
| decimal that becomes an integer when rounded | `2` | `2` | **closed on 24 Sept** |

The fourth was found by the review of 24 September and was an **ordering** issue
inside rule 3: `clean_floats` asked "is it an integer?" *before* rounding, and in a
single pass left `2.0000001` as `2.0` and `1e-7` as `0.0`, where TypeScript emits
`2` and `0`. The signer did not suffer it because it applies `clean_floats` twice;
whoever reimplemented the Python with a single pass did. It now rounds first, and
a test of the reference signer fixes the bytes.

**What governs is what is signed**: round to 6 decimals first and, if the result
has no fractional part, emit it as an integer. `-0` is emitted as `0`. No existing
signature changes: with two passes the result was already that.

A note on the citation: the comment in `canonical.ts` mentions RFC 8785 (JCS), but
JCS sorts keys by **UTF-16 units**, not by code point. OIM sorts by code point;
the two only differ with keys outside the BMP. The contract is this README, not the RFC.

### What the script checks, and what it does not

    node tools/canonical-check.mjs

It rebuilds the seven rules and **verifies the real signature of each vector**
with the v1 public key that the player carries inside. It does not compare against
a digest pointed to by hand: if the rules were wrong, the signature would not validate.

With the 20 vectors of the matrix — generated by the real pipeline and signed
with the production key — each rule was removed one at a time:

| Rule removed | Signatures that fail |
|---|---|
| 2 · root exclusions | 20 of 20 |
| 6 · unescaped UTF-8 | 8 of 20 |
| seal · SHA-256 of the `IDAT` | 19 of 19 sealed |
| 3 · numbers | **0** |
| 4 · key order | **0** |

Rule 6 and the seal, which before were only held up by known-answer cases,
**are now demonstrated by a signature**. Rules 3 and 4 are not, and **no vector
signed by our pipeline could ever do so**: the signer writes the file from its own
canonical bytes, so what remains in the chunk is already rounded and sorted. Those
two rules only show up when someone **serialises the metadata again** — an editor
that rewrites the chunk, another JSON library — and that is exactly where they
are needed.

That is why they remain covered by known-answer cases inside the script:
they **catch a regression in the script, they do not prove that the signer agrees**.
Proving it for real would require a hand-written vector, with unordered keys and a
long decimal, signed over its canonical form: a file the real pipeline never produces.

## Embedded player keys

`keys.json` lists the public keys every player embeds (`kid`, `jwk`, and the
`not_after` / `verify_until` dates where they apply). It is generated from the
player's key set by `tools/keys-json.mjs`, and a test fails if the two disagree.
Only public components are ever written.
