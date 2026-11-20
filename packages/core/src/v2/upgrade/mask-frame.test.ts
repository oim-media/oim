/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from "vitest";
import { upgrade } from "../upgrade.js";

// A 1.x mask slot in a minimal document, upgraded and read back as its 2.0 layer.
const upgradeMask = (style: object) =>
  upgrade({
    oim: "1.27.9",
    canvas: { natural_width: 1000, natural_height: 500 },
    languages: ["es"],
    slots: [{ id: "m", type: "mask", position: [10, 20], style: { width: "50.0cqw", height: "10.0cqw", ...style } }],
  }).document.layers[1];

describe("upgrade: the 1.x mask frame", () => {
  it("maps fillType gradient on a window mask to a gradient paint in fills", () => {
    const layer = upgradeMask({ maskShape: "window", fillType: "gradient", fillGradient: "linear-gradient(90deg,#000,#fff)" });
    expect(layer.fills?.[0]).toMatchObject({ kind: "gradient" });
  });

  it("maps maskShape arch to a preset geometry named arch", () => {
    expect(upgradeMask({ maskShape: "arch" }).geometry).toEqual({ kind: "preset", name: "arch" });
  });

  // Pins the output of 1.x masks that carry none of the new fields: captured before the change.
  it("a 1.x mask with no new fields keeps its previous output", () => {
    expect(upgradeMask({ maskShape: "circle", maskBgColor: "#fff" })).toEqual({
      id: "m",
      type: "shape",
      box: { x: 100, y: 75, width: 500, height: 100 },
      geometry: { kind: "ellipse" },
      mask: {},
      fills: [{ kind: "color", value: "#fff" }],
    });
  });
});
