/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The drop cap's style, one function for the three renderers (editor canvas,
 * player, static export).
 */
import { describe, it, expect } from "vitest";
import { dropCapStyle, splitDropCap } from "./drop-cap.js";

describe("dropCapStyle", () => {
  it("two lines by default: 2.2 times the size, tight line, 8 px gap, bold", () => {
    expect(dropCapStyle({ enabled: true, lines: 2 })).toEqual({ scale: 2.2, lineHeight: 0.85, marginRight: 8, fontWeight: 700 });
  });

  it("three lines: 3.2 times the size", () => {
    expect(dropCapStyle({ enabled: true, lines: 3 }).scale).toBe(3.2);
  });

  it("keeps the margin, colour and family when given", () => {
    expect(dropCapStyle({ enabled: true, lines: 2, marginRight: 0, color: "#ff0000", fontFamily: "Lora" }))
      .toEqual({ scale: 2.2, lineHeight: 0.85, marginRight: 0, fontWeight: 700, color: "#ff0000", fontFamily: "Lora" });
  });
});

describe("splitDropCap", () => {
  it("keeps the marks of the rest of the text", () => {
    expect(splitDropCap("Te irás. {m1}No te llevarás{/m1} nada", ["m1"])).toEqual({ letter: "T", rest: "e irás. {m1}No te llevarás{/m1} nada" });
  });

  it("a mark that starts on the first letter keeps the rest of its phrase", () => {
    expect(splitDropCap("{m1}Hola{/m1} mundo", ["m1"])).toEqual({ letter: "H", rest: "{m1}ola{/m1} mundo" });
  });

  it("a mark that was only the first letter disappears from the rest", () => {
    expect(splitDropCap("{m1}H{/m1}ola", ["m1"])).toEqual({ letter: "H", rest: "ola" });
  });

  it("escaped braces stay escaped; an empty text has no letter", () => {
    expect(splitDropCap("A {{x}}", [])).toEqual({ letter: "A", rest: " {{x}}" });
    expect(splitDropCap("", [])).toEqual({ letter: "", rest: "" });
  });
});
