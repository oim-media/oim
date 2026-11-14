/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from "vitest";
import { resolveRefs } from "./resources.js";
import { DOCUMENT_VERSION, documentSchema, type OimDocument } from "./schema.js";

const box = { x: 0, y: 0, width: 100, height: 40 };
const shape = (id: string, extra: Record<string, unknown> = {}) => ({ id, type: "shape", box, geometry: { kind: "rect" }, ...extra });
const group = (id: string, children: unknown[]) => ({ id, type: "group", box, children });
const doc = (extra: Record<string, unknown>) =>
  documentSchema.parse({ oim: DOCUMENT_VERSION, canvas: { width: 1080, height: 1350 }, languages: ["es"], ...extra }) as OimDocument;

const red = { kind: "color", value: "#ff0000" };
const blue = { kind: "color", value: "#0000ff" };

describe("resolveRefs", () => {
  it("replaces a ref by its resource", () => {
    const input = doc({ resources: { res_1: red }, layers: [shape("a", { fills: [{ ref: "res_1" }] })] });
    const { document, missing } = resolveRefs(input);
    expect(document.layers[0].fills).toEqual([red]);
    expect(missing).toEqual([]);
  });

  it("drops a missing ref and reports it", () => {
    const input = doc({ layers: [shape("a", { fills: [{ ref: "nope" }, blue] })] });
    const { document, missing } = resolveRefs(input);
    expect(document.layers[0].fills).toEqual([blue]);
    expect(missing).toEqual(["nope"]);
  });

  it("resolves inside group children two levels deep", () => {
    const input = doc({
      resources: { res_1: red },
      layers: [group("outer", [group("inner", [shape("leaf", { fills: [{ ref: "res_1" }] })])])],
    });
    const { document, missing } = resolveRefs(input);
    const leaf = document.layers[0].children?.[0].children?.[0];
    expect(leaf?.fills).toEqual([red]);
    expect(missing).toEqual([]);
  });

  it("resolves a ref inside a stroke paint", () => {
    const input = doc({
      resources: { res_1: red },
      layers: [shape("a", { strokes: [{ paint: { ref: "res_1" }, width: 2 }] })],
    });
    const { document } = resolveRefs(input);
    expect(document.layers[0].strokes).toEqual([{ paint: red, width: 2 }]);
  });

  it("leaves a document without resources untouched", () => {
    const input = doc({ layers: [shape("a", { fills: [red] })] });
    const before = structuredClone(input);
    const { document, missing } = resolveRefs(input);
    expect(document).toEqual(input);
    expect(input).toEqual(before);
    expect(missing).toEqual([]);
  });
});
