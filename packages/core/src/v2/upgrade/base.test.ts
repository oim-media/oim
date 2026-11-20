/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from "vitest";
import { hasBaseLayer } from "../base-layer.js";
import { upgrade } from "../upgrade.js";

const v1 = (slots: unknown[], extra: Record<string, unknown> = {}) => ({ oim: "1.19.0", canvas: { natural_width: 1080, natural_height: 1920 }, slots, ...extra });

describe("upgrade: what the 1.x player painted", () => {
  it("keeps the base PNG under the layers, as 1.x painted it", () => {
    const { document } = upgrade(v1([{ id: "t", type: "text", content: { es: "Hola" } }]));
    expect(hasBaseLayer(document)).toBe(true);
    expect(document.layers[0]).toEqual({ id: "oim-base", type: "image", box: { x: 0, y: 0, width: 1080, height: 1920 }, image: { src: "oim:base" } });
    expect(document.layers[1].id).toBe("t");
  });

});
