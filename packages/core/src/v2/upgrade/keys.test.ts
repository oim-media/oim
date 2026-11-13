/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// No 1.x style key without an owner. A key is owned when some converter takes
// it, on every layer type: a key taken only on texts would vanish in silence
// from a shape that happens to carry it, which 1.x files do all the time.
import { describe, expect, it } from "vitest";
import { styleSchema } from "../../schema.js";
import { upgrade } from "../upgrade.js";
import { RETIRED_STYLE_KEYS, UNDECLARED_STYLE_KEYS } from "./keys.js";
import { TYPE_OF } from "./tree.js";

const DECLARED = Object.keys(styleSchema.shape);
const TYPES = Object.keys(TYPE_OF);

function leftovers(key: string, type: string): string[] {
  const input = {
    oim: "1.27.9",
    canvas: { natural_width: 1000, natural_height: 1000 },
    slots: [{ id: "a", type, position: [0, 0], style: { width: 10, height: 10, [key]: "x" } }],
  };
  // A bare "style.<key>" is a key nobody took. "style.<key>: reason" is a
  // converter that took it and could not use this placeholder value.
  return upgrade(input).unhandled.filter((entry) => entry === `style.${key}`);
}

describe("every 1.x style key has an owner", () => {
  it("the contract declares the keys this test walks", () => {
    expect(DECLARED.length).toBeGreaterThan(120);
    expect(TYPES).toHaveLength(15);
  });

  it.each(DECLARED)("declared key %s is taken on every layer type", (key) => {
    expect(TYPES.flatMap((type) => leftovers(key, type).map((entry) => `${type}: ${entry}`))).toEqual([]);
  });

  it.each([...UNDECLARED_STYLE_KEYS])("undeclared key %s is taken on every layer type", (key) => {
    expect(TYPES.flatMap((type) => leftovers(key, type).map((entry) => `${type}: ${entry}`))).toEqual([]);
  });

  it("a key that does not exist is still reported: the walk above can fail", () => {
    expect(leftovers("notAStyleKey", "geo")).toEqual(["style.notAStyleKey"]);
  });

  it("what is dropped on purpose is listed as retired, by name", () => {
    const style = Object.fromEntries(RETIRED_STYLE_KEYS.map((key) => [key, "x"]));
    const result = upgrade({ oim: "1.27.9", slots: [{ id: "a", type: "geo", style }] });
    expect(result.retired).toEqual(RETIRED_STYLE_KEYS.map((key) => `style.${key}`).sort());
    expect(result.unhandled).toEqual([]);
  });

  it("the retired and the undeclared lists do not name declared keys by mistake", () => {
    expect(RETIRED_STYLE_KEYS.filter((key) => !DECLARED.includes(key))).toEqual([]);
    expect(UNDECLARED_STYLE_KEYS.filter((key) => DECLARED.includes(key))).toEqual([]);
  });
});
