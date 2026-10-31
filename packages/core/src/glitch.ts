/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export const DEFAULT_GLITCH_SPEED = 1;
export const DEFAULT_GLITCH_DELAY = 0;
export const DEFAULT_GLITCH_INTENSITY = 50;
export const GLITCH_CALM_RATIO = 0.7;

export interface GlitchOffset { x: number; y: number; }
export interface GlitchSlice { topPercent: number; bottomPercent: number; shiftX: number; }
export interface GlitchState {
  isActive: boolean;
  cyanOffset: GlitchOffset;
  magentaOffset: GlitchOffset;
  jitterSkew: number;
  slices: GlitchSlice[];
}

const CALM: GlitchState = {
  isActive: false,
  cyanOffset: { x: 0, y: 0 },
  magentaOffset: { x: 0, y: 0 },
  jitterSkew: 0,
  slices: []
};

function hash(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function calculateGlitchState(
  currentTime: number,
  speed = DEFAULT_GLITCH_SPEED,
  delay = DEFAULT_GLITCH_DELAY,
  intensity = DEFAULT_GLITCH_INTENSITY
): GlitchState {
  if (currentTime <= 0 || currentTime < delay) return CALM;

  const sp = Math.max(0.01, speed);
  const t = currentTime - delay;
  const tau = (t * sp) % 1;
  if (tau < GLITCH_CALM_RATIO) return CALM;

  const seed = Math.floor(t * sp) * 100 + Math.floor(((tau - GLITCH_CALM_RATIO) / (1 - GLITCH_CALM_RATIO)) * 6) * 10;
  const maxPx = 0.08 * Math.max(1, Math.min(100, intensity));
  const r = (n: number) => Math.round(n * 100) / 100;
  const hSkew = hash(seed + 5);
  const sd = seed + 10;
  const top = r(hash(sd) * 80);

  const off = (s: number) => ({ x: r((hash(s) * 2 - 1) * maxPx), y: r((hash(s + 1) * 2 - 1) * maxPx * .4) });

  return {
    isActive: true,
    cyanOffset: off(seed + 1),
    magentaOffset: off(seed + 3),
    jitterSkew: hSkew > 0.6 ? r((hSkew * 2 - 1) * 0.03 * intensity) : 0,
    slices: [{
      topPercent: top,
      bottomPercent: Math.min(100, r(top + 5 + hash(sd + 1) * 20)),
      shiftX: r((hash(sd + 2) * 2 - 1) * 1.5 * maxPx)
    }]
  };
}

export type GlitchType = "glitch-cyberpunk" | "glitch-slice";

/** One copy of the text drawn over it: portable primitives only. */
export interface GlitchCopy {
  /** Fixed colour of the copy (cyberpunk), or the text's own (slice). */
  color?: string;
  /** Offset in px. */
  dx: number;
  dy: number;
  opacity: number;
  /** Horizontal band the copy is cut to, in % of the height (slice). */
  clip?: { top: number; bottom: number };
}

/**
 * A glitch frame as portable primitives (contract audit): the
 * text with a skew, plus a fixed number of copies — 2 colour ghosts for
 * `glitch-cyberpunk`, 1 shifted band for `glitch-slice` — offset, faded and
 * cut by a rectangle. No text-shadow, no free clip-path: any renderer, web or
 * native, draws it. Out of a burst the copies are hidden (opacity 0) and the
 * text is still. One function for the editor canvas and the player.
 */
export function glitchLayers(type: GlitchType, s: GlitchState): { skewX: number; copies: GlitchCopy[] } {
  if (type === "glitch-slice") {
    const band = s.slices[0];
    return {
      skewX: 0,
      copies: [{ dx: s.isActive && band ? band.shiftX : 0, dy: 0, opacity: s.isActive && band ? 1 : 0,
        clip: { top: band ? band.topPercent : 0, bottom: band ? band.bottomPercent : 0 } }],
    };
  }
  return {
    skewX: s.jitterSkew, // 0 at rest (calculateGlitchState)
    copies: [
      { color: "#00ffff", dx: s.cyanOffset.x, dy: s.cyanOffset.y, opacity: s.isActive ? 0.85 : 0 },
      { color: "#ff00ff", dx: s.magentaOffset.x, dy: s.magentaOffset.y, opacity: s.isActive ? 0.85 : 0 },
    ],
  };
}
