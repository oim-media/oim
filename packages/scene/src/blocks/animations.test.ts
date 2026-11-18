/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from "vitest";
import { revealFrames } from "../../../core/src/reveal.js";
import { animationFrames, animationTiming, canAnimate, trackFrames } from "./animations.js";

const px = (n: number) => `${n}px`;

describe("trackFrames", () => {
  it("one frame per keyframe time, the tracks merged, the value in between interpolated", () => {
    const frames = trackFrames([
      { property: "scale", keyframes: [{ t: 0, v: 1 }, { t: 0.5, v: 1.2, e: "ease-out" }, { t: 1, v: 1 }] },
      { property: "opacity", keyframes: [{ t: 0, v: 0 }, { t: 1, v: 1 }] },
    ], px);
    expect(frames).toEqual([
      { offset: 0, scale: "1", opacity: 0 },
      { offset: 0.5, scale: "1.2", opacity: 0.5, easing: "ease-out" },
      { offset: 1, scale: "1", opacity: 1 },
    ]);
  });

  it("x and y travel together as translate, rotation as rotate, in the scene's lengths", () => {
    const [frame] = trackFrames([
      { property: "x", keyframes: [{ t: 0, v: 10 }, { t: 1, v: 0 }] },
      { property: "rotation", keyframes: [{ t: 0, v: 3 }, { t: 1, v: 0 }] },
    ], px);
    expect(frame).toEqual({ offset: 0, translate: "10px 0px", rotate: "3deg" });
  });
});

describe("animations", () => {
  it("a reveal preset is the core's reveal, so show and hide move as in the player", () => {
    expect(animationFrames({ on: "enter", preset: "slide-up", duration: 400 }, px)).toEqual(revealFrames("slide-up", true));
  });

  it("scene runs tracks and reveals; a named loop is not run yet", () => {
    expect(canAnimate({ on: "enter", preset: "slide-up", duration: 400 })).toBe(true);
    expect(canAnimate({ on: "loop", preset: "pulse", duration: 0 })).toBe(false);
  });

  it("a loop repeats forever; anything else runs once, its delay and easing kept", () => {
    expect(animationTiming({ on: "loop", tracks: [{ property: "opacity", keyframes: [{ t: 0, v: 0 }, { t: 1, v: 1 }] }], duration: 1000 }).iterations).toBe(Infinity);
    expect(animationTiming({ on: "enter", preset: "fade", duration: 300, delay: 50, easing: [0.22, 1, 0.36, 1] })).toEqual({ duration: 300, delay: 50, easing: "cubic-bezier(0.22,1,0.36,1)", fill: "both", iterations: 1 });
  });
});
