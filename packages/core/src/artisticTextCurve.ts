/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The path along which curved artistic text runs.
 *
 * It lives here for the same reason as `typography.ts` and `fill.ts`: it was
 * written TWICE -once in the editor, once in the player- and the two copies
 * had diverged in both forms the editor offers:
 *
 *   arc: the control point sat 80% higher in the player, and its endpoints
 *        4 px above the editor's.
 *   wave: the editor's amplitude was 29% larger.
 *
 * The EDITOR's geometry is kept, not the player's, and not out of seniority:
 * the editor's keeps the arc centred in the box -the apex rises by `deltaY/4`
 * and the endpoints drop by `deltaY/2`-, whereas the player's anchored the
 * endpoints to the baseline and pushed the apex upward. With the curve at its
 * maximum, that left the text 11 px from the top edge of a 120 px box: clipped.
 *
 * It is no accident that it was copied and then diverged. The 3D extrusion was
 * also copied and is still identical; the curve is what someone tweaks "to make
 * it look better", and it gets tweaked on ONE side only.
 */

/** The path shapes. The editor does not offer `arch`; it is accepted and
 *  treated as an arc, which is what it already did. */
export type TextCurveType = "arc" | "wave" | "arch";

/**
 * Returns the `d` attribute of the path that the text follows.
 *
 * @param width  width of the box, in px
 * @param height height of the box, in px
 * @param curveAmount curvature from -100 to 100; 0 is a straight line
 * @param curveType shape of the path
 */
export function calculateTextCurvePath(
  width: number,
  height: number,
  curveAmount: number,
  curveType: TextCurveType = "arc"
): string {
  const midY = height / 2;
  const clampedCurve = Math.max(-100, Math.min(100, curveAmount));

  if (clampedCurve === 0) {
    return `M 0 ${midY} L ${width} ${midY}`;
  }

  // Maximum vertical displacement, proportional to the height and curvature
  const maxDelta = height * 0.45;
  const deltaY = (clampedCurve / 100) * maxDelta;

  if (curveType === "wave") {
    // Cubic sinusoidal wave
    const cp1x = width * 0.25;
    const cp1y = midY - deltaY;
    const cp2x = width * 0.75;
    const cp2y = midY + deltaY;
    return `M 0 ${midY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${width} ${midY}`;
  }

  // Quadratic arc
  const yStartEnd = midY + deltaY * 0.5;
  const yControl = midY - deltaY;

  return `M 0 ${yStartEnd} Q ${width / 2} ${yControl} ${width} ${yStartEnd}`;
}

/** One line of artistic text, placed around the vertical centre of its box. */
export interface ArtisticTextLine {
  text: string;
  /** Distance in px from the box's vertical centre to this line's centre. */
  offset: number;
}

/**
 * Splits artistic text into lines and centres the block vertically.
 *
 * An SVG `<text>` does not break lines: it paints "\n" as a space, which is
 * why pressing Enter in 3D/vector text did nothing. Each line is drawn on its
 * own, `offset` px from the centre. It lives here, shared, so the editor and
 * the player stack lines the same way.
 */
export function artisticTextLines(text: string, fontSize: number, lineHeight: number): ArtisticTextLine[] {
  const lines = String(text ?? "").split(/\r\n|\r|\n/);
  const step = fontSize * lineHeight;
  const middle = (lines.length - 1) / 2;
  return lines.map((line, i) => ({ text: line, offset: (i - middle) * step }));
}
