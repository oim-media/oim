/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from "vitest";
import { BLOCKS, LAYER_BLOCKS, LAYER_TYPES, admits } from "./layer-blocks.js";

describe("which block each layer type admits", () => {
  it("matches the table of the 2.0 design, row by row", () => {
    const table: Record<string, string> = {
      fills: "text shape",
      strokes: "text shape image",
      effects: "text shape image lottie group",
      animations: "text shape image lottie group",
      motion: "text shape image lottie group",
      mask: "text shape image",
      geometry: "shape",
      corners: "shape image",
      text: "text",
      image: "image",
      a11y: "shape image",
      interaction: "text shape image group",
      children: "group",
    };
    for (const block of BLOCKS) {
      const expected = table[block].split(" ").sort();
      const actual = LAYER_TYPES.filter((t) => admits(t, block)).sort();
      expect(actual, block).toEqual(expected);
    }
  });

  it("every type is listed and no block is admitted by nobody", () => {
    expect(Object.keys(LAYER_BLOCKS).sort()).toEqual([...LAYER_TYPES].sort());
    for (const block of BLOCKS) {
      expect(LAYER_TYPES.some((t) => admits(t, block)), block).toBe(true);
    }
  });
});
