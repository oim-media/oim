/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { applyWaveText } from "./ImageEngine";
import { WAVE_KEYFRAMES_NAME, WAVE_PERIOD_SECONDS } from "../render/waveText";

function makeWrap(): HTMLElement {
  return document.createElement("div");
}

describe("applyWaveText", () => {
  it("creates one span per character", () => {
    const wrap = makeWrap();
    applyWaveText(wrap, "abc", 0.05, 0);
    const spans = wrap.querySelectorAll("span");
    expect(spans).toHaveLength(3);
    expect(Array.from(spans).map((s) => s.textContent)).toEqual(["a", "b", "c"]);
  });

  it("gives every span the shared wave animation at one period", () => {
    const wrap = makeWrap();
    applyWaveText(wrap, "ab", 0.05, 0);
    const spans = wrap.querySelectorAll("span");
    for (const s of Array.from(spans)) {
      expect((s as HTMLElement).style.animationName).toBe(WAVE_KEYFRAMES_NAME);
      expect((s as HTMLElement).style.animationIterationCount).toBe("infinite");
      expect((s as HTMLElement).style.animationTimingFunction).toBe("linear");
      expect(parseFloat((s as HTMLElement).style.animationDuration)).toBeCloseTo(WAVE_PERIOD_SECONDS, 3);
    }
  });

  it("staggers the animation-delay by character index", () => {
    const wrap = makeWrap();
    applyWaveText(wrap, "abc", 0.05, 0);
    const delays = Array.from(wrap.querySelectorAll("span")).map((s) =>
      parseFloat((s as HTMLElement).style.animationDelay)
    );
    // Retraso de idx*speed expresado como adelanto de periodo - idx*speed
    // (period = 2π/6 = 1.0471975511965976); a positive delay would freeze it.
    expect(delays[0]).toBeCloseTo(0, 6);
    expect(delays[1]).toBeCloseTo(-0.9971975511965976, 6);
    expect(delays[2]).toBeCloseTo(-0.9471975511965976, 6);
  });

  it("shifts every character by the global delay", () => {
    const wrap = makeWrap();
    applyWaveText(wrap, "ab", 0.05, 1);
    const delays = Array.from(wrap.querySelectorAll("span")).map((s) =>
      parseFloat((s as HTMLElement).style.animationDelay)
    );
    expect(delays[0]).toBeCloseTo(1, 6);
    expect(delays[1]).toBeCloseTo(0.0028024488034024, 6);
  });

  it("renders newlines as line breaks, not as animated spans", () => {
    const wrap = makeWrap();
    applyWaveText(wrap, "a\nb", 0.05, 0);
    expect(wrap.querySelectorAll("br")).toHaveLength(1);
    expect(wrap.querySelectorAll("span")).toHaveLength(2);
  });

  it("keeps spaces visible by using a non-breaking space", () => {
    const wrap = makeWrap();
    applyWaveText(wrap, "a b", 0.05, 0);
    const spans = Array.from(wrap.querySelectorAll("span"));
    expect(spans[1].textContent).toBe("\u00A0");
  });

  it("replaces any previous content instead of appending to it", () => {
    const wrap = makeWrap();
    wrap.textContent = "stale";
    applyWaveText(wrap, "ab", 0.05, 0);
    expect(wrap.textContent).toBe("ab");
    expect(wrap.querySelectorAll("span")).toHaveLength(2);
  });

  it("handles an empty string without creating spans", () => {
    const wrap = makeWrap();
    applyWaveText(wrap, "", 0.05, 0);
    expect(wrap.querySelectorAll("span")).toHaveLength(0);
  });
});
