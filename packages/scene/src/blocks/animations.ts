/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Animation } from "@oim-media/core/v2";
import { easingToCss, revealFrames } from "../../../core/src/reveal.js";
import type { RevealEffect } from "../../../core/src/schema.js";
import { isEntranceEffect } from "../../../core/src/text-effects.js";
import { presetEasing, presetFrames, presetSeconds } from "./presets.js";

const REVEAL_EFFECTS: readonly string[] = ["fade", "slide-up", "slide-down", "slide-left", "slide-right", "scale"];

/** The presets scene runs today: the reveals an action shows and hides with. The rest wait for their painter (see coverage). */
export const isRevealPreset = (preset: string | undefined): preset is RevealEffect => preset !== undefined && REVEAL_EFFECTS.includes(preset);

/** A text entrance: a named effect run over the characters, words or lines of a text. */
export const isEntrance = (a: Animation): boolean => a.target !== undefined && a.target !== "layer" && isEntranceEffect(a.preset);
const namedFrames = (a: Animation) => (a.on === "loop" || a.on === "hover" ? presetFrames(a.on, a.preset) : undefined);

/** Text presets drawn on a timer or a per-char CSS loop (the 1.x player's helpers). */
export const isTimedText = (a: Animation): boolean =>
  a.target !== undefined && a.target !== "layer" && (a.preset === "typewriter" || a.preset === "wave-chars" || a.preset === "glitch-cyberpunk" || a.preset === "glitch-slice");

export const canAnimate = (a: Animation): boolean =>
  a.tracks !== undefined || isEntrance(a) || isTimedText(a) || namedFrames(a) !== undefined || (isRevealPreset(a.preset) && !a.target);

type Track = NonNullable<Animation["tracks"]>[number];

/** A track's value at `t`, straight between its keyframes (each keyframe's easing shapes the frame it starts). */
const valueAt = (track: Track, t: number): number => {
  const k = track.keyframes;
  if (t <= k[0].t) return k[0].v;
  for (let i = 1; i < k.length; i++) {
    if (t <= k[i].t) return k[i - 1].v + ((k[i].v - k[i - 1].v) * (t - k[i - 1].t)) / (k[i].t - k[i - 1].t || 1);
  }
  return k[k.length - 1].v;
};

/**
 * The WAAPI frames of a set of tracks: one frame per keyframe time of any track,
 * only independent properties (`translate`, `scale`, `rotate`), so the box keeps
 * its own `transform`. `len` turns canvas pixels into the scene's length.
 */
export function trackFrames(tracks: readonly Track[], len: (px: number) => string): Keyframe[] {
  const times = [...new Set(tracks.flatMap((tr) => tr.keyframes.map((k) => k.t)))].sort((a, b) => a - b);
  return times.map((t) => {
    const frame: Keyframe = { offset: t };
    let x: number | undefined;
    let y: number | undefined;
    for (const tr of tracks) {
      const v = valueAt(tr, t);
      if (tr.property === "opacity") frame.opacity = v;
      else if (tr.property === "scale") frame.scale = String(v);
      else if (tr.property === "rotation") frame.rotate = `${v}deg`;
      else if (tr.property === "blur") frame.filter = `blur(${len(v)})`;
      else if (tr.property === "x") x = v;
      else if (tr.property === "y") y = v;
      // trimStart/trimEnd draw a stroke along its path; they have no CSS property on the layer box.
      const own = tr.keyframes.find((k) => k.t === t)?.e;
      if (own !== undefined) frame.easing = easingToCss(own, "linear");
    }
    if (x !== undefined || y !== undefined) frame.translate = `${len(x ?? 0)} ${len(y ?? 0)}`;
    return frame;
  });
}

/** An animation's frames: its tracks, or the reveal its preset names. */
export function animationFrames(a: Animation, len: (px: number) => string): Keyframe[] {
  if (a.tracks) return trackFrames(a.tracks, len);
  return namedFrames(a) ?? revealFrames(a.preset as RevealEffect, true);
}

export function animationTiming(a: Animation): KeyframeAnimationOptions {
  const loop = a.on === "loop" && !a.tracks ? a.preset : undefined;
  // A named loop without a length of its own keeps the 1.x default.
  const duration = loop && !a.duration ? (presetSeconds(loop) ?? 0) * 1000 : a.duration;
  return {
    duration,
    delay: a.delay ?? 0,
    easing: easingToCss(a.easing, a.tracks ? "linear" : (loop && presetEasing(loop)) || "ease-out"),
    fill: "both",
    iterations: a.on === "loop" ? Infinity : 1,
  };
}
