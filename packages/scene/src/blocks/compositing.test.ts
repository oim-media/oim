/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from "vitest";
import { applyCompositing } from "./compositing.js";

const paint = (layer: { opacity?: number; blend?: string }) => {
  const el = document.createElement("div");
  applyCompositing(el, layer as never);
  return el;
};

describe("applyCompositing", () => {
  it("a layer's opacity reaches the element", () => {
    expect(paint({ opacity: 0.5 }).style.opacity).toBe("0.5");
  });
  it("a layer's blend mode blends with what is under it", () => {
    expect(paint({ blend: "multiply" }).style.mixBlendMode).toBe("multiply");
  });
  it("a layer with neither is left untouched, and a repaint clears them", () => {
    const el = paint({ opacity: 0.5, blend: "screen" });
    applyCompositing(el, {} as never);
    expect(el.style.opacity).toBe("");
    expect(el.style.mixBlendMode).toBe("");
  });
});
