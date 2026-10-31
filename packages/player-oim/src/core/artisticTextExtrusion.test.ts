/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * El relieve 3D en el player.
 *
 * Su `shadeHexColor` aclaraba hacia el blanco mientras el del editor
 * oscurecia: con `#111827` el autor veia un relieve casi negro y el .oim lo
 * pintaba blanco. Esta prueba mira el modelo que el player construye desde el
 * slot, que es lo que acaba pintado.
 */

import { describe, it, expect } from "vitest";
import { buildArtisticTextModelFromSlot } from "./artisticText";

const luz = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255);
};

describe("el relieve 3D del player", () => {
  it("oscurece el color del relieve, igual que el editor", () => {
    const model = buildArtisticTextModelFromSlot(
      {
        id: "c",
        width_px: 400,
        height_px: 200,
        content: { es: "UNO" },
        style: { extrusionDepth: 8, extrusionColor: "#111827" },
      },
      "es"
    );
    expect(model.extrusionLayers.length).toBeGreaterThan(0);
    expect(model.extrusionLayers[model.extrusionLayers.length - 1].color).toBe("#010102");
    for (const capa of model.extrusionLayers) expect(luz(capa.color)).toBeLessThanOrEqual(luz("#111827"));
  });
});
