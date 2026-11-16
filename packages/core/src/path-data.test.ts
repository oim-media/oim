/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { normalizePathData, transformPathData } from "./path-data";

describe("normalizePathData", () => {
  it("promotes Q to C with the same endpoints", () => {
    const ops = normalizePathData("M0 0 Q 10 10 20 0 Z");
    expect(ops?.[1]).toMatchObject({ cmd: "C" });
    expect(ops?.[1].args.slice(4)).toEqual([20, 0]);
  });

  it("resolves relative commands against the current point", () => {
    expect(normalizePathData("M10 10 l5 0 z")?.[1].args).toEqual([15, 10]);
  });

  it("turns H and V into L with absolute coordinates", () => {
    expect(normalizePathData("M0 0 H10 V5")?.map((o) => o.args)).toEqual([[0, 0], [10, 0], [10, 5]]);
  });

  it("reduces S and T to C", () => {
    expect(normalizePathData("M0 0 C 0 10 10 10 10 0 S 20 -10 20 0")?.[2].cmd).toBe("C");
    expect(normalizePathData("M0 0 Q 10 10 20 0 T 40 0")?.[2].cmd).toBe("C");
  });

  it("rejects garbage instead of guessing", () => {
    expect(normalizePathData("M0 0 X9 9")).toBeNull();
  });
});

describe("transformPathData", () => {
  it("scales Q and relative paths, not only absolute M L C A Z", () => {
    const out = transformPathData("m0 0 q10 10 20 0 z", (x, y) => [x * 2, y * 2]);
    expect(out).not.toBeNull();
    expect(out).not.toMatch(/q/i);
  });
});
