/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The player paints text marks (contract 1.11.0) with the one interpretation
 * in @oim-media/core, and never shows a tag.
 */

import { describe, it, expect, vi } from "vitest";
import ImageEngine from "./ImageEngine";
import { renderMarkedText } from "../render/marked-text";
import { PLAYER_CAPABILITIES } from "../../../core/src/compatibility.js";

const MARKS = {
  hl: { color: "#5a7d1f", bold: true, highlight: { style: "marker" as const, color: "#d9f99d" } },
  u: { italic: true, underline: true },
};

describe("renderMarkedText", () => {
  it("one span per marked phrase, styled by markStyle, no tags", () => {
    const el = document.createElement("div");
    renderMarkedText(el, "a {hl}b{/hl} c {u}d{/u}", MARKS);
    const spans = el.querySelectorAll("span[data-mark]");
    expect(spans.length).toBe(2);
    const hl = spans[0] as HTMLElement;
    expect(hl.dataset.mark).toBe("hl");
    expect(hl.style.color).toBe("#5a7d1f");
    expect(hl.style.fontWeight).toBe("700");
    expect(hl.style.backgroundColor).toBeTruthy();
    expect((spans[1] as HTMLElement).style.fontStyle).toBe("italic");
    expect((spans[1] as HTMLElement).style.textDecorationLine || (spans[1] as HTMLElement).style.textDecoration).toContain("underline");
    expect(el.textContent).toBe("a b c d");
  });

  it("a text without marks is one text node, as before", () => {
    const el = document.createElement("div");
    renderMarkedText(el, "plain {{braces}}", undefined);
    expect(el.childNodes.length).toBe(1);
    expect(el.textContent).toBe("plain {braces}");
  });

  it("the highlight follows the text line by line", () => {
    const el = document.createElement("div");
    renderMarkedText(el, "{hl}x{/hl}", MARKS);
    const s = (el.querySelector("span") as HTMLElement).style as any;
    expect(s.boxDecorationBreak || s.webkitBoxDecorationBreak).toBe("clone");
  });
});

describe("the player declares text_marks", () => {
  it("is in PLAYER_CAPABILITIES", () => {
    expect(PLAYER_CAPABILITIES).toContain("text_marks");
  });
});

function mount(slot: any, lang = "es") {
  const host = document.createElement("div");
  host.setAttribute("mode", "full");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const motor: any = new ImageEngine(host as any);
  motor._viewport = document.createElement("div");
  shadow.appendChild(motor._viewport);
  motor._overlay = document.createElement("div");
  motor._viewport.appendChild(motor._overlay);
  motor.lang = lang;
  motor.metadata = { width: 800, height: 600, slots: [{ id: "t", type: "text", align: "center", position: [10, 10], ...slot }] };
  return { motor, shadow };
}

describe("ImageEngine with marks", () => {
  it("paints the marks of the active language", async () => {
    const { motor, shadow } = mount({ content: { es: "a {hl}b{/hl}" }, style: { marks: MARKS } });
    await motor.renderSlots();
    expect(shadow.querySelector('span[data-mark="hl"]')).not.toBeNull();
    expect(shadow.textContent).not.toContain("{");
  });

  it("a language that falls back paints the fallback's marks", async () => {
    const { motor, shadow } = mount({ content: { es: "a {hl}b{/hl}" }, style: { marks: MARKS } }, "de");
    await motor.renderSlots();
    expect(shadow.querySelector('span[data-mark="hl"]')).not.toBeNull();
    expect(shadow.textContent).not.toContain("{hl}");
  });

  it.each(["typewriter", "glitch-cyberpunk", "wave-chars"])("%s animates the plain text, no tags", async (type) => {
    // The typewriter writes nothing at t = 0: let time pass before looking.
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
    try {
      const { motor, shadow } = mount({ content: { es: "a {hl}b{/hl} {{x}}" }, style: { marks: MARKS, textAnimationType: type, textAnimationSpeed: 1000 } });
      await motor.renderSlots();
      vi.advanceTimersByTime(2000);
      // The wave writes spaces as no-break spaces.
      expect((shadow.textContent ?? "").replace(/ /g, " ")).toContain("a b");
      expect(shadow.textContent).not.toContain("{hl}");
      expect(shadow.textContent).not.toContain("{{");
    } finally {
      vi.useRealTimers();
    }
  });

  it("a drop cap uses the plain text", async () => {
    const { motor, shadow } = mount({ content: { es: "{hl}Hola{/hl}" }, style: { marks: MARKS, dropCap: { enabled: true } } });
    await motor.renderSlots();
    expect(shadow.textContent).not.toContain("{");
  });
});
