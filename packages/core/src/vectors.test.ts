/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * That the schema accepts the .oim files that the system really produces.
 *
 * Nothing validated a real file against `schema.ts`. When the contract was generated as
 * JSON Schema it was tested for the first time, and all FOUR production .oim files
 * failed:
 *
 *   - `timestamp` was `2026-06-12T20:38:40.713579+00:00` (Python's isoformat) and the
 *     schema required the form with `Z`. Both are RFC 3339.
 *   - `style.color` was `transparent`, which the editor writes and the colour regex did not
 *     cover.
 *
 * In both cases the wrong one was the schema, not the file. A schema that nobody runs drifts
 * from reality the way a code copy drifts from its original, for the same reason: nothing
 * contradicts it.
 *
 * This matters more now that the contract is published. A player in Swift that validated
 * against the JSON Schema would have rejected 100% of the real files, and its author would
 * have had no way of knowing who was right.
 *
 * Only files in `test/fixtures/` are read, never in `dist/`: `dist/` is build output and in a
 * clean clone it does not exist, so the test would pass
 * without checking anything.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { extractOIM } from "./binary";
import { OimMetadataSchema } from "./schema";

const DIRECTORIOS = [join(__dirname, "..", "test", "fixtures")];

function ficherosReales(): string[] {
  const encontrados: string[] = [];
  for (const dir of DIRECTORIOS) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      // The landing ships its works as .oim.png; both are .oim.
      if (/\.oim(\.png)?$/.test(f)) encontrados.push(join(dir, f));
    }
  }
  return encontrados.sort();
}

const FILES = ficherosReales();

describe("published .oim files validate against their own schema", () => {
  /**
   * Without this the suite would pass green the day someone moves or renames the
   * folders: zero files found, zero checks, everything correct.
   */
  it("finds files to check", () => {
    expect(FILES.length).toBeGreaterThanOrEqual(2);
  });

  it.each(FILES)("%s validates", async (file) => {
    const { metadata } = await extractOIM(new Blob([readFileSync(file)]));
    const result = OimMetadataSchema.safeParse(metadata);
    const problemas = result.success
      ? []
      : result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    expect(problemas).toEqual([]);
  });
});

describe("the two formats that were failing", () => {
  /** The backend uses `+00:00`; requiring `Z` rejected everything signed. */
  it("accepts the timestamp with an offset, not only with Z", () => {
    const base = { slots: [] };
    expect(OimMetadataSchema.safeParse({ ...base, timestamp: "2026-06-12T20:38:40.713579+00:00" }).success).toBe(true);
    expect(OimMetadataSchema.safeParse({ ...base, timestamp: "2026-06-12T20:38:40Z" }).success).toBe(true);
    // And it still rejects what is not a date, which is what it exists for.
    expect(OimMetadataSchema.safeParse({ ...base, timestamp: "ayer por la tarde" }).success).toBe(false);
  });

  it("accepts transparent without opening the door to other colors", () => {
    const withColor = (color: string) =>
      OimMetadataSchema.safeParse({ slots: [{ id: "a", style: { fillColor: color } }] }).success;
    expect(withColor("transparent")).toBe(true);
    expect(withColor("#ffffff")).toBe(true);
    // `transparent` is an exact keyword: it must not let its neighbours through.
    expect(withColor("transparente")).toBe(false);
    expect(withColor("url(http://malo.io/x)")).toBe(false);
    expect(withColor("red")).toBe(false);
  });
});
