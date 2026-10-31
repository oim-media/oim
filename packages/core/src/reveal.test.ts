/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { revealFrames, revealTiming, easingToCss } from "./reveal";

describe("reveal", () => {
  it("builds frames per effect, never touching transform", () => {
    expect(revealFrames("fade", true)).toEqual([{ opacity: 0 }, { opacity: 1 }]);
    expect(revealFrames("slide-up", true)).toEqual([{ opacity: 0, translate: "0 4cqw" }, { opacity: 1, translate: "0 0" }]);
    expect(revealFrames("slide-down", true)[0].translate).toBe("0 -4cqw");
    expect(revealFrames("slide-left", true)[0].translate).toBe("4cqw 0");
    expect(revealFrames("slide-right", true)[0].translate).toBe("-4cqw 0");
    expect(revealFrames("scale", true)).toEqual([{ opacity: 0, scale: "0.92" }, { opacity: 1, scale: "1" }]);
    expect(revealFrames("slide-up", false)).toEqual([...revealFrames("slide-up", true)].reverse());
    for (const e of ["fade", "slide-up", "slide-down", "slide-left", "slide-right", "scale"] as const)
      for (const f of revealFrames(e, true)) expect(Object.keys(f)).not.toContain("transform");
  });

  it("times the default and an explicit reveal", () => {
    expect(revealTiming(undefined, true)).toEqual({ duration: 300, easing: "ease", effect: "fade" });
    expect(revealTiming(undefined, false).duration).toBe(250);
    expect(revealTiming({ effect: "scale", duration: 500 }, false)).toEqual({ duration: 500, easing: "ease-out", effect: "scale" });
  });

  it("turns an easing into CSS", () => {
    expect(easingToCss([0.22, 1, 0.36, 1], "ease")).toBe("cubic-bezier(0.22,1,0.36,1)");
    expect(easingToCss("ease-in", "ease")).toBe("ease-in");
    expect(easingToCss(undefined, "linear")).toBe("linear");
  });
});
