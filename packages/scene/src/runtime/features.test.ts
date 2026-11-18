/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from "vitest";
import { featuresOf } from "./features.js";

describe("what a document needs", () => {
  it("nothing optional in a plain document", () => {
    expect(featuresOf({ slots: [{ style: { fillType: "color", fillColor: "#fff" } }] })).toEqual({ generative: false, patterns: false });
  });

  it("a 1.x generative fill", () => {
    expect(featuresOf({ slots: [{ style: { fillType: "generative", fillGenerative: { id: "x" } } }] }).generative).toBe(true);
  });

  it("a 2.0 generative paint", () => {
    expect(featuresOf({ document: { layers: [{ fills: [{ kind: "generative" }] }] } }).generative).toBe(true);
  });

  it("a 2.0 pattern paint", () => {
    expect(featuresOf({ document: { layers: [{ fills: [{ kind: "pattern", pattern: {} }] }] } })).toEqual({ generative: false, patterns: true });
  });

  it("a 1.x canvas background pattern", () => {
    expect(featuresOf({ canvas: { backgroundPatternType: "stars" } }).patterns).toBe(true);
  });

  it("a drawing, which the background paints as a tile", () => {
    expect(featuresOf({ document: { layers: [{ drawing: { paths: [] } }] } }).patterns).toBe(true);
  });

  it("an empty pattern field does not count", () => {
    expect(featuresOf({ style: { fillPatternType: undefined, fillPatternColor: null } }).patterns).toBe(false);
  });

  it("survives a cycle", () => {
    const a: any = { b: {} };
    a.b.a = a;
    expect(featuresOf(a)).toEqual({ generative: false, patterns: false });
  });
});
