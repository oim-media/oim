/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// How a layer enters and leaves when an action shows or hides it. One function
// for the player and the editor preview, so both move the same way.

import type { KeyframeEasing, Reveal, RevealEffect } from "./schema.js";

/** A layer without `reveal`: the fade the player has always done. */
export const REVEAL_DEFAULT = { effect: "fade", durationIn: 300, durationOut: 250, easing: "ease" } as const;

export function easingToCss(e: KeyframeEasing | undefined, fallback: string): string {
  if (e === undefined) return fallback;
  return Array.isArray(e) ? `cubic-bezier(${e.join(",")})` : e;
}

// Where a slide starts, as the CSS `translate` property: 4% of the overlay width.
const SLIDE_FROM: Partial<Record<RevealEffect, string>> = {
  "slide-up": "0 4cqw",
  "slide-down": "0 -4cqw",
  "slide-left": "4cqw 0",
  "slide-right": "-4cqw 0",
};

/**
 * Two WAAPI frames, hidden → shown (reversed when leaving). Only opacity and
 * the independent `translate`/`scale` properties: `transform` anchors the slot.
 */
export function revealFrames(effect: RevealEffect, entering: boolean): Keyframe[] {
  const hidden: Keyframe = { opacity: 0 };
  const shown: Keyframe = { opacity: 1 };
  const from = SLIDE_FROM[effect];
  if (from) {
    hidden.translate = from;
    shown.translate = "0 0";
  } else if (effect === "scale") {
    hidden.scale = "0.92";
    shown.scale = "1";
  }
  return entering ? [hidden, shown] : [shown, hidden];
}

export function revealTiming(
  reveal: Reveal | undefined,
  entering: boolean,
): { duration: number; easing: string; effect: RevealEffect } {
  if (!reveal) {
    return {
      duration: entering ? REVEAL_DEFAULT.durationIn : REVEAL_DEFAULT.durationOut,
      easing: REVEAL_DEFAULT.easing,
      effect: REVEAL_DEFAULT.effect,
    };
  }
  return { duration: reveal.duration, easing: easingToCss(reveal.easing, "ease-out"), effect: reveal.effect };
}
