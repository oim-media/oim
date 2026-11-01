/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * How much to enlarge a parallax layer so that moving it never uncovers the
 * empty space behind it.
 *
 * The problem: a parallax layer follows the pointer. If its edge meets the
 * canvas edge (a horizon spanning side to side, a floor along the bottom),
 * moving it uncovers a strip as wide as the offset. It shows in the player
 * and not in the editor, because the editor moves nothing while you edit.
 *
 * CANONICAL: the editor and the player both use this module; never fork it.
 */

/** How a layer moves. Same as `ParallaxSlotItem.axis`. */
export type ParallaxAxis = "both" | "x_only" | "y_only";

/** The layer in canvas pixels, with the origin at the top left. */
export interface LayerBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CanvasSize {
  width: number;
  height: number;
}

/**
 * Cap on the factor. A small layer stuck to the edge would ask for a huge factor
 * (a 20px one that needs 15px per side would come out at 2.5), and enlarging it that much
 * turns it into something else. Above this it is preferred that the crop shows
 * rather than deforming the composition: it is a visible, honest failure instead of
 * a layer that is no longer the one that was drawn.
 */
export const MAX_SCALE = 1.35;

/**
 * Maximum pixel offset of a layer with mouse parallax.
 *
 * `30` and not `60`: the engine multiplies `60 * depth` by the normalized pointer
 * position, which is CLAMPED to [-0.5, +0.5]. The controller's comment says
 * "Max +- 60px" and is false; the maximum is half. If the pointer range is ever
 * widened, this number must go up with it.
 */
export function maxOffset(depth: number): number {
  const d = Number(depth);
  if (!Number.isFinite(d)) return 0;
  return 30 * Math.abs(d);
}

/**
 * The scale factor the layer needs, or `1` if it does not need one.
 *
 * Only the axis the layer MOVES on is checked: a layer with `y_only` stuck to the
 * left edge uncovers nothing on that side.
 *
 * The factor is SINGLE for both axes (the larger of the two), not one per axis.
 * Scaling x differently from y deforms the layer, and deforming parallax groups
 * was already a real bug in this editor.
 */
export function oversizeScale(
  caja: LayerBox,
  canvas: CanvasSize,
  depth: number,
  eje: ParallaxAxis = "both",
  /**
   * The layer is wrapped in an infinite-loop track.
   *
   * So it is NOT oversized. This is not a gratuitous special case: the track already
   * solves the edge by construction. `infiniteLayerPlan` computes the pieces as
   * `ceil((unit + canvas) / unit)` precisely so the layer covers the canvas for the
   * whole loop and never shows the background. Enlarging it fixes nothing and does
   * harm: each piece looks larger than what was drawn, and the number of pieces was
   * computed for the size
   * WITHOUT scaling.
   *
   * It lives here, not in each engine, because the player and the editor decide 'this layer
   * has a track' with DIFFERENT conditions (the player checks the speed without
   * checking the mode; the editor checks the mode or `inf.enabled`), and that difference already
   * exists. If each one also decided on its own whether to oversize, there would be two rules
   * instead of one.
   */
  tienePistaInfinita: boolean = false
): number {
  if (tienePistaInfinita) return 1;
  const d = maxOffset(depth);
  if (d <= 0) return 1;
  if (!(caja.width > 0) || !(caja.height > 0)) return 1;

  const seMueveEnX = eje === "both" || eje === "x_only";
  const seMueveEnY = eje === "both" || eje === "y_only";

  /**
   * What must be added on one side, or 0 if that side is not anchored.
   *
   * `margen` is the distance from the layer's edge to the canvas edge; NEGATIVE if the
   * layer already overhangs.
   *
   * Two different things, and confusing them was the first bug of this function:
   *
   * - **Anchored**: only the side that REACHES the edge is corrected, `margen <= d`.
   *   A layer 300px from the edge has a design gap; moving apart a bit more while moving
   *   is the effect, not a bug.
   * - **How much**: `d + margen`. With the layer flush (`margen = 0`) `d` is needed;
   *   if it already overhangs 50px and only moves 15, NOTHING is needed, and with the naive
   *   subtraction `d - margen` it would have asked for 65.
   */
  const porUnLado = (margen: number) => (margen <= d ? Math.max(0, d + margen) : 0);
  const falta = (margenA: number, margenB: number) =>
    Math.max(porUnLado(margenA), porUnLado(margenB));

  const faltaX = seMueveEnX
    ? falta(caja.left, canvas.width - (caja.left + caja.width))
    : 0;
  const faltaY = seMueveEnY
    ? falta(caja.top, canvas.height - (caja.top + caja.height))
    : 0;

  if (faltaX <= 0 && faltaY <= 0) return 1;

  // The scale is centered, so it grows `width * (s - 1) / 2` per side.
  const escala = Math.max(1 + (2 * faltaX) / caja.width, 1 + (2 * faltaY) / caja.height);
  return Math.min(MAX_SCALE, Number(escala.toFixed(4)));
}
