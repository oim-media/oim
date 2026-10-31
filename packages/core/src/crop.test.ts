/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect } from "vitest";
import { cropPlacement, cropCss } from "./crop.js";
import { styleSchema } from "./schema.js";

const frame = { width: 300, height: 200 };
const image = { width: 1000, height: 400 };

describe("image crop (contract 1.15.0)", () => {
  it("cropPlacement and cropCss frame the same point", () => {
    const c = { x: 20, y: 70, zoom: 2 };
    const p = cropPlacement(frame, image, c);
    // CSS semantics: the image point at x%,y% lands on the frame point at x%,y%.
    expect(p.dx + p.dw * 0.2).toBeCloseTo(frame.width * 0.2);
    expect(p.dy + p.dh * 0.7).toBeCloseTo(frame.height * 0.7);
    expect(p.dw).toBeCloseTo(1000 * Math.max(300 / 1000, 200 / 400) * 2);
    expect(cropCss(c)).toEqual({ objectFit: "cover", objectPosition: "20% 70%", transform: "scale(2)", transformOrigin: "20% 70%" });
  });

  it("zoom 1 at 50/50 is a centred cover", () => {
    expect(cropPlacement(frame, image, { x: 50, y: 50, zoom: 1 })).toEqual({ dx: (300 - 500) / 2, dy: 0, dw: 500, dh: 200 });
  });

  it("the schema bounds the crop", () => {
    expect(styleSchema.safeParse({ imageCrop: { x: 20, y: 70, zoom: 2 } }).success).toBe(true);
    expect(styleSchema.safeParse({ imageCrop: { x: 20, y: 70, zoom: 0.5 } }).success).toBe(false);
    expect(styleSchema.safeParse({ imageCrop: { x: 120, y: 0, zoom: 1 } }).success).toBe(false);
  });
});
