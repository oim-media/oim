/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { OimEffect, EffectBlend } from "./types.js";

/**
 * Normaliza cualquier objeto de estilo (incluyendo campos legacy como `grain`,
 * `layerBlur`, `shadowEnabled`) a un array canónico de efectos `OimEffect[]`.
 * Garantiza total retrocompatibilidad para vectores de conformidad y archivos existentes.
 */
export function normalizeSlotEffects(style?: Record<string, any>): OimEffect[] {
  if (!style || typeof style !== "object") {
    return [];
  }

  // Si ya tiene el array canonical `effects`, lo respetamos
  if (Array.isArray(style.effects) && style.effects.length > 0) {
    return style.effects.filter((e) => e && typeof e === "object" && typeof e.type === "string");
  }

  const result: OimEffect[] = [];

  // 1. Grano legacy (`grain: true`)
  if (style.grain === true) {
    const intensity = typeof style.grainIntensity === "number" ? style.grainIntensity : 20;
    const blend: EffectBlend =
      style.grainBlend === "soft-light" || style.grainBlend === "multiply"
        ? style.grainBlend
        : "overlay";
    result.push({
      type: "texture",
      preset: "fine-noise",
      intensity,
      blend,
      scale: 1,
      enabled: true,
    });
  }

  // 2. Desenfoque legacy (`layerBlur > 0` o `blur > 0`)
  const blurRadius =
    typeof style.layerBlur === "number" && style.layerBlur > 0
      ? style.layerBlur
      : typeof style.blur === "number" && style.blur > 0
        ? style.blur
        : 0;

  if (blurRadius > 0) {
    result.push({
      type: "blur",
      radius: blurRadius,
      enabled: true,
    });
  }

  // 3. Sombra legacy (`shadowEnabled: true`)
  if (style.shadowEnabled === true) {
    result.push({
      type: "drop-shadow",
      color: style.shadowColor || "rgba(0,0,0,0.35)",
      blur: typeof style.shadowBlur === "number" ? style.shadowBlur : 8,
      x: typeof style.shadowOffsetX === "number" ? style.shadowOffsetX : 0,
      y: typeof style.shadowOffsetY === "number" ? style.shadowOffsetY : 4,
      spread: 0,
      enabled: true,
    });
  }

  // 4. Efecto decorativo legacy (`effect: "neon" | "shadow"`)
  if (style.effect === "neon") {
    result.push({
      type: "glow",
      color: style.effectColor || "#00ffcc",
      radius: typeof style.effectRadius === "number" ? style.effectRadius : 12,
      intensity: 80,
      enabled: true,
    });
  } else if (style.effect === "shadow" && !style.shadowEnabled) {
    result.push({
      type: "drop-shadow",
      color: style.effectColor || "rgba(0,0,0,0.5)",
      blur: typeof style.effectRadius === "number" ? style.effectRadius : 10,
      x: 0,
      y: 4,
      spread: 0,
      enabled: true,
    });
  }

  return result;
}
