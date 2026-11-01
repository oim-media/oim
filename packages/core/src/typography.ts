/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Line height: how tall a line of text is.
 *
 * It lives here because the fault IS that the editor and the player did not
 * agree. Measured at the time, there were FOUR opinions about the same property:
 *
 *   - the editor paints with `lineHeight ?? 1.25` on the canvas;
 *   - the player had no line naming `lineHeight`, but a generic loop dumped
 *     EVERY key of `style` as a CSS property, so the file's value reached the
 *     element unvalidated -a `0` collapsed the lines, a `99` covered the
 *     document- and a layer without one kept the browser's `normal`, which
 *     depends on the font and is around 1.15-1.2 and not a fixed number. That
 *     last case is the common one, and the real divergence;
 *   - published .oim files carry `"1.2"`, as a STRING, not as a number;
 *   - `styleSchema` did not even declare the field, so `z.object` discarded it
 *     when validating and the published contract did not mention it.
 *
 * The consequence was visible: the text box came out lower than the editor had
 * planned, and the descenders -the "j", the "p", the "g"- were cut off by the
 * slot's `overflow: hidden`.
 *
 * ## Why it is clamped instead of discarded
 *
 * The editor's control declares `min="0.5" max="3"`, but `<input
 * type="number">` does not stop typing outside the range: the attribute only
 * blocks submitting a form, and there is no form here. A file can carry 99.
 *
 * Clamping keeps the intent -whoever wrote 5 wanted "very tall" and receives the
 * maximum the editor offers. Discarding it and falling back to 1.25 would give a
 * result nobody asked for, one that also looks like nothing was ever written.
 *
 * ## Why unitless
 *
 * A unitless `line-height` is a factor and is inherited as a factor: each
 * descendant multiplies it by ITS OWN font size. With `px` or `em` it is
 * inherited already computed, so a smaller child would receive the parent's
 * line height and the lines would spread too far apart.
 */

/** What the editor paints when the layer says nothing. */
export const DEFAULT_LINE_HEIGHT = 1.25;

/** The limits declared by the editor's control. */
export const MIN_LINE_HEIGHT = 0.5;
export const MAX_LINE_HEIGHT = 3;

/**
 * A style's line height, as a unitless factor.
 *
 * It accepts the number and the numeric string because published .oim files
 * carry the second. Anything else -empty, text, zero, negative, infinite- falls
 * back to the default: a zero would collapse the lines onto each other, and
 * unreadable text is worse than text with the usual line height.
 */
export function resolveLineHeight(style: any): number {
  const raw = style && style.lineHeight;

  let value: number;
  if (typeof raw === 'number') value = raw;
  else if (typeof raw === 'string' && raw.trim() !== '') value = Number(raw);
  else return DEFAULT_LINE_HEIGHT;

  if (!Number.isFinite(value) || value <= 0) return DEFAULT_LINE_HEIGHT;

  return Math.min(MAX_LINE_HEIGHT, Math.max(MIN_LINE_HEIGHT, value));
}

/**
 * The height a font declares, in multiples of its size, for the worst of the
 * ones measured.
 *
 * Measured in a real browser with `fontBoundingBox`, at 48 px:
 *
 *     Poppins            1.396 em   <- the largest
 *     Playfair Display   1.333
 *     Inter              1.229
 *     Montserrat         1.208
 *     Georgia            1.146
 *     Arial              1.104
 *
 * The maximum is used, not the average, on purpose: falling short leaves half
 * a letter without color, while overshooting only enlarges an invisible area.
 */
export const MAX_FONT_HEIGHT = 1.4;

/**
 * How far the ink protrudes ABOVE and BELOW the line box, in `em`, for a given
 * line height.
 *
 * ## What it fixes
 *
 * `background-clip: text` clips the paint to the element's background area, and
 * that area is the line box. When the ink of a descendant -the "j", the "p", the
 * "g"- protrudes out of it, that part of the letter is left WITHOUT FILL:
 * transparent. With a text stroke it looks very clear, because the outline
 * stays where the color no longer reaches.
 *
 * It is the same geometric fact that already caused two other things -that
 * `overflow: hidden` would cut off the glyphs, and that the editor's and the
 * player's line heights did not match- seen for a third time. One fact, three
 * symptoms that do not look alike.
 *
 * ## Why it returns ZERO when the ink already fits
 *
 * Adding extra margin is not free: it enlarges the background area, and a
 * VERTICAL gradient is spread over it, so its colors shift. With a generous
 * line height the ink already fits and there is nothing to compensate; returning
 * a fixed value would change the gradient for no reason.
 */
export function inkMargin(height: number): number {
  if (!Number.isFinite(height) || height <= 0) height = DEFAULT_LINE_HEIGHT;
  const excess = MAX_FONT_HEIGHT - height;
  if (excess <= 0) return 0;
  // Rounded to the ten-thousandth because this number ends up LITERALLY in the
  // CSS: `1.4 - 1.25` gives 0.15000000000000002 in floating point, and from that
  // came a `padding-top: 0.07499999999999996em`. It is valid and it is absurd,
  // and four decimals of `em` are more precision than any font size needs.
  return Math.round((excess / 2) * 10000) / 10000;
}
