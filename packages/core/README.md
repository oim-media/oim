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

The package is published to GitHub Packages. See the [install instructions](../../README.md#install).

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
- `CONTRACT_VERSION`: the contract version this build implements (`"1.25.0"`).
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
