/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Decision (14 Nov): a zone is a 2.0 group without its flow.
import { describe, expect, it } from "vitest";
import { documentSchema } from "../schema.js";
import { upgrade } from "../upgrade.js";

const file = {
  oim: "1.27.9",
  canvas: { natural_width: 1000, natural_height: 500 },
  zones: [{ id: "z", position: [10, 20], size: [50, 40], style: { display: "flex", gap: "8px", background: "#ff0000", borderRadius: "12px", backdropFilter: "blur(6px)" } }],
  slots: [
    { id: "in", type: "geo", zone_id: "z", position: [0, 0], style: { width: 10, height: 10 } },
    { id: "out", type: "geo", position: [0, 0], style: { width: 10, height: 10 } },
  ],
};

describe("a 1.x zone", () => {
  const result = upgrade(file);
  const [, zone, out] = result.document.layers;

  it("is a group at the bottom, in canvas units, holding its layers after its background", () => {
    expect(zone).toMatchObject({ id: "z", type: "group", box: { x: 100, y: 100, width: 500, height: 200 } });
    expect(zone.children!.map((c) => c.id)).toEqual(["z__background", "in"]);
    expect(out.id).toBe("out");
  });

  it("keeps its paint: background, corners and backdrop blur", () => {
    expect(zone.children![0]).toMatchObject({ type: "shape", fills: [{ kind: "color", value: "#ff0000" }] });
    expect(zone.children![0].corners).toBeGreaterThan(0);
    expect(zone.effects).toEqual([{ kind: "backdrop", blur: 6 }]);
  });

  it("drops its flow as retired, leaves nothing unhandled, and validates", () => {
    expect(result.unhandled).toEqual([]);
    expect(result.retired.join(" ")).toMatch(/gap/);
    expect(documentSchema.safeParse(result.document).success).toBe(true);
  });

  it("a zone_id naming no zone leaves the layer where it was", () => {
    const { document } = upgrade({ ...file, zones: [] });
    expect(document.layers.map((l) => l.id)).toEqual(["oim-base", "in", "out"]);
  });
});
