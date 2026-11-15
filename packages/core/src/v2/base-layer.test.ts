/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from "vitest";
import { hasBaseLayer } from "./base-layer.js";
import type { Layer } from "./schema.js";

const box = { x: 0, y: 0, width: 10, height: 10 };
const image = (id: string, src: unknown): Layer => ({ id, type: "image", box, image: { src } }) as Layer;
const group = (id: string, children: Layer[]): Layer => ({ id, type: "group", box, children }) as Layer;

describe("hasBaseLayer", () => {
  it("is true for a top-level image layer that shows the base picture", () => {
    expect(hasBaseLayer({ layers: [image("a", "oim:base")] })).toBe(true);
  });

  it("is true when the base picture is nested inside a group", () => {
    expect(hasBaseLayer({ layers: [group("g", [image("a", "https://x.test/a.png"), image("b", "oim:base")])] })).toBe(true);
  });

  it("is true when only one language shows the base picture", () => {
    expect(hasBaseLayer({ layers: [image("a", { value: "https://x.test/a.png", modes: { es: "oim:base" } })] })).toBe(true);
  });

  it("is false for a document whose images are all their own pictures, or with no image layer", () => {
    expect(hasBaseLayer({ layers: [image("a", "https://x.test/a.png"), group("g", [image("b", { value: "x", modes: {} })])] })).toBe(false);
    expect(hasBaseLayer({ layers: [{ id: "t", type: "text", box } as Layer] })).toBe(false);
    expect(hasBaseLayer({ layers: [] })).toBe(false);
  });
});

describe("hasBaseLayer through a ref", () => {
  it("reads a ref through the image resource it names", () => {
    expect(hasBaseLayer({ resources: { r: { kind: "image", src: "oim:base" } }, layers: [image("a", { ref: "r" })] } as never)).toBe(true);
    expect(hasBaseLayer({ resources: { r: { kind: "image", src: "https://x.test/a.png" } }, layers: [image("a", { ref: "r" })] } as never)).toBe(false);
    expect(hasBaseLayer({ resources: { r: { kind: "color", value: "#000" } }, layers: [image("a", { ref: "r" })] } as never)).toBe(false);
  });
});
