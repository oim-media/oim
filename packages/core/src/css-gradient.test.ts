/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { isSafeCssGradient } from "./css-gradient";
import { getFillCss } from "./fill";

// What the OIM editor's gradient serializer actually writes, plus the
// shapes the player's own tests and older files use.
const FROM_EDITOR = [
  "linear-gradient(135deg, #f59e0b 0%, #7c3aed 100%)",
  "linear-gradient(90deg, #3B82F6 0%, #9333EA 100%)",
  "radial-gradient(circle 40px at 50% 50%, #000 0%, #fff 100%)",
  "radial-gradient(circle closest-side at 30% 70%, rgba(0, 0, 0, 0.5) 0%, transparent 100%)",
  "conic-gradient(from 45deg at 50% 50%, #ff0000 0%, #00ff00 50%, #0000ff 100%)",
  "linear-gradient(to right, #000, #fff)",
  "linear-gradient(90deg, red, blue)",
  "linear-gradient(90deg, var(--oim-color-accent, #f59e0b) 0%, #000 100%)",
  "repeating-linear-gradient(45deg, #000 0px, #000 10px, #fff 10px, #fff 20px)",
];

const ATTACKS = [
  // A second image in the list: CSSOM accepts it and the browser fetches it.
  "linear-gradient(red, blue), url(https://tercero.example/baliza)",
  "url(https://tercero.example/baliza)",
  "linear-gradient(red, blue); background: url(https://tercero.example/b)",
  "linear-gradient(red, url(https://tercero.example/b))",
  "linear-gradient(90deg, image-set(\"https://tercero.example/b\" 1x) 0%, #000 100%)",
  "linear-gradient(90deg, #000 0%, #fff 100%) /* x */",
  "linear-gradient(90deg, var(--x, url(https://tercero.example/b)) 0%, #000 100%)",
  "linear-gradient(90deg, #000 0%, #fff 100%",
  "element(#secreto)",
  "",
];

describe("gradients in a .oim: allowlist", () => {
  it.each(FROM_EDITOR)("accepts what the editor writes: %s", (g) => {
    expect(isSafeCssGradient(g)).toBe(true);
  });

  it.each(ATTACKS)("rejects: %s", (g) => {
    expect(isSafeCssGradient(g)).toBe(false);
  });

  it("rejects what is not a string", () => {
    expect(isSafeCssGradient(undefined)).toBe(false);
    expect(isSafeCssGradient({ toString: () => "linear-gradient(red, blue)" })).toBe(false);
  });
});

describe("getFillCss does not let through a gradient that requests resources", () => {
  it("a url() inside fillGradient never reaches the style", () => {
    // Until recently this went straight to `style.backgroundImage`, and
    // CSSOM accepts an image list: opening a crafted file pinged a third party.
    const css = getFillCss({
      width: 10, height: 10, fillType: "gradient",
      fillGradient: "linear-gradient(red, blue), url(https://tercero.example/baliza)",
    });
    expect(JSON.stringify(css)).not.toContain("url(");
    expect(css).not.toHaveProperty("backgroundImage");
  });

  it("a legitimate gradient still paints the same", () => {
    const g = "linear-gradient(135deg, #f59e0b 0%, #7c3aed 100%)";
    expect(getFillCss({ width: 10, height: 10, fillType: "gradient", fillGradient: g }))
      .toEqual({ backgroundImage: g });
  });
});
