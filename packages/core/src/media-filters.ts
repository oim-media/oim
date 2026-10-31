/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * CSS for media filters (image and image fill).
 *
 * A single function serves all three renderers (editor, player and export):
 * if each one composed the filter on its own, they would diverge. Neutral
 * values (blur 0, hue 0, brightness/contrast/saturation 100, preset `none`)
 * produce no CSS, so an image with no adjustments carries no `filter` in the DOM.
 */

/** Single table of filter presets: the player and the other renderers use it through this function. */
export const FILTER_PRESET_CSS: Record<string, string> = {
  grayscale: "grayscale(1)",
  sepia: "sepia(0.8)",
  "high-contrast": "contrast(1.5) saturate(1.2)",
  vintage: "sepia(0.35) contrast(1.1) saturate(0.85) brightness(1.05)",
  cool: "saturate(1.1) hue-rotate(15deg) brightness(1.02)",
  warm: "saturate(1.15) hue-rotate(-12deg) brightness(1.03)",
  faded: "contrast(0.85) brightness(1.1) saturate(0.8)",
  cinema: "contrast(1.25) saturate(1.1) hue-rotate(-8deg) brightness(0.95)",
  nordic: "saturate(0.7) hue-rotate(20deg) brightness(1.05) contrast(1.1)",
  sunset: "sepia(0.4) saturate(1.4) hue-rotate(-20deg) brightness(1.05)",
  noir: "grayscale(1) contrast(1.6) brightness(0.9)",
  dramatic: "contrast(1.6) saturate(1.3) brightness(0.95)",
  cyberpunk: "contrast(1.3) saturate(1.8) hue-rotate(140deg)",
  pastel: "brightness(1.15) saturate(1.3) contrast(0.9) hue-rotate(-5deg)",
  vhs: "sepia(0.2) contrast(1.2) saturate(1.5) hue-rotate(30deg) brightness(1.05)",
};

/** Numeric value clamped to the schema range; NaN, Infinity or non-numeric → undefined (neutral). */
function acotado(valor: unknown, min: number, max: number): number | undefined {
  if (typeof valor !== "number" || !Number.isFinite(valor)) return undefined;
  return Math.min(max, Math.max(min, valor));
}

interface AjustesNormalizados {
  preset: string | undefined;
  blur: number;
  brightness: number;
  contrast: number;
  saturate: number;
  hue: number;
}

/** The settings, already clamped, with neutral values where one is missing or invalid. */
function normalizar(style: Record<string, unknown>): AjustesNormalizados {
  const { filterPreset: preset } = style;
  return {
    preset: typeof preset === "string" && Object.prototype.hasOwnProperty.call(FILTER_PRESET_CSS, preset) ? preset : undefined,
    blur: acotado(style.filterBlur, 0, 100) ?? 0,
    brightness: acotado(style.filterBrightness, 0, 500) ?? 100,
    contrast: acotado(style.filterContrast, 0, 500) ?? 100,
    saturate: acotado(style.filterSaturate, 0, 500) ?? 100,
    hue: acotado(style.filterHueRotate, 0, 360) ?? 0,
  };
}

/** Fixed order: preset, blur, brightness, contrast, saturation, hue-rotate. `undefined` if everything is neutral. */
export function mediaFilterCss(style: Record<string, unknown>): string | undefined {
  const a = normalizar(style);
  const parts: string[] = [];

  if (a.preset !== undefined) parts.push(FILTER_PRESET_CSS[a.preset]);
  if (a.blur !== 0) parts.push(`blur(${a.blur}px)`);
  if (a.brightness !== 100) parts.push(`brightness(${a.brightness}%)`);
  if (a.contrast !== 100) parts.push(`contrast(${a.contrast}%)`);
  if (a.saturate !== 100) parts.push(`saturate(${a.saturate}%)`);
  if (a.hue !== 0) parts.push(`hue-rotate(${a.hue}deg)`);

  return parts.length > 0 ? parts.join(" ") : undefined;
}

/** Whether the style applies any filter (neutral values do not count). */
export function hasMediaFilter(style: Record<string, unknown>): boolean {
  return mediaFilterCss(style) !== undefined;
}
