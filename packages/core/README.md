# @oim-media/core

The shared core of the [OIM format](../../README.md): the contract schema, the
reader for the `.oim` container, the canonical form that signatures cover, and
the rendering rules that every player must apply the same way.

It is what the web players and the signing backend build on. You need it if you
read or write `.oim` metadata from TypeScript or JavaScript. You do not need it to
embed a file in a page; for that use [`@oim-media/player-oim`](../player-oim/README.md).

```bash
pnpm add @oim-media/core
```

It needs `crypto.subtle`, `Blob`, `DecompressionStream` and `TextDecoder`, which current
browsers and recent Node.js provide. It is ESM only and declares `sideEffects: false`, so
bundlers can drop what you do not import.

## What it exports

The root entry (`@oim-media/core`) re-exports everything below. Two subpaths
exist for code that must stay light: `@oim-media/core/api` (backend routes and
URLs only) and `@oim-media/core/generative` and `@oim-media/core/generative/catalog`.

**Contract and validation**

- `OimMetadataSchema`, `OvmMetadataSchema`, `OIMOrOVMMetadata`: Zod schemas of the
  metadata. Types `OIMMetadata`, `OVMMetadata`, `Slot`, `TextMark`, `Reveal`, ...
- `CONTRACT_VERSION`: the contract version this build implements (`"1.27.9"`).
- `BASE_CONTRACT_VERSION`, `PLAYER_CAPABILITIES`, `VERSION_BY_CAPABILITY`, `minVersionFor`.
- `MAX_SLOTS`, `MAX_MARKS`, `MARK_NAME`, `PALETTE_NAME_PATTERN`, `CSS_GRADIENT_PATTERN`.

**Binary: reading and writing the container**

- `extractOIM(blob)`: returns `{ image, metadata, imageHash }`, where `image` is the PNG without the metadata chunk.
- `extractOIMMetadataFromStream(stream)`: metadata from a stream, reading only as far as needed.
- `fetchMetadataTail(url, tailBytes?)`: metadata from the end of a remote file with a range request.
- `compressAndEncodeJSON(obj)` and `decodeAndDecompressJSON(base64)`, `decompressBytes(bytes, format)`.
- `imageDataHash(arrayBuffer)`: SHA-256 (hex) of the PNG `IDAT` payloads. This is the image seal.

**Canonical form (the bytes a signature covers)**

- `serializeCanonical(metadata)`: returns the `Uint8Array` the signer hashes.
- `normalizeCanonicalNumbers(value)` and `sortKeysByCodePoint(value)`: the two rules used by `serializeCanonical`.
- `hasNumberOutOfRange(value)` and `MAX_CANONICAL_NUMBER`: whether metadata holds a number beyond ±(2^53 − 1), which has no canonical form; a signer refuses it and a verifier reports the signature as invalid.

