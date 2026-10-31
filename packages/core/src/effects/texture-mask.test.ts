/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// A layer's texture goes on the layer's own pixels, not its box.
import { describe, it, expect } from "vitest";
import { layerTextureMask } from "./texture-mask.js";

describe("layerTextureMask", () => {
  it("an SVG layer is masked by its own markup, stretched to the box", () => {
    const m = layerTextureMask({ type: "svg", svg: '<svg viewBox="0 0 10 10"><path d="M0 0h10"/></svg>' })!;
    expect(m.image.startsWith('url("data:image/svg+xml;charset=utf-8,%3Csvg')).toBe(true);
    expect(m.image).not.toContain('"/>'); // the markup is encoded, so it cannot close the url("…")
    expect(m.size).toBe("100% 100%");
  });

  it("an image layer is masked by its picture with the same fit", () => {
    expect(layerTextureMask({ type: "image", image: "data:image/png;base64,AAA", fit: "contain" })).toEqual({ image: 'url("data:image/png;base64,AAA")', size: "contain" });
    expect(layerTextureMask({ type: "image", image: "blob:http://x/1" })!.size).toBe("cover");
    expect(layerTextureMask({ type: "image", image: "blob:http://x/1", fit: "fill" })!.size).toBe("100% 100%");
  });

  it("an image source that could break out of url() gets no mask", () => {
    expect(layerTextureMask({ type: "image", image: 'data:image/png;base64,A")' })).toBeNull();
    expect(layerTextureMask({ type: "image", image: "javascript:alert(1)" })).toBeNull();
    expect(layerTextureMask({ type: "image", image: "http://insecure/x.png" })).toBeNull();
  });

  it("shapes and containers keep the box (it is their silhouette)", () => {
    expect(layerTextureMask({ type: "geo" })).toBeNull();
    expect(layerTextureMask({ type: "container" })).toBeNull();
    expect(layerTextureMask({ type: "svg", svg: "not svg" })).toBeNull();
  });
});
