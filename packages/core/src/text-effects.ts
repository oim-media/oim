/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Entrance text effects (`style.textAnimationType`), defined as data and pure
 * functions so the editor, the player and any native renderer draw the same
 * thing. Each unit (a letter, or a word) plays once, 0.35 s,
 * starting `delay + index × stagger` seconds in, and then stays still.
 *
 * Portable or it does not go in: a frame only holds opacity, a vertical
 * translation (in em), a scale and a rotation — primitives every graphics
 * engine has cheap — plus, per effect, whether each unit sits behind a
 * rectangular clip of its own box (`entranceClips`). `blur-chars` is retired for that reason (per-letter blur is not
 * portable); the schema keeps it so old files still validate.
 * Spec: docs/superpowers/specs/2026-10-10-efectos-de-texto-design.md
 */

export const ENTRANCE_EFFECTS = ["fade-chars", "slide-up", "bounce-chars", "reveal-mask", "scale-in", "rise-words"] as const;
export type EntranceEffect = (typeof ENTRANCE_EFFECTS)[number];

/** How long one unit takes to enter, in seconds. */
export const ENTRANCE_SECONDS = 0.35;
/** Seconds between one unit and the next when the file gives none. */
export const DEFAULT_ENTRANCE_STAGGER = 0.05;

export interface EntranceFrame {
  opacity: number;
  /** Downward offset in em (0 = in place). */
  translateYEm: number;
  scale: number;
  /** Clockwise rotation in degrees (0 = upright). */
  rotateDeg: number;
}

/** Effects whose unit is a word (with the spaces between kept as their own units). */
const WORD_EFFECTS: readonly EntranceEffect[] = ["slide-up", "reveal-mask", "rise-words"];

export function isEntranceEffect(type: unknown): type is EntranceEffect {
  return typeof type === "string" && (ENTRANCE_EFFECTS as readonly string[]).includes(type);
}

/**
 * Whether each unit is drawn inside a rectangular clip of its own box, so it
 * shows only once it rises into place. Only `reveal-mask`: a word, not a line,
 * because where a line breaks is the renderer's layout, and a clip per word
 * reads the same without measuring it.
 */
export function entranceClips(effect: EntranceEffect): boolean {
  return effect === "reveal-mask";
}

/** The units that enter one by one: letters, or words (and the spaces between). */
export function entranceUnits(text: string, effect: EntranceEffect): string[] {
  if (WORD_EFFECTS.includes(effect)) return text.match(/\S+|\s+/g) ?? [];
  return Array.from(text);
}

/** When unit `index` starts, in seconds. */
export function entranceStart(index: number, stagger = DEFAULT_ENTRANCE_STAGGER, delay = 0): number {
  return delay + index * stagger;
}

/** The frame of `effect` at `progress` (0..1, before easing). */
export function entranceFrame(effect: EntranceEffect, progress: number): EntranceFrame {
  const p = Math.max(0, Math.min(1, progress));
  const eased = p * (2 - p); // ease-out
  if (effect === "slide-up") return { opacity: eased, translateYEm: (1 - eased) * 0.6, scale: 1, rotateDeg: 0 };
  // Rises a full line height from under its clip; no fade, the clip hides it.
  if (effect === "reveal-mask") return { opacity: 1, translateYEm: (1 - eased) * 1.2, scale: 1, rotateDeg: 0 };
  if (effect === "scale-in") return { opacity: eased, translateYEm: 0, scale: 0.6 + 0.4 * eased, rotateDeg: 0 };
  if (effect === "rise-words") return { opacity: eased, translateYEm: (1 - eased) * 0.8, scale: 1, rotateDeg: (1 - eased) * 8 };
  if (effect === "bounce-chars") {
    // Grows past full size (1.15) and settles back: the bounce.
    const scale = eased === 0 ? 0 : eased < 0.7 ? (eased / 0.7) * 1.15 : 1.15 - ((eased - 0.7) / 0.3) * 0.15;
    return { opacity: eased, translateYEm: 0, scale: Math.round(scale * 1e6) / 1e6, rotateDeg: 0 };
  }
  return { opacity: eased, translateYEm: 0, scale: 1, rotateDeg: 0 };
}

/** The frame of unit `index` at time `t` seconds. */
export function entranceFrameAt(effect: EntranceEffect, t: number, index: number, stagger?: number, delay?: number): EntranceFrame {
  return entranceFrame(effect, (t - entranceStart(index, stagger, delay)) / ENTRANCE_SECONDS);
}

/** `steps + 1` frames evenly spaced from 0 to 1, for renderers that interpolate keyframes. */
export function entranceKeyframes(effect: EntranceEffect, steps = 10): EntranceFrame[] {
  return Array.from({ length: steps + 1 }, (_, i) => entranceFrame(effect, i / steps));
}
