/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { OimMetadataSchema, styleSchema, slotSchema } from "./schema";
import { isKnownGeoShape, shapeDrawing } from "./geoShapes";

describe("Grain and Generative Schema Extensions", () => {
  it("validates grain configuration at root metadata level (disabled by default)", () => {
    const validMeta = {
      version: "1.0.0",
      slots: [],
      grain: {
        enabled: false,
        intensity: 15,
        baseFrequency: 0.8,
        blendMode: "overlay",
      },
    };
    const parsed = OimMetadataSchema.safeParse(validMeta);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.grain?.enabled).toBe(false);
      expect(parsed.data.grain?.intensity).toBe(15);
      expect(parsed.data.grain?.blendMode).toBe("overlay");
    }
  });

  it("validates layer-level grain and effect attributes in styleSchema", () => {
    const validStyle = {
      grain: true,
      grainIntensity: 25,
      effect: "neon",
      effectColor: "#f59e0b",
      effectRadius: 16,
    };
    const parsed = styleSchema.safeParse(validStyle);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.grain).toBe(true);
      expect(parsed.data.grainIntensity).toBe(25);
      expect(parsed.data.effect).toBe("neon");
      expect(parsed.data.effectColor).toBe("#f59e0b");
      expect(parsed.data.effectRadius).toBe(16);
    }
  });

  it("validates languages visibility and pendingTranslation in slotSchema", () => {
    const validSlot = {
      id: "slot-promo",
      type: "shape" as const,
      languages: ["*"],
      pendingTranslation: ["en"],
    };
    const parsed = slotSchema.safeParse(validSlot);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.languages).toEqual(["*"]);
      expect(parsed.data.pendingTranslation).toEqual(["en"]);
    }
  });

  it("recognizes new generative shapes: blob and scribble", () => {
    expect(isKnownGeoShape("blob")).toBe(true);
    expect(isKnownGeoShape("scribble")).toBe(true);
    expect(isKnownGeoShape("arrow")).toBe(true);
    expect(isKnownGeoShape("star")).toBe(true);
    expect(isKnownGeoShape("rect")).toBe(true);
    expect(isKnownGeoShape("unknown-shape")).toBe(false);

    const blobDrawing = shapeDrawing("blob");
    expect(blobDrawing).toBeDefined();
    expect(blobDrawing?.tipo).toBe("path");

    const scribbleDrawing = shapeDrawing("scribble");
    expect(scribbleDrawing).toBeDefined();
    expect(scribbleDrawing?.tipo).toBe("path");
  });
});
