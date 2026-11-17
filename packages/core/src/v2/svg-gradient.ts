/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Gradient } from "./upgrade/gradient.js";

/**
 * A gradient as an SVG <linearGradient>/<radialGradient> in viewBox units
 * (`userSpaceOnUse`), so a multi-path drawing reads as one piece. The editor and
 * the player both draw with this, so they cannot disagree on the direction.
 * CSS angles: 0deg points up and turns clockwise; the line crosses the box centre.
 * A radial is centred and reaches the farthest corner (the CSS default).
 */
export function svgGradientAttrs(gradient: Gradient, viewBox: number[]) {
  const [vx, vy, vw, vh] = viewBox;
  const cx = vx + vw / 2;
  const cy = vy + vh / 2;
  const n = gradient.stops.length;
  const stops = gradient.stops.map((s, i) => ({ offset: `${Math.round((s.at ?? i / (n - 1)) * 1e4) / 100}%`, color: s.color }));
  if (gradient.type === "radial") return { tag: "radialGradient", attrs: { cx, cy, r: Math.hypot(vw / 2, vh / 2) }, stops };
  const rad = (((gradient.angle ?? 180) - 90) * Math.PI) / 180;
  const half = (Math.abs(vw * Math.cos(rad)) + Math.abs(vh * Math.sin(rad))) / 2;
  const dx = Math.cos(rad) * half;
  const dy = Math.sin(rad) * half;
  return { tag: "linearGradient", attrs: { x1: cx - dx, y1: cy - dy, x2: cx + dx, y2: cy + dy }, stops };
}
