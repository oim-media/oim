/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The 3D extrusion of artistic text: the stacked layers behind the face.
 *
 * Seventh case of the same pattern. The editor and the player each had their
 * own `shadeHexColor`, and they did opposite things: the editor darkened
 * towards black, the player lightened towards white. With the same
 * `#111827`, the author saw an almost black extrusion and whoever opened the
 * .oim saw it white. The editor's darkening is kept: it is what the author
 * designed, and what the editor's own test said the colours should do.
 */

/** One layer of the extrusion, offset from the face. */
export interface ExtrusionStep {
  dx: number;
  dy: number;
  color: string;
  opacity: number;
}

/**
 * Darkens a hex colour towards black by `percent` (0 = unchanged, 1 = black).
 *
 * Accepts `#rgb` and `#rrggbb`. Anything else (a named colour, a CSS
 * variable) is returned untouched rather than guessed at.
 */
export function shadeHexColor(color: string, percent: number): string {
  if (typeof color !== "string" || !color.startsWith("#")) return color;
  let hex = color.slice(1);
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  if (hex.length !== 6) return color;
  const num = parseInt(hex, 16);
  if (Number.isNaN(num)) return color;

  const channel = (value: number) => Math.max(0, Math.min(255, Math.floor(value * (1 - percent))));
  const r = channel(num >> 16);
  const g = channel((num >> 8) & 0xff);
  const b = channel(num & 0xff);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * The extrusion layers, deepest first, so they paint back to front.
 *
 * Depth is clamped to 0-60 and each layer is one px further along the angle.
 * With shading, deeper layers are lighter and the ones next to the face are
 * darker, which reads as a shadow cast by the face.
 */
export function calculate3DExtrusionLayers(
  depth: number,
  angleDegrees: number,
  baseColor: string = "#111827",
  shading: boolean = true
): ExtrusionStep[] {
  const clampedDepth = Math.max(0, Math.min(60, depth));
  if (clampedDepth === 0) return [];

  const rad = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const steps = Math.max(1, Math.round(clampedDepth));
  const layers: ExtrusionStep[] = [];

  for (let i = steps; i >= 1; i--) {
    const t = i / steps;
    const dx = Math.round(cos * i * 10) / 10;
    const dy = Math.round(sin * i * 10) / 10;
    const color = shading ? shadeHexColor(baseColor, 1 - t * 0.5) : baseColor;
    layers.push({ dx, dy, color, opacity: 1 });
  }

  return layers;
}
