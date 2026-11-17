/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { styleSchema, slotSchema } from "./schema.js";
import { FRAME_SHAPES } from "./geoShapes.js";

describe("maskShape takes every frame shape", () => {
  it.each(FRAME_SHAPES)("accepts %s", (shape) => {
    expect(styleSchema.safeParse({ maskShape: shape }).success).toBe(true);
  });

  it.each(["circle", "rectangle", "triangle", "star", "line", "arrow", "diamond", "hexagon", "heart", "blob", "custom"])(
    "still accepts the 1.x shape %s",
    (shape) => {
      expect(styleSchema.safeParse({ maskShape: shape }).success).toBe(true);
    },
  );

  it("rejects a name that is not a shape", () => {
    expect(styleSchema.safeParse({ maskShape: "nope" }).success).toBe(false);
  });
});

// The filter's frame-shape rule (no line or scribble) is enforced by filterClipPath,
// not here: a cross-field check on slotSchema rewrites the whole contract JSON.
describe("geoShape on a filter slot", () => {
  it("accepts a frame shape", () => {
    expect(slotSchema.safeParse({ id: "f1", type: "filter", style: { geoShape: "star" } }).success).toBe(true);
  });

  it("rejects a name that is not a shape", () => {
    expect(slotSchema.safeParse({ id: "f1", type: "filter", style: { geoShape: "nope" } }).success).toBe(false);
  });
});
