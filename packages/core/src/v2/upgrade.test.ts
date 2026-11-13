/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from "vitest";
import { childrenByGroup } from "../groups.js";
import { DOCUMENT_VERSION, documentSchema, type Layer } from "./schema.js";
import { isV2, upgrade } from "./upgrade.js";

const v1 = (slots: unknown[], extra: object = {}) => ({
  oim: "1.27.9",
  canvas: { natural_width: 1000, natural_height: 500 },
  languages: ["es"],
  slots,
  ...extra,
});
const slot = (o: object = {}) => ({
  id: "a",
  type: "geo",
  position: [10, 20],
  style: { width: "50.0cqw", height: "10.0cqw" },
  ...o,
});
const first = (input: unknown): Layer => upgrade(input).document.layers[0];

describe("upgrade: root, tree and box", () => {
  it("converts the root: version, canvas, languages, one list of layers", () => {
    const { document } = upgrade(v1([slot()], { oim_id: "doc_1", name: "Poster", reedit: "sealed" }));
    expect(document.oim).toBe(DOCUMENT_VERSION);
    expect(document.id).toBe("doc_1");
    expect(document.name).toBe("Poster");
    expect(document.reedit).toBe("sealed");
    expect(document.canvas).toEqual({ width: 1000, height: 500 });
    expect(document.languages).toEqual(["es"]);
    expect(document.layers).toHaveLength(1);
  });

  it("reads the layer list from slots, elements or layers", () => {
    for (const key of ["slots", "elements", "layers"]) {
      const input = { oim: "1.27.9", canvas: { natural_width: 1000, natural_height: 500 }, [key]: [slot()] };
      expect(upgrade(input).document.layers, key).toHaveLength(1);
    }
  });

  it("box: percent positions and cqw lengths become canvas units", () => {
    // Painted 100 tall (cqw of the width) and centred on half of 10% of the height: 75.
    expect(first(v1([slot()])).box).toEqual({ x: 100, y: 75, width: 500, height: 100 });
  });

  it.each([
    ["92.5cqw", 925],
    [925, 925],
    ["120px", 120],
    ["50%", 500],
  ])("width %j is %d canvas units", (width, expected) => {
    expect(first(v1([slot({ style: { width, height: 10 } })])).box.width).toBe(expected);
  });

  it("an empty width falls back to width_px and never yields NaN", () => {
    const layer = first(v1([slot({ width_px: 300, height_px: 40, style: { width: "", height: "" } })]));
    expect(layer.box).toEqual({ x: 100, y: 100, width: 300, height: 40 });
  });

  it("a layer with no size at all gets the player's 10cqw box, not NaN", () => {
    expect(first(v1([{ id: "a", type: "geo" }])).box).toEqual({ x: 0, y: -50, width: 100, height: 100 });
  });

  it("defaults are omitted", () => {
    const layer = first(
      v1([slot({ style: { width: 10, height: 10, opacity: 100, rotation: 0, isVisible: true, blendMode: "normal" } })]),
    );
    expect(layer).not.toHaveProperty("opacity");
    expect(layer).not.toHaveProperty("visible");
    expect(layer).not.toHaveProperty("blend");
    expect(layer.box).not.toHaveProperty("rotation");
  });

  it("real values are kept, with opacity from 0 to 1", () => {
    const layer = first(
      v1([slot({ style: { width: 10, height: 10, opacity: 85, rotation: -2, isVisible: false, blendMode: "multiply" } })]),
    );
    expect(layer.opacity).toBe(0.85);
    expect(layer.visible).toBe(false);
    expect(layer.box.rotation).toBe(-2);
    expect(layer.blend).toBe("multiply");
  });

  it("the tree: children move inside their group, in layer order", () => {
    const slots = [
      { id: "g", type: "group", position: [0, 0], style: { width: 10, height: 10, childIds: ["b", "a"] } },
      slot({ id: "a", style: { width: 10, height: 10, groupId: "g" } }),
      slot({ id: "b", style: { width: 10, height: 10, groupId: "g" } }),
      slot({ id: "loose", style: { width: 10, height: 10 } }),
    ];
    const { document, unhandled } = upgrade(v1(slots));
    expect(document.layers.map((l) => l.id)).toEqual(["g", "loose"]);
    expect(document.layers[0].children?.map((l) => l.id)).toEqual(childrenByGroup(slots).get("g"));
    expect(unhandled).toEqual([]);
  });

  it("when groupId and childIds disagree, the core's membership rule decides", () => {
    const slots = [
      { id: "g1", type: "group", position: [0, 0], style: { width: 1, height: 1 } },
      { id: "g2", type: "group", position: [0, 0], style: { width: 1, height: 1, childIds: ["a"] } },
      slot({ id: "a", style: { width: 10, height: 10, groupId: "g1" } }),
    ];
    const { document } = upgrade(v1(slots));
    const parent = document.layers.find((l) => l.children?.some((c) => c.id === "a"));
    expect(parent?.id).toBe("g1");
    expect([...childrenByGroup(slots).keys()]).toEqual(["g1"]);
  });

  it("a groupId that points nowhere leaves the layer loose, never lost", () => {
    const { document } = upgrade(v1([slot({ style: { width: 10, height: 10, groupId: "ghost" } })]));
    expect(document.layers.map((l) => l.id)).toEqual(["a"]);
  });

  it("the 15 layer types of 1.x become the 5 of 2.0", () => {
    const map: Record<string, string> = {
      text: "text", "artistic-text": "text", geo: "shape", shape: "shape", draw: "shape", svg: "shape",
      pattern: "shape", container: "shape", filter: "shape", mask: "shape", image: "image", lottie: "lottie",
      group: "group", component: "group", zone: "group",
    };
    for (const [from, to] of Object.entries(map)) {
      expect(first(v1([slot({ type: from })])).type, from).toBe(to);
    }
    expect(first(v1([{ id: "a", position: [0, 0] }])).type).toBe("text");
  });

  // Ruling (13 Nov): the player stopped reading the short aliases in 1.12.0, so
  // they are retired, not revived. The Spanish permission is still read.
  it("retires the short aliases and reads the Spanish permission", () => {
    const legacy = {
      oim: "1.20.0",
      reedicion: "sellado",
      canvas: { natural_width: 1000, natural_height: 500 },
      slots: [{ id: "a", type: "geo", position: [0, 0], p: [10, 20], st: { width: "50.0cqw", height: "10.0cqw" } }],
    };
    const result = upgrade(legacy);
    expect(result.document.layers[0].box).toMatchObject({ width: 100, height: 100 });
    expect(result.document.reedit).toBe("sealed");
    expect(result.unhandled).toEqual([]);
  });

  it("a layer limited to some languages keeps that limit", () => {
    expect(first(v1([slot({ languages: ["en"] })])).languages).toEqual(["en"]);
  });

  it("a key nobody converts is reported, never dropped in silence", () => {
    const result = upgrade(v1([slot({ style: { width: 10, height: 10, madeUpKey: 1 }, madeUpSlotKey: 2 })], { madeUpRoot: 3 }));
    expect(result.unhandled).toEqual(["root.madeUpRoot", "slot.madeUpSlotKey", "style.madeUpKey"]);
  });

  it("transport fields are dropped on purpose and say so", () => {
    const result = upgrade(v1([slot()], { signature: "x", key_version: "v1", signed_at: "2026-01-01", timestamp: "t" }));
    expect(result.document).not.toHaveProperty("signature");
    expect(result.retired).toEqual(expect.arrayContaining(["root.signature", "root.key_version", "root.signed_at"]));
    expect(result.unhandled).toEqual([]);
  });

  it("a 2.0 document comes back unchanged", () => {
    const { document } = upgrade(v1([slot()]));
    expect(isV2(document)).toBe(true);
    expect(upgrade(document)).toEqual({ document, retired: [], unhandled: [] });
  });

  it("its output passes the 2.0 schema", () => {
    const parsed = documentSchema.safeParse(upgrade(v1([slot(), slot({ id: "t", type: "text" }), slot({ id: "i", type: "image" })])).document);
    expect(parsed.success ? [] : parsed.error.issues).toEqual([]);
  });

  it("does not modify its input, even when it has to rename aliases and invent an id", () => {
    const input = { oim: "1.20.0", reedicion: "sellado", slots: [{ type: "geo", p: [10, 20], st: { width: 10, height: 10, groupId: "g" }, c: { es: "" } }] };
    const before = JSON.parse(JSON.stringify(input));
    upgrade(input);
    expect(input).toEqual(before);
  });

  it("never throws on something that is not a document", () => {
    for (const input of [null, 3, "x", [], {}]) {
      expect(() => upgrade(input), String(input)).not.toThrow();
    }
  });
});
