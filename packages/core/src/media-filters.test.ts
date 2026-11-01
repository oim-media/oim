/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { FILTER_PRESET_CSS, mediaFilterCss, hasMediaFilter } from "./media-filters";
import { minVersionFor } from "./compatibility";

describe("mediaFilterCss", () => {
  it("returns undefined when all the adjustments are neutral", () => {
    expect(mediaFilterCss({})).toBeUndefined();
    expect(mediaFilterCss({ filterBrightness: 100, filterBlur: 0 })).toBeUndefined();
  });

  it("une preset, blur y hue-rotate en orden fijo", () => {
    expect(mediaFilterCss({ filterPreset: "grayscale", filterBlur: 4, filterHueRotate: 30 }))
      .toBe(FILTER_PRESET_CSS.grayscale + " blur(4px) hue-rotate(30deg)");
  });
});

describe("hasMediaFilter", () => {
  it("a none preset does not count as a filter", () => {
    expect(hasMediaFilter({ filterPreset: "none" })).toBe(false);
  });

  it("a non-neutral adjustment does count", () => {
    expect(hasMediaFilter({ filterSaturate: 120 })).toBe(true);
  });
});

describe("media_filters capability", () => {
  it("requires the 1.18.0 contract", () => {
    expect(minVersionFor({ capabilities: ["media_filters"] })).toBe("1.18.0");
  });
});

describe("mediaFilterCss, order and values", () => {
  it("with all six adjustments set, the order is preset, blur, brightness, contrast, saturation, hue", () => {
    const css = mediaFilterCss({
      filterPreset: "sepia", filterBlur: 2, filterBrightness: 110,
      filterContrast: 120, filterSaturate: 90, filterHueRotate: 45,
    });
    expect(css).toBe(
      FILTER_PRESET_CSS.sepia + " blur(2px) brightness(110%) contrast(120%) saturate(90%) hue-rotate(45deg)",
    );
  });

  it("NaN and a negative blur produce no blur part", () => {
    expect(mediaFilterCss({ filterBlur: NaN })).toBeUndefined();
    expect(mediaFilterCss({ filterBlur: -5 })).toBeUndefined();
    expect(hasMediaFilter({ filterBlur: NaN })).toBe(false);
  });

  it("brightness 600 is clamped to 500", () => {
    expect(mediaFilterCss({ filterBrightness: 600 })).toBe("brightness(500%)");
    expect(hasMediaFilter({ filterBrightness: 600 })).toBe(true);
  });
});
