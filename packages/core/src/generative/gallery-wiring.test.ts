/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { GENERATOR_CATALOG, getGeneratorSpec } from "./catalog.js";

describe("Cableado galería ↔ catálogo generativo", () => {
  const catalogIds = new Set(GENERATOR_CATALOG.map((s) => s.id));

  it("every catalog generator is valid and accessible", () => {
    expect(catalogIds.size).toBeGreaterThan(0);
    for (const spec of GENERATOR_CATALOG) {
      expect(getGeneratorSpec(spec.id)).toBeDefined();
    }
  });

  it("contains core generative generator IDs", () => {
    expect(catalogIds.has("stacked-waves")).toBe(true);
    expect(catalogIds.has("layered-peaks")).toBe(true);
    expect(catalogIds.has("blob-scene")).toBe(true);
  });
});
