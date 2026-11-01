/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DYNAMIC_COLOR_ROLES } from "./dynamic-colors.js";

// The published JSON contract must reject a role key that the TypeScript
// contract rejects. Checked on the file other readers actually load.
describe("palettes en oim.schema.json", () => {
  const json = JSON.parse(
    readFileSync(join(__dirname, "..", "..", "spec", "schema", "oim.schema.json"), "utf8"),
  );
  const palette = Object.values(json.$defs as Record<string, any>).find(
    (d) => d.propertyNames?.enum && d.additionalProperties?.maxLength === 128,
  );

  it("the keys of each palette are exactly the twelve roles", () => {
    expect(palette).toBeDefined();
    expect([...palette.propertyNames.enum].sort()).toEqual([...DYNAMIC_COLOR_ROLES].sort());
  });

  it("the value of each role is a string of at most 128 characters", () => {
    expect(palette.additionalProperties).toEqual({ type: "string", maxLength: 128 });
  });
});
