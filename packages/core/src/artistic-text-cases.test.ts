/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// The cases live in packages/spec/artistic-text-cases.json so every player (web,
// Flutter) curves, stacks and extrudes artistic text the same way.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { artisticTextLines, calculateTextCurvePath, type TextCurveType } from "./artisticTextCurve.js";
import { calculate3DExtrusionLayers, shadeHexColor } from "./artisticTextExtrusion.js";

const CASES = JSON.parse(readFileSync(join(__dirname, "..", "..", "spec", "artistic-text-cases.json"), "utf8"));

describe("artistic text shared cases", () => {
  it("curve paths", () => {
    for (const c of CASES.curve) expect(calculateTextCurvePath(c.width, c.height, c.curveAmount, c.curveType as TextCurveType)).toBe(c.d);
  });
  it("lines", () => {
    for (const c of CASES.lines) expect(artisticTextLines(c.text, c.fontSize, c.lineHeight)).toEqual(c.lines);
  });
  it("extrusion layers", () => {
    for (const c of CASES.extrusion) expect(calculate3DExtrusionLayers(c.depth, c.angle, c.color, c.shading)).toEqual(c.layers);
  });
  it("shade", () => {
    for (const c of CASES.shade) expect(shadeHexColor(c.color, c.percent)).toBe(c.result);
  });
});
