/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  applyTypewriterText,
  applyGlitchText,
  applyTextHighlight,
  applyDropCap,
} from "./ImageEngine";

function makeWrap(): HTMLElement {
  return document.createElement("div");
}

describe("Typewriter, Glitch, Highlight, and DropCap in ImageEngine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("applyTypewriterText progressively reveals characters with a cursor", () => {
    const wrap = makeWrap();
    const anim = applyTypewriterText(wrap, "Antigravity", 10, 0, true);

    // At t = 0 with the animation active, it starts empty + cursor
    expect(wrap.textContent).toContain("|");

    // Advance 250ms (2-3 characters at 10 cps)
    vi.advanceTimersByTime(250);
    expect(wrap.textContent?.startsWith("An") || wrap.textContent?.startsWith("Ant")).toBe(true);

    anim.stop();
  });

  it("applyGlitchText applies chromatic aberration during the burst and can be stopped", () => {
    const wrap = makeWrap();
    const anim = applyGlitchText(wrap, "Cyberpunk", "glitch-cyberpunk", 1.0, 0, 70);

    // Portable glitch: no text-shadow;
    // the text plus two colour ghosts (aria-hidden), faded in during a burst.
    const ghosts = [...wrap.querySelectorAll('[aria-hidden="true"]')] as HTMLElement[];
    expect(ghosts).toHaveLength(2);
    expect(wrap.querySelector('span:not([aria-hidden])')?.textContent).toBe("Cyberpunk");

    // Advance to the burst window (>= 700ms in a 1s cycle)
    vi.advanceTimersByTime(800);
    expect(wrap.style.display).toBe("inline-block");
    expect(ghosts.map((g) => g.style.opacity)).toEqual(["0.85", "0.85"]);
    expect(wrap.style.textShadow).toBe("");

    anim.stop();
    expect(ghosts.map((g) => g.style.opacity)).toEqual(["0", "0"]);
  });

  it("applyGlitchText slice: one band over the text, cut by a rectangle and shifted in a burst", () => {
    const wrap = makeWrap();
    const anim = applyGlitchText(wrap, "Slice", "glitch-slice", 1.0, 0, 100);
    const bands = [...wrap.querySelectorAll('[aria-hidden="true"]')] as HTMLElement[];
    expect(bands).toHaveLength(1);
    vi.advanceTimersByTime(800);
    expect(bands[0].style.opacity).toBe("1");
    expect(bands[0].style.clipPath).toMatch(/^inset\(/);
    anim.stop();
  });

  it("applyTextHighlight applies wrapping styles for a marker, pill or thick underline", () => {
    const wrap = makeWrap();
    applyTextHighlight(wrap, {
      enabled: true,
      color: "rgba(245, 158, 11, 0.4)",
      style: "pill",
      paddingX: 8,
      paddingY: 3,
    });

    expect(wrap.style.borderRadius).toBe("9999px");
    expect(wrap.style.backgroundColor).toBe("rgba(245, 158, 11, 0.4)");
  });

  it("applyDropCap creates a floating span for the first letter across the specified lines", () => {
    const wrap = makeWrap();
    applyDropCap(wrap, "Había una vez", {
      enabled: true,
      lines: 2,
      color: "#f59e0b",
    });

    const dropSpan = wrap.querySelector("span");
    expect(dropSpan).not.toBeNull();
    expect(dropSpan?.textContent).toBe("H");
    expect(dropSpan?.style.float).toBe("left");
    expect(["#f59e0b", "rgb(245, 158, 11)"]).toContain(dropSpan?.style.color);
    expect(wrap.textContent).toBe("Había una vez");
  });

  it("applyDropCap sizes the letter with the shared dropCapStyle (3 lines = 3.2em, given gap)", () => {
    const wrap = makeWrap();
    applyDropCap(wrap, "Érase", { enabled: true, lines: 3, marginRight: 4 });
    const s = wrap.querySelector("span")!;
    expect(s.style.fontSize).toBe("3.2em");
    expect(s.style.marginRight).toBe("4px");
    expect(s.style.lineHeight).toBe("0.85");
  });

  it("applyDropCap keeps the marks of the rest of the text", () => {
    const wrap = makeWrap();
    applyDropCap(wrap, "Te irás. {m1}No te llevarás{/m1} nada", { enabled: true, lines: 2 }, { m1: { highlight: { color: "#d9f99d" } } });
    expect(wrap.firstElementChild?.textContent).toBe("T");
    const marked = wrap.querySelector('[data-mark="m1"]') as HTMLElement;
    expect(marked?.textContent).toBe("No te llevarás");
    expect(wrap.textContent).toBe("Te irás. No te llevarás nada");
  });
});
