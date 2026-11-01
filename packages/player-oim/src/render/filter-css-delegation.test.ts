/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// The backdrop `filter` layer now delegates to @oim-media/core. These strings are the
// ones the player produced before the delegation; they must not change.

import { describe, it, expect } from "vitest";
import { getFilterCss } from "./layerComposition";

describe("getFilterCss after delegating to core", () => {
  it("keeps the strings of the presets the player always produced", () => {
    expect(getFilterCss("grayscale")).toBe("grayscale(1)");
    expect(getFilterCss("vintage")).toBe("sepia(0.35) contrast(1.1) saturate(0.85) brightness(1.05)");
    expect(getFilterCss("cyberpunk")).toBe("contrast(1.3) saturate(1.8) hue-rotate(140deg)");
    expect(getFilterCss("vhs")).toBe("sepia(0.2) contrast(1.2) saturate(1.5) hue-rotate(30deg) brightness(1.05)");
  });

  it("keeps the legacy fp alias on a slot", () => {
    expect(getFilterCss({ id: "f", type: "filter", style: { fp: "noir" } } as any)).toBe("grayscale(1) contrast(1.6) brightness(0.9)");
  });
});
