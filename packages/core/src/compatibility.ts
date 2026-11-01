/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Lets a reader say what it does not understand about a file.
 *
 * The format already degrades gracefully: `.passthrough()` lets unknown keys
 * through, so a `.oim` written by a new editor does not crash an old player.
 * But it degrades SILENTLY, and that silence is the problem.
 *
 * Measured at the time: the schema declared four capabilities
 * -`vector_parallax`, `infinite_parallax`, `path_morph`, `physics_2d`- and the
 * player implemented TWO. `path_morph` and `physics_2d` do not appear even once
 * in its code. A file that declared them would paint wrongly with nothing saying
 * so, and its author would have no way to tell "the player cannot do this" apart
 * from "I did it wrong".
 *
 * ## Why the file is not rejected
 *
 * Because the format degrades to PNG by design: a `.oim` that cannot be read in
 * full is still a valid image, and that is a safety net Rive and Lottie do not
 * have. Rejecting it would trade a partial loss for a total one.
 *
 * What is known gets painted, and what is not gets SAID. The friendly half of
 * compatibility already existed; this is the other half.
 *
 * ## Two different questions
 *
 * `min_player` is a coarse cut: the format changed in a way that an earlier
 * reader cannot reconstruct. `capabilities` is fine-grained: the format is the
 * same, but the document uses an effect this reader does not implement.
 *
 * A file can be fine on version and still ask for something that is missing.
 */

/**
 * The CONTRACT version, not that of any package.
 *
 * `@oim-media/core` can publish ten versions without the format changing, and
 * the format can change without the player being touched. Tying both numbers
 * together would make an internal fix look like a format break.
 */
