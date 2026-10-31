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

describe("Paso 0: Snapshot baseline de los 17 generadores antes de migrar a layers", () => {
  const snapshotPath = path.join(__dirname, "__baseline_snapshots__.json");

  it("captura o valida que los 17 generadores producen exactamente el mismo SVG byte a byte", () => {
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
        expect(current[id], `El SVG del generador preexistente "${id}" debe ser idéntico byte a byte al baseline`).toBe(baseline[id]);
      }
    }
  });
});
