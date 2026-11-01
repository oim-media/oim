/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { normalizeSlotEffects } from "./normalize";
import type { OimEffect } from "./types";

describe("normalizeSlotEffects", () => {
  it("keeps the effects array if it is already defined", () => {
    const effects: OimEffect[] = [
      {
        type: "texture",
        preset: "film-grain-35mm",
        intensity: 40,
        blend: "overlay",
        scale: 1,
        enabled: true,
      },
    ];
    expect(normalizeSlotEffects({ effects })).toEqual(effects);
  });

  it("converts legacy grain fields into a texture effect", () => {
    const legacy = { grain: true, grainIntensity: 35, grainBlend: "soft-light" };
    const res = normalizeSlotEffects(legacy);
    expect(res).toHaveLength(1);
    expect(res[0]).toEqual({
      type: "texture",
      preset: "fine-noise",
      intensity: 35,
      blend: "soft-light",
      scale: 1,
      enabled: true,
    });
  });

  it("converts legacy layerBlur into a blur effect", () => {
    const legacy = { layerBlur: 12 };
    const res = normalizeSlotEffects(legacy);
    expect(res).toHaveLength(1);
    expect(res[0]).toEqual({
      type: "blur",
      radius: 12,
      enabled: true,
    });
  });

  it("converts legacy shadowEnabled into a drop-shadow effect", () => {
    const legacy = {
      shadowEnabled: true,
      shadowColor: "#000000",
      shadowBlur: 10,
      shadowOffsetX: 2,
      shadowOffsetY: 4,
    };
    const res = normalizeSlotEffects(legacy);
    expect(res).toHaveLength(1);
    expect(res[0]).toEqual({
      type: "drop-shadow",
      color: "#000000",
      blur: 10,
      x: 2,
      y: 4,
      spread: 0,
      enabled: true,
    });
  });

  it("converts a legacy neon/shadow effect into a glow / drop-shadow effect", () => {
    const legacyNeon = {
      effect: "neon",
      effectColor: "#00ffcc",
      effectRadius: 15,
    };
    const res = normalizeSlotEffects(legacyNeon);
    expect(res).toHaveLength(1);
    expect(res[0]).toEqual({
      type: "glow",
      color: "#00ffcc",
      radius: 15,
      intensity: 80,
      enabled: true,
    });
  });

  it("returns an empty array if there are no effects or legacy fields", () => {
    expect(normalizeSlotEffects({})).toEqual([]);
  });
});
