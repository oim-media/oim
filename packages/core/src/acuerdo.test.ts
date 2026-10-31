/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Que el contrato publicado y la implementacion de referencia digan lo mismo.
 *
 * `packages/spec/schema/oim.schema.json` existe para que un player en Swift,
 * Kotlin o Rust pueda validar un `.oim` sin leer TypeScript. Eso solo sirve si
 * el JSON y el Zod coinciden en el veredicto: si discrepan, dos players dan
 * respuestas distintas sobre el mismo fichero y su autor no tiene forma de
 * saber cual tiene razon.
 *
 * Lo que se comprueba NO es «Zod acierta» ni «el JSON acierta», sino que
 * **coinciden**. Por eso cada caso afirma las dos cosas por separado y ademas
 * su igualdad: un cambio que rompa el acuerdo falla aunque ambos sigan siendo
 * defendibles por su cuenta.
 *
 * Se valida con ajv en modo 2020-12, que es el dialecto que declara el
 * contrato. La v6 que ya estaba en el arbol solo entiende draft-07 y habria
 * dado un falso verde.
 *
 * ajv ignora `format` salvo que se le anada `ajv-formats`. No hace falta: Zod
 * emite ademas el `pattern` explicito, asi que la fecha se comprueba igual.
 * Es una propiedad del contrato que conviene no perder -un consumidor que solo
 * mire `format` no sabria que `+00:00` se admite y `Z` tambien-, y el caso de
 * la marca de tiempo la vigila.
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

/** Casos elegidos por lo que separan, no por cubrir campos. */
const CASOS: [nombre: string, documento: unknown, esperado: boolean][] = [
  ["el minimo valido", { slots: [] }, true],
  ["sin slots", {}, false],
  ["slots que no es lista", { slots: "dos" }, false],

  // Como sobrevive un .oim nuevo en un player viejo.
  ["clave desconocida arriba", { slots: [], clave_de_2027: 1 }, true],
  [
    "clave desconocida anidada en canvas",
    { slots: [], canvas: { natural_width: 10, natural_height: 5, futuro: 1 } },
    true,
  ],

  // Los dos formatos que fallaban en los .oim de produccion.
  ["marca de tiempo con desplazamiento", { slots: [], timestamp: "2026-06-12T20:38:40.713579+00:00" }, true],
  ["marca de tiempo con Z", { slots: [], timestamp: "2026-06-12T20:38:40Z" }, true],
  ["marca de tiempo sin zona", { slots: [], timestamp: "2026-06-12T20:38:40" }, false],
  ["marca de tiempo que no es fecha", { slots: [], timestamp: "ayer" }, false],
  ["color transparent", { slots: [{ id: "a", style: { fillColor: "transparent" } }] }, true],
  ["color hexadecimal", { slots: [{ id: "a", style: { fillColor: "#ffffff" } }] }, true],
  ["color con nombre CSS", { slots: [{ id: "a", style: { fillColor: "red" } }] }, false],
  ["color con url", { slots: [{ id: "a", style: { fillColor: "url(http://malo.io/x)" } }] }, false],

  // Limites numericos.
  ["posicion dentro del lienzo", { slots: [{ id: "a", position: [50, 50] }] }, true],
  ["posicion fuera del lienzo", { slots: [{ id: "a", position: [150, 50] }] }, false],

  /**
   * La discrepancia que encontro esta prueba. Zod exige dos elementos exactos;
   * el contrato salia con `prefixItems` sin limites, que en JSON Schema
   * significa «los dos primeros asi, los demas lo que sea». Un player ajeno
   * habria aceptado una posicion malformada y pintado donde le pareciera.
   */
  ["posicion de tres elementos", { slots: [{ id: "a", position: [10, 20, 30] }] }, false],
  ["posicion de un elemento", { slots: [{ id: "a", position: [10] }] }, false],
  ["canvas de anchura cero", { slots: [], canvas: { natural_width: 0, natural_height: 5 } }, false],
];

describe("el contrato publicado y Zod coinciden", () => {
  it.each(CASOS)("%s", (_nombre, documento, esperado) => {
    const zod = validarConZod(documento);
    const json = validarConElContrato(documento) as boolean;
    // Primero el acuerdo: es la propiedad que hace util al contrato.
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
