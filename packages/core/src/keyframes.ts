/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// What a keyframed layer looks like at a given time. The web player hands the
// frames to WAAPI, which applies this rule implicitly; it is written down here
// so a player without WAAPI (Flutter) moves the same way. The shared cases are
// in packages/spec/keyframe-cases.json.

import type { KeyframeEasing } from "./schema.js";

export interface KeyframeState {
  x: number;
  y: number;
  r: number;
  s: number;
  /** Unclamped (the format allows up to 2); the painter clamps to 1. */
  o: number;
  b: number;
}

type Frame = { t: number; x?: number; y?: number; r?: number; s?: number; o?: number; b?: number; e?: KeyframeEasing };
type Channel = { offset: number; value: number[]; e?: KeyframeEasing };

const NAMED: Record<string, [number, number, number, number]> = {
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
};

function cubicBezier(x1: number, y1: number, x2: number, y2: number, x: number): number {
  const bx = (t: number) => 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 60; i++) {
    const t = (lo + hi) / 2;
    if (bx(t) < x) lo = t;
    else hi = t;
  }
  const t = (lo + hi) / 2;
  return 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
}

/** Eased progress for 0..1, with the CSS meaning of each easing. */
export function easeProgress(e: KeyframeEasing | undefined, p: number): number {
  if (e === undefined || e === "linear") return p;
  if (e === "steps(1, end)") return p >= 1 ? 1 : 0;
  const b = Array.isArray(e) ? e : NAMED[e];
  return b ? cubicBezier(b[0], b[1], b[2], b[3], p) : p;
}

function sample(frames: Channel[], base: number[], p: number): number[] {
  if (frames.length === 0) return base;
  const list = [...frames];
  // WAAPI fills a missing 0% or 100% frame with the layer's own value.
  if (list[0].offset > 0) list.unshift({ offset: 0, value: base });
  if (list[list.length - 1].offset < 1) list.push({ offset: 1, value: base });
  for (let i = 0; i < list.length - 1; i++) {
    const a = list[i];
    const b = list[i + 1];
    if (p <= b.offset) {
      const span = b.offset - a.offset;
      const local = span > 0 ? (p - a.offset) / span : 1;
      const k = easeProgress(a.e, Math.max(0, Math.min(1, local)));
      return a.value.map((v, j) => v + (b.value[j] - v) * k);
    }
  }
  return list[list.length - 1].value;
}

/** The layer's state at `time` seconds of an animation lasting `duration`. */
export function sampleKeyframes(keyframes: Frame[], duration: number, time: number): KeyframeState {
  const p = duration > 0 ? Math.max(0, Math.min(1, time / duration)) : 1;
  const offset = (kf: Frame) => Math.max(0, Math.min(1, kf.t / duration));
  // Each frame always carries a transform (missing parts are identity); opacity
  // and blur only exist in the frames that declare them.
  const transform = keyframes.map((kf) => ({ offset: offset(kf), value: [kf.x || 0, kf.y || 0, kf.r || 0, kf.s ?? 1], e: kf.e }));
  const opacity = keyframes.filter((kf) => kf.o !== undefined).map((kf) => ({ offset: offset(kf), value: [kf.o as number], e: kf.e }));
  const blur = keyframes.filter((kf) => kf.b !== undefined).map((kf) => ({ offset: offset(kf), value: [kf.b as number], e: kf.e }));
  const [x, y, r, s] = sample(transform, [0, 0, 0, 1], p);
  return { x, y, r, s, o: sample(opacity, [1], p)[0], b: sample(blur, [0], p)[0] };
}
