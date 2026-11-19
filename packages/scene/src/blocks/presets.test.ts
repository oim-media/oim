/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from "vitest";
import { applyEntrance, entranceFrames, presetFrames, presetSeconds } from "./presets.js";

describe("named presets", () => {
  it("a pulse loop shrinks and dims at its middle and rests at scale 1", () => {
    const f = presetFrames("loop", "pulse")!;
    expect(f[0]).toEqual({ transform: "scale(1)", opacity: "1" });
    expect(f[1]).toEqual({ transform: "scale(0.95)", opacity: "0.8" });
    expect(presetFrames("loop", "glow")![1]).toEqual({ textShadow: "0 0 16px rgba(245, 158, 11, 0.8)" });
    expect(presetSeconds("pulse")).toBe(2);
  });

  it("a grow hover ends at scale 1.08", () => {
    expect(presetFrames("hover", "grow")!.at(-1)).toMatchObject({ transform: "scale(1.08)" });
  });

  it("an unknown name has no frames", () => {
    expect(presetFrames("loop", "wobble")).toBeUndefined();
    expect(presetFrames("hover", "pulse")).toBeUndefined();
  });

  it("a text entrance puts each character in its own span, spaces as text", () => {
    const el = document.createElement("div");
    const runs: number[] = [];
    applyEntrance(el, "Ho la", "fade-chars", undefined, 0, (_span, start) => void runs.push(start));
    expect(el.textContent).toBe("Ho la");
    expect([...el.querySelectorAll("span")].map((s) => s.textContent)).toEqual(["H", "o", "l", "a"]);
    expect(runs).toHaveLength(4);
    expect(runs[1]).toBeGreaterThan(runs[0]);
    expect(entranceFrames("fade-chars").at(-1)).toMatchObject({ opacity: 1 });
  });

  it("a mask reveal rises each unit inside a clip of its own box", () => {
    const el = document.createElement("div");
    applyEntrance(el, "Ho la", "reveal-mask", undefined, 0, () => undefined);
    const clips = [...el.children] as HTMLElement[];
    expect(clips.length).toBeGreaterThan(0);
    for (const clip of clips) expect(clip.style.overflow).toBe("hidden");
  });
});
