/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Que el esquema acepte los .oim que el sistema realmente produce.
 *
 * Nada validaba un fichero real contra `schema.ts`. Al generar el contrato en
 * JSON Schema se probo por primera vez, y los CUATRO .oim de produccion
 * fallaban:
 *
 *   - `timestamp` valia `2026-06-12T20:38:40.713579+00:00` -isoformat de
 *     Python- y el esquema exigia la forma con `Z`. Ambas son RFC 3339.
 *   - `style.color` valia `transparent`, que el editor escribe y el regex de
 *     colores no contemplaba.
 *
 * En los dos casos el equivocado era el esquema, no el fichero. Un esquema que
 * nadie ejecuta deriva de la realidad igual que una copy de codigo deriva de
 * su original, y por la misma razon: nada lo contradice.
 *
 * Esto importa mas ahora que el contrato se publica. Un player en Swift que
 * validara contra el JSON Schema habria rechazado el 100 % de los ficheros
 * reales, y su autor no habria tenido forma de saber quien tenia razon.
 *
 * Solo se leen ficheros de `public/`, nunca de `dist/`: `dist/` es salida de
 * compilacion y en un clon limpio no existe, asi que la prueba pasaria sin
 * mirar nada.
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
      // The landing ships its works as .oim.png since 11 Oct 2026; both are .oim.
      if (/\.oim(\.png)?$/.test(f)) encontrados.push(join(dir, f));
    }
  }
  return encontrados.sort();
}

const FICHEROS = ficherosReales();

describe("los .oim publicados validan contra su propio esquema", () => {
  /**
   * Sin esto la suite pasaria en verde el dia que alguien mueva o renombre las
   * carpetas: cero ficheros encontrados, cero comprobaciones, todo correcto.
   */
  it("encuentra ficheros que comprobar", () => {
    expect(FICHEROS.length).toBeGreaterThanOrEqual(2);
  });

  it.each(FICHEROS)("%s valida", async (ruta) => {
    const { metadata } = await extractOIM(new Blob([readFileSync(ruta)]));
    const resultado = OimMetadataSchema.safeParse(metadata);
    const problemas = resultado.success
      ? []
      : resultado.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    expect(problemas).toEqual([]);
  });
});

describe("los dos formatos que fallaban", () => {
  /** El backend usa `+00:00`; exigir `Z` rechazaba todo lo firmado. */
  it("admite la marca de tiempo con desplazamiento, no solo con Z", () => {
    const base = { slots: [] };
    expect(OimMetadataSchema.safeParse({ ...base, timestamp: "2026-06-12T20:38:40.713579+00:00" }).success).toBe(true);
    expect(OimMetadataSchema.safeParse({ ...base, timestamp: "2026-06-12T20:38:40Z" }).success).toBe(true);
    // Y sigue rechazando lo que no es una fecha, que es para lo que existe.
    expect(OimMetadataSchema.safeParse({ ...base, timestamp: "ayer por la tarde" }).success).toBe(false);
  });

  it("admite transparent sin abrir la mano con otros colores", () => {
    const conColor = (color: string) =>
      OimMetadataSchema.safeParse({ slots: [{ id: "a", style: { fillColor: color } }] }).success;
    expect(conColor("transparent")).toBe(true);
    expect(conColor("#ffffff")).toBe(true);
    // `transparent` es una palabra clave exacta: no debe colar sus vecinas.
    expect(conColor("transparente")).toBe(false);
    expect(conColor("url(http://malo.io/x)")).toBe(false);
    expect(conColor("red")).toBe(false);
  });
});
