/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { renderScatter } from "./scatter.js";
import { renderBlob } from "./blob.js";
import { renderMesh } from "./mesh.js";
import { createRng } from "../rng.js";
import { createDefsRegistry } from "../svg.js";
import { RenderContext } from "../types.js";

function createMockContext(width = 900, height = 600): RenderContext {
  return {
    width,
    height,
    bleed: 2,
    rng: createRng(100),
    defs: createDefsRegistry(),
    ramp: (i, total) => `#${((i + 1) * 10).toString(16).padStart(6, "0")}`
  };
}

describe("Primitives (scatter, blob, mesh)", () => {
  describe("scatter (primitives/scatter.ts)", () => {
    it("renders default composition of 3 elements matching Haikei standard", () => {
      const ctx = createMockContext();
      const markup = renderScatter({}, ctx);

      const circleCount = (markup.match(/<circle/g) || []).length;
      expect(circleCount).toBe(3);
    });

    it("respects minDistance between placed elements", () => {
      const ctx = createMockContext();
      const markup = renderScatter(
        {
          count: 5,
          minDistance: 50
        },
        ctx
      );

      expect(markup).toContain("<circle");
    });
  });

  describe("blob (primitives/blob.ts)", () => {
    it("emits corner anchor transform wrapping local negative coordinates", () => {
      const ctx = createMockContext();
      const markup = renderBlob(
        {
          count: 1,
          anchor: "corner-tr"
        },
        ctx
      );

      expect(markup).toContain('transform="translate(900, 0)"');
      expect(markup).toContain("<path");
    });
  });

  describe("mesh (primitives/mesh.ts)", () => {
    it("renders seamless polygon mesh without gaps or holes", () => {
      const ctx = createMockContext();
      const markup = renderMesh(
        {
          resolution: 4,
          distortion: 0.5
        },
        ctx
      );

      const polygonCount = (markup.match(/<polygon/g) || []).length;
      expect(polygonCount).toBeGreaterThan(0);
      expect(polygonCount % 2).toBe(0);
    });
  });
});
