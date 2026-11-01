/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `style.marks` in the contract (1.11.0) and the one resolved style every
 * renderer paints. Spec: docs/superpowers/specs/2026-10-10-text-marks-design.md
 */

import { describe, it, expect } from "vitest";
import { styleSchema, textMarkSchema } from "./schema";
import { CONTRACT_VERSION } from "./compatibility";
import { markStyle } from "./text-marks";

const ok = (marks: unknown) => styleSchema.safeParse({ marks }).success;

describe("style.marks", () => {
  it("a full mark is valid", () => {
    expect(ok({ hl: { color: "#5a7d1f", colorRole: "accent", bold: true, italic: false, underline: true,
      highlight: { style: "marker", color: "rgba(217,249,157,.6)", colorRole: "accent", paddingX: 2, borderRadius: 3 } } })).toBe(true);
  });

  it("names follow MARK_NAME", () => {
    expect(ok({ Hl: { bold: true } })).toBe(false);
    expect(ok({ "1a": { bold: true } })).toBe(false);
  });

  it("at most 8 marks", () => {
    const nine = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`m${i}`, { bold: true }]));
    expect(ok(nine)).toBe(false);
    const eight = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`m${i}`, { bold: true }]));
    expect(ok(eight)).toBe(true);
  });

  it("no free CSS: unsafe colours are rejected, unknown keys never reach the style", () => {
    // The contract never forbids unknown keys (contract.test.ts): a newer file
    // must still parse. What keeps CSS out is that renderers only paint what
    // markStyle resolves.
    expect(markStyle({ css: "color:red" } as any)).toEqual({ underline: false });
    expect(textMarkSchema.safeParse({ color: "url(https://x)" }).success).toBe(false);
    expect(textMarkSchema.safeParse({ highlight: { style: "glow" } }).success).toBe(false);
  });
});

describe("markStyle", () => {
  it("resolves role and colour like every other colour of the .oim", () => {
    const s = markStyle({ color: "#5a7d1f", colorRole: "accent", bold: true, italic: true, underline: true });
    expect(s.color).toBe("var(--oim-color-accent, var(--oim-palette-accent, #5a7d1f))");
    expect(s.fontWeight).toBe(700);
    expect(s.fontStyle).toBe("italic");
    expect(s.underline).toBe(true);
  });

  it("a fixed colour alone", () => {
    expect(markStyle({ color: "#112233" }).color).toBe("#112233");
  });

  it("highlight gets the same defaults as textHighlight in the player", () => {
    const s = markStyle({ highlight: { color: "#ffee00" } } as any);
    expect(s.highlight).toEqual({ style: "marker", color: "#ffee00", paddingX: 4, paddingY: 2, borderRadius: 3 });
  });

  it("nothing set, nothing styled", () => {
    expect(markStyle({})).toEqual({ underline: false });
  });
});

describe("contract version", () => {
  // Changed when 1.12.0 came (10 Oct 2026): marks need 1.11.0 or later.
  it("is 1.11.0 or later", () => {
    const [maj, min] = CONTRACT_VERSION.split(".").map(Number);
    expect(maj > 1 || (maj === 1 && min >= 11)).toBe(true);
  });
});
