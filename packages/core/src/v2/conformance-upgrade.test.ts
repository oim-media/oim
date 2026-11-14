/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// The conformance vectors, read as 2.0. Every published 1.x file must upgrade
// to a valid 2.0 document with nothing left behind. Runs with the conformance
// gate (`pnpm conformance`): its name carries the word the gate filters by.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractOIM } from "../binary.js";
import { documentSchema, type Layer } from "./schema.js";
import { upgrade } from "./upgrade.js";
import { RETIRED_STYLE_KEYS } from "./upgrade/keys.js";
import { RETIRED_ROOT_KEYS, TRANSPORT_KEYS } from "./upgrade/root.js";

const VECTORS = join(__dirname, "..", "..", "..", "spec", "vectors");
const files = readdirSync(VECTORS).filter((f) => f.endsWith(".oim.png")).sort();

const ALLOWED_TO_RETIRE = new Set([
  ...TRANSPORT_KEYS.map((key) => `root.${key}`),
  ...RETIRED_ROOT_KEYS.map((key) => `root.${key}`),
  ...RETIRED_STYLE_KEYS.map((key) => `style.${key}`),
  "slot.s",
  "slot.zone_id",
  "slot.tracking_data",
  // Decision (13 Nov): the pointer parallax is retired in 2.0.
  "style.parallax",
  "slot.parallax",
]);

const countLayers = (layers: Layer[]): number => layers.reduce((n, layer) => n + 1 + countLayers(layer.children ?? []), 0);

const metadata = new Map<string, Record<string, unknown>>();
for (const file of files) {
  const { metadata: read } = await extractOIM(new Blob([readFileSync(join(VECTORS, file))]));
  metadata.set(file, read);
}

it("the corpus is the conformance vectors, not an empty folder", () => {
  expect(files.length).toBeGreaterThanOrEqual(37);
  expect([...metadata.values()].every((m) => m && typeof m === "object")).toBe(true);
});

describe.each(files)("%s as 2.0", (file) => {
  const input = metadata.get(file)!;
  const result = upgrade(input);

  it("leaves nothing unhandled", () => expect(result.unhandled).toEqual([]));

  it("only drops what 2.0 retires", () => {
    expect(result.retired.filter((key) => !ALLOWED_TO_RETIRE.has(key))).toEqual([]);
  });

  it("is a valid 2.0 document", () => {
    const parsed = documentSchema.safeParse(result.document);
    expect(parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)).toEqual([]);
  });

  it("is stable: upgrading its own output changes nothing", () => {
    expect(upgrade(result.document).document).toEqual(result.document);
  });

  it("keeps every layer", () => {
    const slots = (input.slots ?? input.elements ?? input.layers ?? []) as unknown[];
    expect(countLayers(result.document.layers)).toBeGreaterThanOrEqual(slots.length);
  });

  it("does not modify its input", () => {
    const before = JSON.stringify(input);
    upgrade(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});