Signature *verification* is not in this package. The player verifies with its
embedded keys (see [`@oim-media/spec`](../spec/README.md#embedded-player-keys)).

**Compatibility**

- `whatTheReaderCannotDo(metadata, { version, capabilities })`: returns a
  `MissingSupport` report (required version, missing capabilities, `cannotRender`).
- `describeMissing(report)`: a human-readable sentence for that report.

**Re-edit permission**

- `permissionOf(metadata)`, `canReedit(permission, isAuthor)`, `mustRejectWithoutAsking(permission, isAuthor)`,
  `registryQuery(permission)`, `permissionFields(permission)`, `signatureStamp(permission)`.
- `normalizeLegacyKeys(metadata)`: maps the Spanish keys of files signed before 1.23.0
  (`reedicion` and its values) to the English ones. Call it **after** verifying the
  signature, never before: the signature covers the keys as they were written.

**Rendering rules shared by the players**

- Layers and groups: `isGroup`, `slotParent`, `childrenByGroup`, `slotClipping`.
- Text: `resolveLineHeight`, `inkMargin`, `parseMarks`, `validateMarks`, `markStyle`,
  `dropCapStyle`, `splitDropCap`, the entrance-effect functions (`entranceFrameAt`,
  `entranceKeyframes`, ...).
- Fills, colours and palettes: `resolvePalette`, `resolveCssColor`, `isSafeCssColor`,
  `DYNAMIC_COLOR_ROLES`, the fill and pattern engine in `fill.ts` and `patterns.ts`.
- Media: `mediaFilterCss`, `FILTER_PRESET_CSS`, `frame-silhouette`, `embeddedFonts`,
  `artisticTextCurve`, `artisticTextExtrusion`, `geoShapes`, `cropping` helpers.
- Motion: `parallaxCss`, `oversizeScale`, `REVEAL_DEFAULT`, `flip`.

**Effects and generative content**

- `normalizeSlotEffects(style)`, `layerTextureMask(layer)`, `TEXTURE_CATALOG`.
- `renderGenerativeSVG(config, { width, height, bleed? })` and `GENERATOR_CATALOG`,
  `getGeneratorSpec(id)` (from `@oim-media/core/generative`).

**Backend**

- `OIM_BACKEND_URL_DEFAULT`, `OIM_ENDPOINTS`, `OIM_PACKAGE_FIELDS`,
  `resolveBackendUrl(override?)`, `oimEndpoint(name, backendUrl?)`.

## The 2.0 draft (`@oim-media/core/v2`)

An experimental entry for the next version of the document. The published format is still the one
above; no player reads 2.0 yet and its shape can change.

2.0 keeps what a file can express and reorganises how it is written: five layer types (`text`,
`shape`, `image`, `lottie`, `group`) instead of fifteen, and one block per idea (`fills`, `strokes`,
`effects`, `text`, `geometry`, `mask`, `animations`, `interactions`) that is the same in every layer
that admits it. An absent field is its default.

- `documentSchema`, `layerSchema` and the schema of each block: the 2.0 document, in Zod.
- `LAYER_BLOCKS` and `admits(type, block)`: which block each layer type admits.
- `upgrade(v1)`: reads a 1.x document as 2.0. It returns `{ document, retired, unhandled }`.
  `retired` lists the 1.x keys dropped on purpose; `unhandled` lists the ones nobody converted, and
  is empty for every conformance vector. It is pure and does not sign: verify a 1.x file with its own
  bytes first.
- `isV2(input)`: whether a document is already 2.0.

```ts
import { upgrade } from "@oim-media/core/v2";

const { document, unhandled } = upgrade(metadata);
if (unhandled.length > 0) console.warn("not carried to 2.0:", unhandled);
```

## Examples

Read a file and check what it needs:

```ts
import { extractOIM, whatTheReaderCannotDo, describeMissing, CONTRACT_VERSION } from "@oim-media/core";

const file = await fetch("/art/poster.oim.png").then((r) => r.blob());
const { metadata, imageHash } = await extractOIM(file);

const report = whatTheReaderCannotDo(metadata, {
  version: CONTRACT_VERSION,
  capabilities: ["vector_parallax", "text_marks"],
});
if (report.cannotRender) console.warn(describeMissing(report));
```

Check a re-edit permission after the signature has been verified:

```ts
import { normalizeLegacyKeys, canReedit, permissionOf } from "@oim-media/core";

const meta = normalizeLegacyKeys(verifiedMetadata); // verifiedMetadata: already checked by your verifier
const verdict = canReedit(permissionOf(meta), /* isAuthor */ null);
verdict.allowed; // false for "author_only" and "sealed" when the author is unknown
```

Only the `public` permission is granted without knowing who the user is.

Build the backend URL for a route:

```ts
import { oimEndpoint } from "@oim-media/core/api";

const url = oimEndpoint("compile"); // https://api.oim.media/v1/oim/compile
```

## Versioning

`CONTRACT_VERSION` is the version of the **format**, not of this package. The
package version and the contract version move together on each release tag, but a
package can change without the format changing. See the
[root README](../../README.md#versioning).

## Licence

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
