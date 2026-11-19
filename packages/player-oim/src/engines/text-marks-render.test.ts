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
import { renderMarkedText } from "../../../scene/src/blocks/marked-text";
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
