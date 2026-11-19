/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 2.0 documents carry `layers` (groups nest more layers in `children`). The
 * player's pre-paint validation must cap the total count (MAX_TOTAL_LAYERS), each list (MAX_SLOTS) and the nesting depth,
 * or a crafted file exhausts the renderer.
 */

import { describe, it, expect } from "vitest";
import { validateOimMetadata } from "./security";

const doc2 = (layers: unknown) => ({ oim: "2.0.0", layers });
const group = (children: unknown[]) => ({ type: "group", children });
const shape = () => ({ type: "shape" });

/** A single chain of `depth` nested layers, built without recursion. */
function chain(depth: number) {
  let node: any = shape();
  for (let i = 1; i < depth; i++) node = { type: "group", children: [node] };
  return doc2([node]);
}

describe("validateOimMetadata: 2.0 layer count", () => {
  it("rejects 151 flat top-level layers (the schema caps each list at 150)", () => {
    const layers = Array.from({ length: 151 }, shape);
    const errs = validateOimMetadata(doc2(layers));
    expect(errs.length).toBeGreaterThan(0);
    expect(errs.join(" ")).toMatch(/150/);
  });

  it("accepts 150 layers spread across nested children (10 groups x 14 children)", () => {
    const layers = Array.from({ length: 10 }, () => group(Array.from({ length: 14 }, shape)));
    const errs = validateOimMetadata(doc2(layers));
    expect(errs.join(" ")).not.toMatch(/layer/);
    expect(errs).toEqual([]);
  });

  it("counts children recursively: 10 groups x 100 children (1010 total) is rejected at the total cap", () => {
    const layers = Array.from({ length: 10 }, () => group(Array.from({ length: 100 }, shape)));
    const errs = validateOimMetadata(doc2(layers));
    expect(errs.length).toBeGreaterThan(0);
    expect(errs.join(" ")).toMatch(/1000/);
  });

  it("accepts schema-valid documents with several full groups (7 groups x 140 children + 7 = 987)", () => {
    const layers = Array.from({ length: 7 }, () => group(Array.from({ length: 140 }, shape)));
    const errs = validateOimMetadata(doc2(layers));
    expect(errs).toEqual([]);
  });

  it("accepts 100 groups with 1 child each (200 total): the cap is per list, not 150 in total", () => {
    const layers = Array.from({ length: 100 }, () => group([shape()]));
    expect(validateOimMetadata(doc2(layers))).toEqual([]);
  });

  it("rejects a children list over 150, like the schema", () => {
    const errs = validateOimMetadata(doc2([group(Array.from({ length: 151 }, shape))]));
    expect(errs.join(" ")).toMatch(/150/);
  });
});

describe("validateOimMetadata: 2.0 nesting depth", () => {
  it("rejects nesting depth 33", () => {
    const errs = validateOimMetadata(chain(33));
    expect(errs.length).toBeGreaterThan(0);
    expect(errs.join(" ")).toMatch(/depth|nest/i);
  });

  it("accepts nesting depth 32", () => {
    const errs = validateOimMetadata(chain(32));
    expect(errs).toEqual([]);
  });

  it("does not throw on a programmatically built 100000-deep chain", () => {
    const deep = chain(100000);
    let errs: string[] = [];
    expect(() => {
      errs = validateOimMetadata(deep);
    }).not.toThrow();
    expect(errs.length).toBeGreaterThan(0);
  });
});

describe("validateOimMetadata: 2.0 structure", () => {
  it("rejects layers that is not an array", () => {
    const errs = validateOimMetadata(doc2("not-an-array"));
    expect(errs.length).toBeGreaterThan(0);
  });

  it("rejects a non-object layer entry", () => {
    const errs = validateOimMetadata(doc2([shape(), 42]));
    expect(errs.length).toBeGreaterThan(0);
  });

  it("rejects a non-object entry inside children", () => {
    const errs = validateOimMetadata(doc2([group([shape(), "x"])]));
    expect(errs.length).toBeGreaterThan(0);
  });

  it("rejects children that is not an array", () => {
    const errs = validateOimMetadata(doc2([{ type: "group", children: "x" }]));
    expect(errs.length).toBeGreaterThan(0);
  });
});
