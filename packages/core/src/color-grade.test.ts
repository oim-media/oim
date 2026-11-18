/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it } from "vitest";
import { COLOR_GRADE_PRESETS, colorGradeMatrix } from "./color-grade.js";

/** An sRGB colour (0–1) through a 4×5 matrix, as feColorMatrix applies it. */
const apply = (m: number[], [r, g, b]: number[]) =>
  [0, 1, 2].map((row) => +(m[row * 5] * r + m[row * 5 + 1] * g + m[row * 5 + 2] * b + m[row * 5 + 4]).toFixed(3));

const GREY = [0.5, 0.5, 0.5];
const SKIN = [0.87, 0.67, 0.55];
const SKY = [0.4, 0.6, 0.85];

describe("colorGradeMatrix", () => {
  it("has the eight presets of the spec", () => {
    expect(COLOR_GRADE_PRESETS).toEqual(["warm-vintage", "cool-cinema", "cyberpunk", "monochrome-contrast", "teal-orange", "bleach-bypass", "cross-process", "sepia"]);
  });

  it("sepia is the W3C sepia(1) matrix", () => {
    expect(colorGradeMatrix("sepia")).toEqual([0.393, 0.769, 0.189, 0, 0, 0.349, 0.686, 0.168, 0, 0, 0.272, 0.534, 0.131, 0, 0, 0, 0, 0, 1, 0]);
  });

  it("intensity 0 is the identity and 50 is halfway", () => {
    expect(colorGradeMatrix("cyberpunk", 0)).toEqual([1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0]);
    expect(colorGradeMatrix("sepia", 50)![0]).toBeCloseTo((1 + 0.393) / 2, 6);
  });

  it("an unknown preset paints nothing", () => {
    expect(colorGradeMatrix("toString")).toBeUndefined();
    expect(colorGradeMatrix("nope")).toBeUndefined();
  });

  it("monochrome-contrast keeps mid grey and greys the sky", () => {
    const m = colorGradeMatrix("monochrome-contrast")!;
    expect(apply(m, GREY)).toEqual([0.5, 0.5, 0.5]);
    const [r, g, b] = apply(m, SKY);
    expect(r).toBe(g);
    expect(g).toBe(b);
  });

  it("each preset moves skin and sky the way its name says", () => {
    const warm = apply(colorGradeMatrix("warm-vintage")!, SKY);
    expect(warm[0] - warm[2]).toBeGreaterThan(SKY[0] - SKY[2]);
    const cool = apply(colorGradeMatrix("cool-cinema")!, SKIN);
    expect(cool[2] - cool[0]).toBeGreaterThan(SKIN[2] - SKIN[0]);
    const teal = apply(colorGradeMatrix("teal-orange")!, SKIN);
    expect(teal[0] - teal[2]).toBeGreaterThan(SKIN[0] - SKIN[2]);
    const bleach = apply(colorGradeMatrix("bleach-bypass")!, SKY);
    expect(Math.max(...bleach) - Math.min(...bleach)).toBeLessThan(Math.max(...SKY) - Math.min(...SKY));
    expect(colorGradeMatrix("cross-process")![14]).toBeCloseTo(0.1 * 1.15 + 0.5 - 0.5 * 1.15, 6);
  });
});