export const CONTRACT_VERSION = "1.22.2";
// 1.22.2: patch. The format is unchanged; the schema version follows the release tag.
// 1.22.1: patch. The format is unchanged; the schema version follows the release tag.
// 1.22.0: per-layer reveal transition (`reveal`), `animation.trigger` and the `play` action.
// Additive, no capability: a reader without them fades and autoplays, as before.
// 1.21.0: colour roles for patterns, backgrounds and shadows (`backgroundPatternColorRole`,
// `backgroundPatternBgColorRole`, `fillPatternColorRole`, `fillPatternBgColorRole`,
// `shadowColorRole`, ...). A reader without them paints the fixed colours, as before.
// 1.20.0: named palettes (`palettes`, `defaultPalette`) and four text roles
// (`text-primary`, `text-secondary`, `text-muted`, `text-on-accent`). A reader
// without them paints the fixed colour of each layer, as before.
// 1.19.0: twelve more frame shapes, a custom SVG outline for a photo frame (`svgPath`)
// and mirroring the photo inside a frame (`fillImageFlipX`/`Y`). Declared by the
// `frame_shapes` capability: a reader without it paints the frame as a rectangle
// with the whole photo.
// 1.18.0: filters on image layers and image fills (`filterPreset`, `filterBlur`, ...).
// Declared by the `media_filters` capability: a reader without it paints the picture unfiltered.
// 1.17.0: a shape filled with a picture (`fillType: "image"`, `fillImage`,
// `fillImageCrop`). Declared by the `image_fill` capability: a reader without it
// paints `fillColor`.
// 1.16.0: `alt`/`decorative` per layer and `description` per document, for
// screen readers. Additive: a reader that does not know them stays silent.
// 1.15.0: `imageCrop` per image layer (crop.ts). Additive: a reader that does
// not know it shows the whole image with its objectFit.
// 1.14.0: `flipX`/`flipY` per layer (flip.ts). Additive: a reader that does
// not know them shows the layer unflipped, the style schema lets them pass.
// 1.13.0: three entrance text effects, `reveal-mask`, `scale-in` and
// `rise-words` (text-effects.ts). Additive and without a capability, like the
// grain in 1.10.0: a reader that does not know them shows the text still,
// which is an acceptable fallback.
// 1.11.0: text marks. A text layer's `content` may carry `{name}...{/name}`
// tags, with literal braces doubled (`{{`, `}}`), and `style.marks` defines
// each mark's closed style (colour or role, bold, italic, underline,
// highlight). Declared by the `text_marks` capability. The syntax has ONE
// interpretation, text-marks.ts; the backend's twin shares its test cases.
// 1.10.0: a layer's grain gains `grainSize` (1-100) and `grainBlend`
// (overlay | soft-light | multiply); `grain` and `grainIntensity` already
// existed. Additive and without a capability on purpose: a reader that does
// not know the grain paints the layer without it, which is an acceptable
// fallback, and requiring 1.10.0 would lock out readers that show everything
// else perfectly.
// 1.9.0: a .oim no longer carries raw CSS. `custom_loop_css`,
// `custom_keyframes` and `custom_hover_css` are marked retired and the player
// does not apply them: they ended up in a stylesheet where `@import`,
// `image-set()` or a `}` that escaped the rule requested resources from third
// parties or rewrote the player. The editor never wrote them. `cssAnimation` is
// limited to the one form the editor writes.
// 1.8.0: the style keys declared in 1.6 stop being free text. The sixteen
// colors share `cssColor` -the portable twin of `isSafeCssColor`, it accepts
// `var()` and `none`-; roles, pattern, direction and text animation become an
// `enum` with the editor's vocabulary; and the three `z.any()` -`cuts`,
// `fillGenerative`, `fillGradient`- now have a shape. `fillGradient` no longer
// accepts a second image: with it, a file could request resources from a third party.
// 1.7.0: `allowed_domains` is retired (marked, not deleted). The .oim is a
// sandbox: opening it connects to no one, and the player stops checking where
// it is opened. The `domain_blocked` verdict disappears.
// 1.6.0: `path_morph` and `physics_2d` are removed from the contract's
// `capabilities`, since no reader or player ever implemented them; it is
// limited to the implemented ones (`vector_parallax` and `infinite_parallax`).
// 1.5.0: the SEVEN `style` aliases are removed -`size`, `font`, `color`,
// `bold`, `italic`, `underline`, `fontSizeOverrides`-. There was no deprecation
// phase: the published .oim files are test files, so there was no compatibility
// to protect. The compiler now emits only the canonical keys (`canonizar_estilo`),
// and `fillColor` inherits the pattern that `color` had -which turned out to be
// better specified than it. `style` goes from 46 to 39.
// 1.4.0: the root declares `reedicion` -- who may re-edit the work -- and
// `name`. Both were in every published file and in no version of the
// contract, so a reader built from the contract alone could not know they
// exist; `reedicion` decides a permission, which is the worst kind of field to
// leave undeclared. The same release MARKS `terms_accepted` and
// `redirect_membership_verified` as deprecated: they were left behind by
// `allow_external_urls` in 1.1.0 and their only readers cannot fire for a
// conforming file. Nothing is removed and no min_player rises: an old file
// stays valid and a reader that ignores all four behaves as before.
// 1.3.0: the root may carry `fonts`, the font files a work uses, subset and
// base64 woff2. It raises no min_player: a reader that ignores it still paints
// the family by asking Google, as it always did.
// 1.2.0: `content` may carry the principal under "*". A key of its own is
// final for that language, even when empty. The schema does not change
// (content is already a string record); the meaning of "*" does, and that is
// what a reader in another language needs to know.
// 1.1.0: `allow_external_urls` is removed. The player no longer loads external
// URLs -- a .oim gets shared, and a request to a third party on opening it would
// reveal the IP and browser of whoever views it. No file used it (0 of 20
// measured) and the editor never wrote it. The schemas are `.passthrough()`, so
// an old file that still carries it REMAINS valid: the field is ignored.

/**
 * The first version of the format. Whatever requires nothing more requires this.
 *
 * Kept separate from `CONTRACT_VERSION` because they are two different things:
 * that one rises when the format changes, this one never moves.
 */
export const BASE_CONTRACT_VERSION = "1.0.0";

/**
 * What the player implements TODAY, measured and not assumed.
 *
 * `path_morph` and `physics_2d` are in the schema's enum but not in the code:
 * zero occurrences. They are left out on purpose -declaring what is not done is
 * exactly the silence this is meant to break.
 */
export const PLAYER_CAPABILITIES = ["vector_parallax", "infinite_parallax", "text_marks", "image_fill", "media_filters", "frame_shapes"] as const;

export interface Reader {
  /** The contract version this reader implements. */
  version: string;
  capabilities: readonly string[];
}

export interface MissingSupport {
  /** What the file requires, exactly as it came. `null` if it requires nothing. */
  requiredVersion: string | null;
  /** The file asks for a format version later than the reader's. */
  versionTooOld: boolean;
  /** Capabilities the document declares and the reader does not implement. */
  missingCapabilities: string[];
  /** Required capabilities the document demands and the reader does not implement. */
  missingRequiredCapabilities: string[];
  /** Is a required capability missing, or is the version too old to render faithfully? */
  cannotRender: boolean;
  /** Is there anything to report? */
  hayAlgoQueDecir: boolean;
}

