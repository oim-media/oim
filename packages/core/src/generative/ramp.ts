/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

function srgbToLinear(c: number): number {
  return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
}

function linearToSrgb(c: number): number {
  const clamped = Math.max(0, Math.min(1, c));
  return clamped > 0.0031308 ? 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055 : 12.92 * clamped;
}

function hexToRgb(hex: string): [number, number, number] {
  let cleaned = hex.trim().replace(/^#/, "");
  if (cleaned.length === 3) {
    cleaned = cleaned.split("").map((ch) => ch + ch).join("");
  }
  const num = parseInt(cleaned, 16);
  if (isNaN(num)) {
    return [0, 0, 0];
  }
  return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const rByte = Math.round(r * 255);
  const gByte = Math.round(g * 255);
  const bByte = Math.round(b * 255);
  return `#${((1 << 24) + (rByte << 16) + (gByte << 8) + bByte).toString(16).slice(1).toLowerCase()}`;
}

function rgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2118591070 * lr + 0.6806951351 * lg + 0.1074457579 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return [
    0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
  ];
}

function oklabToRgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const lr = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  return [linearToSrgb(lr), linearToSrgb(lg), linearToSrgb(lb)];
}

export function interpolateOklab(color1: string, color2: string, t: number): string {
  const clampedT = Math.max(0, Math.min(1, t));
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  const lab1 = rgbToOklab(rgb1[0], rgb1[1], rgb1[2]);
  const lab2 = rgbToOklab(rgb2[0], rgb2[1], rgb2[2]);

  const L = lab1[0] + (lab2[0] - lab1[0]) * clampedT;
  const a = lab1[1] + (lab2[1] - lab1[1]) * clampedT;
  const b = lab1[2] + (lab2[2] - lab1[2]) * clampedT;

  const rgbOut = oklabToRgb(L, a, b);
  return rgbToHex(rgbOut[0], rgbOut[1], rgbOut[2]);
}

export interface RampOptions {
  mode: 'monochrome' | 'palette';
  stops: string[];
  direction?: 'forward' | 'reverse' | 'radial';
}

export function createColorRamp(options: RampOptions): (i: number, total: number) => string {
  const { mode, stops, direction = 'forward' } = options;
  const validStops = stops && stops.length > 0 ? stops : ['#3b82f6', '#0f172a'];

  return function getLayerColor(i: number, total: number): string {
    if (total <= 1) return validStops[0];

    let t = total > 1 ? i / (total - 1) : 0;
    if (direction === 'reverse') {
      t = 1 - t;
    } else if (direction === 'radial') {
      t = Math.abs(t - 0.5) * 2;
    }

    if (mode === 'monochrome' || validStops.length === 2) {
      const c1 = validStops[0];
      const c2 = validStops[validStops.length - 1];
      return interpolateOklab(c1, c2, t);
    }

    // Palette mode with N stops
    const segmentCount = validStops.length - 1;
    const scaledT = t * segmentCount;
    const segmentIndex = Math.min(Math.floor(scaledT), segmentCount - 1);
    const segmentT = scaledT - segmentIndex;

    return interpolateOklab(validStops[segmentIndex], validStops[segmentIndex + 1], segmentT);
  };
}
