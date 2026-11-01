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
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { OimMetadataSchema } from "./schema";

const contrato = JSON.parse(
  readFileSync(join(__dirname, "..", "..", "spec", "schema", "oim.schema.json"), "utf8"),
);

const ajv = new Ajv2020({ strict: false, allErrors: true });
const validarConElContrato = ajv.compile(contrato);

const validarConZod = (doc: unknown) => OimMetadataSchema.safeParse(doc).success;

/** Cases chosen for what they separate, not for covering fields. */
const CASOS: [nombre: string, documento: unknown, esperado: boolean][] = [
  ["el minimo valido", { slots: [] }, true],
  ["sin slots", {}, false],
  ["slots que no es lista", { slots: "dos" }, false],

  // How a new .oim survives in an old player.
  ["clave desconocida arriba", { slots: [], clave_de_2027: 1 }, true],
  [
    "clave desconocida anidada en canvas",
    { slots: [], canvas: { natural_width: 10, natural_height: 5, futuro: 1 } },
    true,
  ],

  // The two formats that failed in the production .oim files.
  ["marca de tiempo con desplazamiento", { slots: [], timestamp: "2026-06-12T20:38:40.713579+00:00" }, true],
  ["marca de tiempo con Z", { slots: [], timestamp: "2026-06-12T20:38:40Z" }, true],
  ["marca de tiempo sin zona", { slots: [], timestamp: "2026-06-12T20:38:40" }, false],
  ["marca de tiempo que no es fecha", { slots: [], timestamp: "ayer" }, false],
  ["color transparent", { slots: [{ id: "a", style: { fillColor: "transparent" } }] }, true],
  ["color hexadecimal", { slots: [{ id: "a", style: { fillColor: "#ffffff" } }] }, true],
  ["color con nombre CSS", { slots: [{ id: "a", style: { fillColor: "red" } }] }, false],
  ["color con url", { slots: [{ id: "a", style: { fillColor: "url(http://malo.io/x)" } }] }, false],

  // Numeric limits.
  ["posicion dentro del lienzo", { slots: [{ id: "a", position: [50, 50] }] }, true],
  ["posicion fuera del lienzo", { slots: [{ id: "a", position: [150, 50] }] }, false],

  /**
   * The discrepancy this test found. Zod requires exactly two elements;
   * the contract came out with `prefixItems` without limits, which in JSON Schema
   * means "the first two like this, the rest whatever". A foreign player
   * would have accepted a malformed position and painted wherever it liked.
   */
  ["posicion de tres elementos", { slots: [{ id: "a", position: [10, 20, 30] }] }, false],
  ["posicion de un elemento", { slots: [{ id: "a", position: [10] }] }, false],
  ["canvas de anchura cero", { slots: [], canvas: { natural_width: 0, natural_height: 5 } }, false],
];

describe("el contrato publicado y Zod coinciden", () => {
  it.each(CASOS)("%s", (_nombre, documento, esperado) => {
    const zod = validarConZod(documento);
    const json = validarConElContrato(documento) as boolean;
    // The agreement first: it is the property that makes the contract useful.
    expect({ zod, json }).toEqual({ zod: esperado, json: esperado });
  });
});

describe("los .oim reales pasan por las dos puertas", () => {
  it("el contrato acepta lo que el sistema produce", async () => {
    const { extractOIM } = await import("./binary");
    const rutas = [
      join(__dirname, "..", "test", "fixtures", "object_sport.oim"),
      join(__dirname, "..", "test", "fixtures", "flyer_cafe.oim.png"),
    ];
    for (const ruta of rutas) {
      const { metadata } = await extractOIM(new Blob([readFileSync(ruta)]));
      const json = validarConElContrato(metadata) as boolean;
      const problemas = json ? [] : (validarConElContrato.errors ?? []).map((e) => `${e.instancePath} ${e.message}`);
      expect(problemas, ruta).toEqual([]);
      expect(validarConZod(metadata)).toBe(true);
    }
  });
});
