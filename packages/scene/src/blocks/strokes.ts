/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Layer, PaintColors } from "@oim-media/core/v2";

export type StrokeContext = { colors: PaintColors; isText: boolean; /** A vector figure draws its own stroke (see geometry). */ vector?: boolean };

const STROKE_PROPS = ["border", "boxShadow", "WebkitTextStroke"] as const;

/** The layer's first stroke with a colour paint, and that colour; gradient and picture strokes are not drawn yet. */
export function colorStrokeOf(layer: Pick<Layer, "strokes">, colors: PaintColors): (NonNullable<Layer["strokes"]>[number] & { color: string }) | undefined {
  for (const stroke of layer.strokes ?? []) {
    if (!("kind" in stroke.paint) || stroke.paint.kind !== "color") continue;
    const color = colors.css(stroke.paint.value);
    if (color) return { ...stroke, color };
  }
  return undefined;
}

/**
 * The CSS of a layer's stroke. A text's stroke outlines its letters. A box's
 * stroke is its border when centred (as the player draws it), or a box shadow on
 * the inner or outer edge. A vector figure's stroke is drawn on the figure.
 */
export function strokeCss(layer: Pick<Layer, "strokes">, ctx: StrokeContext): Partial<Record<(typeof STROKE_PROPS)[number], string>> {
  const stroke = colorStrokeOf(layer, ctx.colors);
  if (!stroke) return {};
  const width = `${stroke.width}px`;
  if (ctx.isText) return { WebkitTextStroke: `${width} ${stroke.color}` };
  if (ctx.vector) return {};
  if (stroke.align === "inside") return { boxShadow: `inset 0 0 0 ${width} ${stroke.color}` };
  if (stroke.align === "outside") return { boxShadow: `0 0 0 ${width} ${stroke.color}` };
  return { border: `${width} ${stroke.style ?? "solid"} ${stroke.color}` };
}

/** Puts the stroke on the element, replacing any earlier one. */
export function applyStrokes(el: HTMLElement, layer: Pick<Layer, "strokes">, ctx: StrokeContext): void {
  const style = el.style as unknown as Record<string, string>;
  for (const prop of STROKE_PROPS) style[prop] = "";
  Object.assign(el.style, strokeCss(layer, ctx));
}
