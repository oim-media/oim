/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Layer, PaintColors } from "@oim-media/core/v2";

export type StrokeContext = { colors: PaintColors; isText: boolean };

const STROKE_PROPS = ["border", "boxShadow", "WebkitTextStroke"] as const;

/**
 * The CSS of a layer's stroke. A text's stroke outlines its letters. A shape's
 * first colour stroke is its border when centred (as the player draws it), or a
 * box shadow on the inner or outer edge. Gradient and picture strokes are not drawn yet.
 */
export function strokeCss(layer: Pick<Layer, "strokes">, ctx: StrokeContext): Partial<Record<(typeof STROKE_PROPS)[number], string>> {
  const stroke = (layer.strokes ?? []).find((s) => "kind" in s.paint && s.paint.kind === "color");
  if (!stroke || !("kind" in stroke.paint) || stroke.paint.kind !== "color") return {};
  const color = ctx.colors.css(stroke.paint.value);
  if (!color) return {};
  const width = `${stroke.width}px`;
  if (ctx.isText) return { WebkitTextStroke: `${width} ${color}` };
  if (stroke.align === "inside") return { boxShadow: `inset 0 0 0 ${width} ${color}` };
  if (stroke.align === "outside") return { boxShadow: `0 0 0 ${width} ${color}` };
  return { border: `${width} ${stroke.style ?? "solid"} ${color}` };
}

/** Puts the stroke on the element, replacing any earlier one. */
export function applyStrokes(el: HTMLElement, layer: Pick<Layer, "strokes">, ctx: StrokeContext): void {
  const style = el.style as unknown as Record<string, string>;
  for (const prop of STROKE_PROPS) style[prop] = "";
  Object.assign(el.style, strokeCss(layer, ctx));
}
