/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { normalizePathData, transformPathData } from "./path-data";

/** Asserts a normalized argument list, tolerating floating-point noise in trig and thirds. */
const near = (actual: number[] | undefined, expected: number[]) => {
  expect(actual).toHaveLength(expected.length);
  actual?.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 9));
};

describe("normalizePathData", () => {
  it("rejects input that does not start with a moveto", () => {
    expect(normalizePathData("L10 10")).toBeNull();
    expect(normalizePathData("l10 10")).toBeNull();
  });

  it("rejects the empty string", () => {
    expect(normalizePathData("")).toBeNull();
    expect(normalizePathData("   ")).toBeNull();
  });

  it("rejects garbage instead of guessing", () => {
    expect(normalizePathData("M0 0 X9 9")).toBeNull();
  });

  it("promotes Q to C with the exact cubic control points", () => {
    const ops = normalizePathData("M0 0 Q 10 10 20 0 Z");
    expect(ops?.[1].cmd).toBe("C");
    // Control points at 2/3 of the quadratic control, endpoints unchanged.
    near(ops?.[1].args, [20 / 3, 20 / 3, 40 / 3, 20 / 3, 20, 0]);
  });

  it("reflects the previous quadratic control point for T", () => {
    // Reflection of (10,10) about (20,0) is (30,-10).
    const ops = normalizePathData("M0 0 Q 10 10 20 0 T 40 0");
    expect(ops?.[2].cmd).toBe("C");
    near(ops?.[2].args, [80 / 3, -20 / 3, 100 / 3, -20 / 3, 40, 0]);
  });

  it("uses the current point as the T control when no quadratic precedes it", () => {
    const ops = normalizePathData("M0 0 L 20 0 T 40 0");
    near(ops?.[2].args, [20, 0, 80 / 3, 0, 40, 0]);
  });

  it("reflects the previous cubic control point for S", () => {
    // Second control (10,10) reflected about current point (10,0) gives (10,-10).
    const ops = normalizePathData("M0 0 C 0 10 10 10 10 0 S 20 -10 20 0");
    expect(ops?.[2].cmd).toBe("C");
    near(ops?.[2].args, [10, -10, 20, -10, 20, 0]);
  });

  it("uses the current point as the S first control when no cubic precedes it", () => {
    const ops = normalizePathData("M0 0 L 10 0 S 20 10 20 0");
    near(ops?.[2].args, [10, 0, 20, 10, 20, 0]);
  });

  it("turns H and V into L with absolute coordinates", () => {
    expect(normalizePathData("M0 0 H10 V5")?.map((o) => o.args)).toEqual([[0, 0], [10, 0], [10, 5]]);
  });

  it("resolves relative commands against the current point", () => {
    expect(normalizePathData("M10 10 l5 0 z")?.[1].args).toEqual([15, 10]);
  });

  it("resolves lowercase c, s, h, v and t against the current point", () => {
    near(normalizePathData("M10 10 c 0 5 5 5 5 0")?.[1].args, [10, 15, 15, 15, 15, 10]);
    near(normalizePathData("M10 10 s 5 5 5 0")?.[1].args, [10, 10, 15, 15, 15, 10]);
    expect(normalizePathData("M0 0 h5 v5")?.map((o) => o.args)).toEqual([[0, 0], [5, 0], [5, 5]]);
    // t after q: control reflected about (20,0) to (30,-10), relative end (40,0).
    const t = normalizePathData("M0 0 q 10 10 20 0 t 20 0");
    near(t?.[2].args, [80 / 3, -20 / 3, 100 / 3, -20 / 3, 40, 0]);
  });

  it("resolves relative commands after Z against the subpath start", () => {
    const ops = normalizePathData("M10 10 L 0 0 Z l 5 0");
    expect(ops?.[3].args).toEqual([15, 10]);
    const moved = normalizePathData("M0 0 L 10 0 Z m5 5 l 1 0");
    expect(moved?.map((o) => o.args)).toEqual([[0, 0], [10, 0], [], [5, 5], [6, 5]]);
  });

  it("reads compact arc flags (no separators) as single digits", () => {
    const compact = normalizePathData("M0 0 a5 5 0 1010 0");
    const spaced = normalizePathData("M0 0 a5 5 0 1 0 10 0");
    expect(compact).not.toBeNull();
    expect(compact).toEqual(spaced);
    // Semicircle from (0,0) to (10,0) with sweep 0 passes through (5,5).
    near(compact?.[1].args.slice(4), [5, 5]);
    near(compact?.[2].args.slice(4), [10, 0]);
  });

  it("treats extra coordinate pairs after M as implicit L, and after m as relative L", () => {
    expect(normalizePathData("M0 0 10 10 20 0")?.map((o) => o.cmd)).toEqual(["M", "L", "L"]);
    expect(normalizePathData("M0 0 10 10 20 0")?.map((o) => o.args)).toEqual([[0, 0], [10, 10], [20, 0]]);
    expect(normalizePathData("m0 0 10 10 20 0")?.map((o) => o.args)).toEqual([[0, 0], [10, 10], [30, 10]]);
  });

  it("repeats implicit cubic segments", () => {
    const ops = normalizePathData("M0 0 C 0 10 10 10 10 0 10 -10 20 -10 20 0");
    expect(ops?.map((o) => o.cmd)).toEqual(["M", "C", "C"]);
    near(ops?.[2].args, [10, -10, 20, -10, 20, 0]);
  });
});

describe("transformPathData", () => {
  it("scales absolute M, L and Z exactly", () => {
    expect(transformPathData("M0 0 L10 0 L10 10 Z", (x, y) => [x * 2, y * 2])).toBe("M0 0L20 0L20 20Z");
  });

  it("scales Q and relative paths to exact rounded coordinates", () => {
    // Cubic control points 6.667 and 13.333 before scaling, rounded to 0.01 after.
    const out = transformPathData("m0 0 q10 10 20 0 z", (x, y) => [x * 2, y * 2]);
    expect(out).toBe("M0 0C13.33 13.33 26.67 13.33 40 0Z");
  });

  it("does not print negative zero", () => {
    expect(transformPathData("M0 0", (x, y) => [-x, y])).toBe("M0 0");
    expect(transformPathData("M5 0", (x, y) => [-x, y])).toBe("M-5 0");
  });

  it("returns null when the input does not normalize", () => {
    expect(transformPathData("L1 1", (x, y) => [x, y])).toBeNull();
  });
});
