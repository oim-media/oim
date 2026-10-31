/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { FILTER_PRESET_CSS, mediaFilterCss, hasMediaFilter } from "./media-filters";
import { minVersionFor } from "./compatibility";

describe("mediaFilterCss", () => {
  it("devuelve undefined cuando todos los ajustes son neutros", () => {
    expect(mediaFilterCss({})).toBeUndefined();
    expect(mediaFilterCss({ filterBrightness: 100, filterBlur: 0 })).toBeUndefined();
  });

  it("une preset, blur y hue-rotate en orden fijo", () => {
    expect(mediaFilterCss({ filterPreset: "grayscale", filterBlur: 4, filterHueRotate: 30 }))
      .toBe(FILTER_PRESET_CSS.grayscale + " blur(4px) hue-rotate(30deg)");
  });
});

describe("hasMediaFilter", () => {
  it("un preset none no cuenta como filtro", () => {
    expect(hasMediaFilter({ filterPreset: "none" })).toBe(false);
  });

  it("un ajuste no neutro sí cuenta", () => {
    expect(hasMediaFilter({ filterSaturate: 120 })).toBe(true);
  });
});

describe("capacidad media_filters", () => {
  it("exige el contrato 1.18.0", () => {
    expect(minVersionFor({ capabilities: ["media_filters"] })).toBe("1.18.0");
  });
});

describe("mediaFilterCss, orden y valores", () => {
  it("con los seis ajustes puestos, el orden es preset, blur, brillo, contraste, saturación, hue", () => {
    const css = mediaFilterCss({
      filterPreset: "sepia", filterBlur: 2, filterBrightness: 110,
      filterContrast: 120, filterSaturate: 90, filterHueRotate: 45,
    });
    expect(css).toBe(
      FILTER_PRESET_CSS.sepia + " blur(2px) brightness(110%) contrast(120%) saturate(90%) hue-rotate(45deg)",
    );
  });

  it("NaN y un blur negativo no generan parte de blur", () => {
    expect(mediaFilterCss({ filterBlur: NaN })).toBeUndefined();
    expect(mediaFilterCss({ filterBlur: -5 })).toBeUndefined();
    expect(hasMediaFilter({ filterBlur: NaN })).toBe(false);
  });

  it("brillo 600 se acota a 500", () => {
    expect(mediaFilterCss({ filterBrightness: 600 })).toBe("brightness(500%)");
    expect(hasMediaFilter({ filterBrightness: 600 })).toBe(true);
  });
});
