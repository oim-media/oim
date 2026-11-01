/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { GENERATOR_CATALOG } from "./catalog.js";
import { renderGenerativeSVG } from "./index.js";
import * as fs from "node:fs";
import * as path from "node:path";

describe("Step 0: baseline snapshot of the 17 generators before migrating to layers", () => {
  const snapshotPath = path.join(__dirname, "__baseline_snapshots__.json");

  it("captures or validates that the 17 generators produce exactly the same SVG, byte for byte", () => {
    const current: Record<string, string> = {};
    for (const g of GENERATOR_CATALOG) {
      const svg = renderGenerativeSVG({ generatorId: g.id, seed: 7 }, { width: 400, height: 300 });
      current[g.id] = svg;
    }

    if (!fs.existsSync(snapshotPath)) {
      // Save the baseline before the migration
      fs.writeFileSync(snapshotPath, JSON.stringify(current, null, 2), "utf8");
      expect(Object.keys(current).length).toBe(17);
    } else {
      const baseline = JSON.parse(fs.readFileSync(snapshotPath, "utf8")) as Record<string, string>;
      const baselineKeys = Object.keys(baseline);
      expect(baselineKeys.length).toBe(17);
      for (const id of baselineKeys) {
        expect(current[id], `The SVG of the pre-existing generator "${id}" must be byte-identical to the baseline`).toBe(baseline[id]);
      }
    }
  });
});
