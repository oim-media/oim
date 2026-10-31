/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { renderIsoGrid } from "./iso-grid.js";
import { renderRadial } from "./radial.js";
import { renderGradient } from "./gradient.js";
import { createRng } from "../rng.js";
import { createDefsRegistry, buildSvgDocument } from "../svg.js";
import { RenderContext } from "../types.js";

function createMockContext(width = 800, height = 600): RenderContext {
  return {
    width,
    height,
    bleed: 1,
    rng: createRng(505),
    defs: createDefsRegistry(),
    ramp: (i, total) => `#${((i + 1) * 15).toString(16).padStart(6, "0")}`
  };
}

describe("Advanced Primitives (radial, gradient, iso-grid)", () => {
  describe("iso-grid (primitives/iso-grid.ts)", () => {
    it("deduplicates linearGradient definitions in DefsRegistry for multi-cell grids", () => {
      const ctx = createMockContext();
      const markup = renderIsoGrid(
        {
          cols: 16, // 16 cols x 12 rows = 192 celdas
          extrude: 0.5
        },
        ctx
      );

      expect(markup).toContain('url(#def-grad-1)');

      const fullSvg = buildSvgDocument({
        width: ctx.width,
        height: ctx.height,
        defs: ctx.defs,
        content: markup
      });

      const decoded = decodeURIComponent(fullSvg);
      const gradCount = (decoded.match(/<linearGradient/g) || []).length;

      // Debe haber exactamente 1 definición en <defs>, NO 192 duplicados
      expect(gradCount).toBe(1);
    });
  });

  describe("radial (primitives/radial.ts)", () => {
    it("renders rings and rays without throwing", () => {
      const ctx = createMockContext();

      const ringsMarkup = renderRadial({ kind: "rings", count: 8 }, ctx);
      expect(ringsMarkup).toContain("<circle");

      const raysMarkup = renderRadial({ kind: "rays", count: 12 }, ctx);
      expect(raysMarkup).toContain("<polygon");
    });
  });

  describe("gradient (primitives/gradient.ts)", () => {
    it("registers userSpaceOnUse gradients in DefsRegistry", () => {
      const ctx = createMockContext();
      const markup = renderGradient({ kind: "linear", angle: 45 }, ctx);

      expect(markup).toContain('fill="url(#def-grad-1)"');

      const serializedDefs = ctx.defs.serialize();
      expect(serializedDefs).toContain('<linearGradient id="def-grad-1"');
    });
  });
});
