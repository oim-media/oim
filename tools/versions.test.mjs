/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tagMatches } from "./versions.mjs";

const read = (p) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), "utf8");

describe("package versions follow the contract", () => {
  it("versions match the contract", () => {
    const contract = /CONTRACT_VERSION = "([\d.]+)"/.exec(read("packages/core/src/compatibility.ts"))[1];
    for (const p of ["core", "player-oim", "player-ovm", "spec"]) {
      const j = JSON.parse(read(`packages/${p}/package.json`));
      expect([j.name, j.version, j.private ?? false]).toEqual([`@oim-media/${p}`, contract, false]);
    }
  });

  it("a release tag must name the contract version", () => {
    expect(tagMatches("v1.23.2", "1.23.2")).toBe(true);
    expect(tagMatches("v1.23.1", "1.23.2")).toBe(false);
  });
});
