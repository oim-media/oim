/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DynamicColorRole } from "../dynamic-colors.js";

export const TEXTURE_PRESETS = [
  "film-grain-35mm",
  "fine-noise",
  "dust-scratches",
  "vintage-paper",
  "rough-canvas",
  "halftone-dots",
  "scanlines",
  "concentric-rings",
] as const;
export type TexturePreset = (typeof TEXTURE_PRESETS)[number];

export const EFFECT_BLENDS = [
  "normal",
  "overlay",
  "soft-light",
  "multiply",
  "screen",
  "color-dodge",
  "darken",
  "lighten",
] as const;
export type EffectBlend = (typeof EFFECT_BLENDS)[number];

export interface OimTextureEffect {
  type: "texture";
  preset: TexturePreset;
  intensity: number; // 0..100
  blend: EffectBlend;
  scale?: number; // 0.2..5.0, default 1.0
  color?: string; // Optional tint
  colorRole?: DynamicColorRole;
  enabled: boolean;
}

export interface OimDropShadowEffect {
  type: "drop-shadow";
  x: number;
  y: number;
  blur: number;
  spread?: number;
  color: string;
  colorRole?: DynamicColorRole;
  enabled: boolean;
}

export interface OimBlurEffect {
  type: "blur";
  radius: number; // en px o cqw
  enabled: boolean;
}

export interface OimGlowEffect {
  type: "glow";
  color: string;
  colorRole?: DynamicColorRole;
  radius: number;
  intensity?: number;
  enabled: boolean;
}

export interface OimColorGradeEffect {
  type: "color-grade";
  preset: "warm-vintage" | "cool-cinema" | "cyberpunk" | "monochrome-contrast";
  intensity: number;
  enabled: boolean;
}

export type OimEffect =
  | OimTextureEffect
  | OimDropShadowEffect
  | OimBlurEffect
  | OimGlowEffect
  | OimColorGradeEffect;
