/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * That the published contract and the reference implementation say the same thing.
 *
 * The published JSON Schema exists so that a player in Swift, Kotlin or Rust can validate an
 * `.oim` without reading TypeScript. That only works if the JSON and the Zod agree on the
 * verdict: if they disagree, two players give different answers for the same file, and its
 * author has no way of knowing
 * which one is right.
 *
 * What is checked is NOT "Zod gets it right" nor "the JSON gets it right", but that
 * **they agree**. That is why each case asserts both things separately and also
 * their equality: a change that breaks the agreement fails even if both remain
 * defensible on their own.
 *
 * Validation uses ajv in 2020-12 mode, which is the dialect the contract declares. The v6
 * already in the tree only understands draft-07 and would have
 * given a false green.
 *
 * ajv ignores `format` unless `ajv-formats` is added. It is not needed: Zod also emits the
 * explicit `pattern`, so the date is checked all the same.
 * It is a property of the contract worth keeping: a consumer that only checks `format`
 * would not know that `+00:00` is accepted and `Z` too, and the timestamp case
 * watches for it.
 */

import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { OimMetadataSchema } from "./schema";
import { REFERENCE_OIM } from "../test/fixtures/index";

const contrato = JSON.parse(
  readFileSync(join(__dirname, "..", "..", "spec", "schema", "oim.schema.json"), "utf8"),
);

const ajv = new Ajv2020({ strict: false, allErrors: true });
const validarConElContrato = ajv.compile(contrato);

const validarConZod = (doc: unknown) => OimMetadataSchema.safeParse(doc).success;

/** Cases chosen for what they separate, not for covering fields. */
const CASES: [name: string, doc: unknown, expected: boolean][] = [
  ["the minimum valid", { slots: [] }, true],
  ["no slots", {}, false],
  ["slots that is not a list", { slots: "dos" }, false],

  // How a new .oim survives in an old player.
  ["unknown key at the top", { slots: [], clave_de_2027: 1 }, true],
  [
    "unknown key nested in canvas",
    { slots: [], canvas: { natural_width: 10, natural_height: 5, futuro: 1 } },
    true,
  ],

  // The two formats that failed in the production .oim files.
  ["timestamp with offset", { slots: [], timestamp: "2026-06-12T20:38:40.713579+00:00" }, true],
  ["timestamp with Z", { slots: [], timestamp: "2026-06-12T20:38:40Z" }, true],
  ["timestamp without zone", { slots: [], timestamp: "2026-06-12T20:38:40" }, false],
  ["timestamp that is not a date", { slots: [], timestamp: "ayer" }, false],
  ["color transparent", { slots: [{ id: "a", style: { fillColor: "transparent" } }] }, true],
  ["color hexadecimal", { slots: [{ id: "a", style: { fillColor: "#ffffff" } }] }, true],
  ["color by CSS name", { slots: [{ id: "a", style: { fillColor: "red" } }] }, false],
  ["color with url", { slots: [{ id: "a", style: { fillColor: "url(http://malo.io/x)" } }] }, false],

  // Numeric limits.
  ["position inside the canvas", { slots: [{ id: "a", position: [50, 50] }] }, true],
  ["position outside the canvas", { slots: [{ id: "a", position: [150, 50] }] }, false],

  /**
   * The discrepancy this test found. Zod requires exactly two elements;
   * the contract came out with `prefixItems` without limits, which in JSON Schema
   * means "the first two like this, the rest whatever". A foreign player
   * would have accepted a malformed position and painted wherever it liked.
   */
  ["position of three elements", { slots: [{ id: "a", position: [10, 20, 30] }] }, false],
  ["position of an element", { slots: [{ id: "a", position: [10] }] }, false],
  ["canvas of zero width", { slots: [], canvas: { natural_width: 0, natural_height: 5 } }, false],
];

describe("the published contract and Zod agree", () => {
  it.each(CASES)("%s", (_nombre, doc, expected) => {
    const zod = validarConZod(doc);
    const json = validarConElContrato(doc) as boolean;
    // The agreement first: it is the property that makes the contract useful.
    expect({ zod, json }).toEqual({ zod: expected, json: expected });
  });
});

describe("real .oim files pass both gates", () => {
  it("the contract accepts what the system produces", async () => {
    const { extractOIM } = await import("./binary");
    // The reference bytes under a `.oim` name (not `.png`): the extension must not matter.
    const dir = mkdtempSync(join(tmpdir(), "oim-ext-"));
    try {
      const bareOim = join(dir, "reference.oim");
      writeFileSync(bareOim, readFileSync(REFERENCE_OIM));
      const files = [REFERENCE_OIM, bareOim];
      for (const file of files) {
        const { metadata } = await extractOIM(new Blob([readFileSync(file)]));
        const json = validarConElContrato(metadata) as boolean;
        const problems = json ? [] : (validarConElContrato.errors ?? []).map((e) => `${e.instancePath} ${e.message}`);
        expect(problems, file).toEqual([]);
        expect(validarConZod(metadata)).toBe(true);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
