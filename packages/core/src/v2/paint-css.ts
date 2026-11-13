/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// A 2.0 paint as CSS. One function for every renderer that paints in the DOM
// (the scene, and through it the player and the editor's canvas). The CSS for
// patterns and generative fills is still the 1.x one, called through its
// fields, so both versions paint the same pixels while 1.x files exist.

import { getFillCss, type CSSProperties } from "../fill.js";
import type { Paint } from "./schema.js";
import type { Gradient } from "./upgrade/gradient.js";

/** How a renderer turns a 2.0 colour value into something it can paint. */
export type PaintColors = {
  /** A colour as CSS; may be a `var()` so a mode change needs no repaint. */
  css(value: unknown): string | undefined;
  /** A concrete colour, for paints drawn into an image (patterns, generative). */
  literal(value: unknown): string | undefined;
};

export type PaintTarget = {
  /** Text is painted through its glyphs: a non-flat fill clips to the text. */
  isText?: boolean;
  width?: number;
  height?: number;
  colors: PaintColors;
  /** Shared paints of the document, for `{ ref }`. */
  resources?: Record<string, Paint>;
};

const pct = (at: number) => `${+(at * 100).toFixed(4)}%`;

export function gradientCss(gradient: Gradient | { type: Gradient["type"]; angle?: number; stops: { color: unknown; at?: number }[] }, colors: PaintColors): string | undefined {
  const stops: string[] = [];
  for (const stop of gradient.stops) {
    const color = colors.css(stop.color);
    if (!color) return undefined;
    stops.push(stop.at === undefined ? color : `${color} ${pct(stop.at)}`);
  }
  const head =
    gradient.type === "linear"
      ? gradient.angle === undefined ? "" : `${gradient.angle}deg, `
      : gradient.type === "conic"
        ? gradient.angle === undefined ? "" : `from ${gradient.angle}deg, `
        : "";
  return `${gradient.type}-gradient(${head}${stops.join(", ")})`;
}

const clipToText = (css: CSSProperties): CSSProperties => ({
  ...css,
  backgroundClip: "text",
  WebkitBackgroundClip: "text",
  color: "transparent",
});

const withOpacity = (css: CSSProperties, opacity: number | undefined): CSSProperties =>
  opacity === undefined || opacity === 1 ? css : { ...css, opacity: String(opacity) };

/**
 * The CSS of one paint. Opacity is returned as `opacity` and is the caller's
 * to place: on its own node when the layer stacks several fills.
 */
export function paintCss(paint: Paint, target: PaintTarget, depth = 0): CSSProperties {
  const { colors, isText } = target;
  if ("ref" in paint) {
    const shared = target.resources?.[paint.ref];
    // A resource pointing at another resource is followed once; a loop paints nothing.
    return shared && depth < 4 ? paintCss(shared, target, depth + 1) : {};
  }
  const flat = (color: string | undefined): CSSProperties =>
    color ? (isText ? { color } : { backgroundColor: color }) : {};

  switch (paint.kind) {
    case "color":
      return withOpacity(flat(colors.css(paint.value)), paint.opacity);
    case "gradient": {
      const css = paint.gradient ? gradientCss(paint.gradient as never, colors) : undefined;
      if (!css) return {};
      const out = { backgroundImage: css };
      return withOpacity(isText ? clipToText(out) : out, paint.opacity);
    }
    case "pattern": {
      const p = paint.pattern;
      const list = (p.colors ?? []).map((c) => colors.literal(c)).filter((c): c is string => !!c);
      const css = getFillCss({
        type: isText ? "text" : "shape",
        fillType: "pattern",
        fillPatternType: p.preset ?? "clouds",
        fillPatternColor: list[0],
        fillPatternColors: list.length > 1 ? list : undefined,
        fillPatternBgColor: colors.literal(p.bg),
        fillPatternScale: p.scale,
        fillPatternSizes: p.sizes,
        fillPatternCounts: p.counts,
        fillPatternDispersions: p.dispersions,
        fillPatternSvgs: p.svgs,
        fillPatternDirection: p.motion?.direction,
        fillPatternSpeed: p.motion?.period,
      });
      return withOpacity(css, paint.opacity);
    }
    case "generative": {
      const css = getFillCss({
        type: isText ? "text" : "shape",
        width: target.width,
        height: target.height,
        fillType: "generative",
        fillGenerative: paint.generative,
      });
      return withOpacity(css, paint.opacity);
    }
    default:
      // image and texture are drawn as their own nodes by the renderer.
      return {};
  }
}