/** `1.2.10` -> [1, 2, 10]. Anything that is not that shape gives `null`. */
function parseVersion(version: unknown): [number, number, number] | null {
  if (typeof version !== "string") return null;
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/**
 * Is `a` later than `b`? If either cannot be read, NO.
 *
 * An unreadable version must not become a warning: a file can carry anything
 * there, and shouting about a mistyped field would teach people to ignore the
 * warning exactly when it matters.
 */
function isNewer(a: unknown, b: unknown): boolean {
  const pa = parseVersion(a), pb = parseVersion(b);
  if (!pa || !pb) return false;
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return true;
    if (pa[i] < pb[i]) return false;
  }
  return false;
}

/**
 * What this reader cannot honor in this file.
 *
 * A file without `min_player` requires nothing: that covers every published file
 * so far, and treating them as suspect would turn the warning into background noise.
 */
export function whatTheReaderCannotDo(metadata: any, reader: Reader): MissingSupport {
  const required = metadata && typeof metadata.min_player === "string" ? metadata.min_player : null;

  const declared: unknown[] = Array.isArray(metadata?.capabilities) ? metadata.capabilities : [];
  const missingCapabilities = declared
    .filter((c): c is string => typeof c === "string" && c !== "")
    .filter((c) => !reader.capabilities.includes(c))
    .filter((c, i, todas) => todas.indexOf(c) === i)
    .sort();

  const requeridas: unknown[] = Array.isArray(metadata?.capabilities_required)
    ? metadata.capabilities_required
    : [];
  const missingRequiredCapabilities = requeridas
    .filter((c): c is string => typeof c === "string" && c !== "")
    .filter((c) => !reader.capabilities.includes(c))
    .filter((c, i, todas) => todas.indexOf(c) === i)
    .sort();

  const versionTooOld = isNewer(required, reader.version);
  const cannotRender = versionTooOld || missingRequiredCapabilities.length > 0;

  return {
    requiredVersion: required,
    versionTooOld,
    missingCapabilities,
    missingRequiredCapabilities,
    cannotRender,
    hayAlgoQueDecir: versionTooOld || missingCapabilities.length > 0 || missingRequiredCapabilities.length > 0,
  };
}

/** A readable line for the console of whoever embeds the player. */
export function describeMissing(missing: MissingSupport): string {
  const reasons: string[] = [];
  if (missing.versionTooOld) {
    reasons.push(`the file requires format version ${missing.requiredVersion}`);
  }
  if (missing.missingRequiredCapabilities && missing.missingRequiredCapabilities.length > 0) {
    reasons.push(`requires ${missing.missingRequiredCapabilities.join(", ")}`);
  }
  if (missing.missingCapabilities && missing.missingCapabilities.length > 0) {
    reasons.push(`uses ${missing.missingCapabilities.join(", ")}`);
  }

  if (reasons.length === 0) return "";
  const prefix = missing.missingRequiredCapabilities && missing.missingRequiredCapabilities.length > 0
    ? "It cannot be fully rendered"
    : "Rendered what was possible";
  return `${prefix}: ${reasons.join(" and ")}.`;
}

/**
 * The contract version from which each capability exists.
 *
 * **It is empty today on purpose, and that is correct:** the four capabilities
 * the schema declares -`vector_parallax`, `infinite_parallax`, `path_morph`,
 * `physics_2d`- date from 1.0.0. Anything not listed here is at the base version.
 *
 * It exists empty because the alternative is a trap: writing into `min_player`
 * the version the editor was compiled with. That works today and breaks the day
 * the contract reaches 1.1.0, because a document that uses nothing new would
 * start requiring 1.1.0 and lock out readers perfectly capable of painting it.
 * The failure would also be invisible from the editor: the file looks right to
 * whoever wrote it.
 *
 * `min_player` is not "what it was made with", it is "what is needed to read it".
 */
export const VERSION_BY_CAPABILITY: Readonly<Record<string, string>> = { image_fill: "1.17.0", media_filters: "1.18.0", frame_shapes: "1.19.0" };

/** The greater of two readable versions; if either is not readable, the first. */
function higherVersion(a: string, b: string): string {
  return isNewer(b, a) ? b : a;
}

/**
 * The minimum contract version needed to read this document.
 *
 * The map comes in as a parameter so the mechanism can be tested without
 * inventing a future capability in production code.
 */
export function minVersionFor(
  metadata: any,
  versionMap: Readonly<Record<string, string>> = VERSION_BY_CAPABILITY,
): string {
  const declared: unknown[] = Array.isArray(metadata?.capabilities) ? metadata.capabilities : [];
  let minimum = BASE_CONTRACT_VERSION;
  for (const c of declared) {
    if (typeof c !== "string") continue;
    const from = versionMap[c];
    if (typeof from === "string") minimum = higherVersion(minimum, from);
  }
  return minimum;
}
