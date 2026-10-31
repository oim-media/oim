/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Que el paquete principal del player no cargue lo que no necesita.
 *
 * El player se incrusta en paginas de terceros. Cada kilobyte lo paga alguien
 * que no eligio usarlo, en una conexion que no controlamos, y una biblioteca
 * de mas es ademas superficie de ataque en un sitio ajeno.
 *
 * Hoy se esquivan dos pesos, y las dos maniobras son invisibles al leer:
 *
 *   - **zod** entra por el indice de `@oim-media/core`, que reexporta `schema.js`.
 *     Lo evitan DOS cosas, y conviene no confundirlas porque solo una es
 *     imprescindible: `binary.ts` y `grupos.ts` importan el FICHERO del modulo
 *     en vez del paquete, y `@oim-media/core` declara `sideEffects: false`, que es
 *     lo que autoriza al empaquetador a podar lo que nadie usa.
 *
 *     Medido: importar el indice a secas NO engorda el paquete -la poda se lo
 *     lleva-. Pero quitando ademas `sideEffects: false`, el paquete pasa de
 *     302.606 a 451.956 bytes, un 49 % mas, con zod dentro. La linea del
 *     manifiesto es la que sostiene esto, y era la que nadie vigilaba.
 *   - **lottie-web**: a dynamic `import()` does NOT split it here. The CDN
 *     build is a single `iife`, which inlines every `import()`. It stays out
 *     because the package build aliases `lottie_light` to `lottie-external.ts`,
 *     which loads it as a separate file (vendor/) only when a .oim needs it.
 *
 * Las dos se sostenian en un comentario. Un comentario no impide que el
 * proximo cambio escriba `from '@oim-media/core'` y anada zod entero al paquete que
 * sirve el CDN, sin que nada proteste y sin que nadie lo mida.
 *
 * En `.js` y no en `.ts`, por lo mismo que su vecino `dist-up-to-date.test.js`:
 * este paquete no tiene `@types/node`, asi que un `import "node:fs"` en
 * TypeScript suma errores al `typecheck`. Nacio en `.ts` el 27 de agosto y
 * anadio CINCO, que pasaron desapercibidos porque el filtro de aquel dia solo
 * miraba los ficheros que se estaban tocando.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = join(__dirname, "..");
const BUNDLE = join(__dirname, "..", "..", "dist", "oim-player.js");

function fuentes(dir) {
  const salida = [];
  for (const entrada of readdirSync(dir)) {
    const path = join(dir, entrada);
    if (statSync(path).isDirectory()) salida.push(...fuentes(path));
    else if (path.endsWith(".ts") && !path.endsWith(".test.ts") && !path.endsWith(".d.ts")) {
      salida.push(path);
    }
  }
  return salida;
}

const FUENTES = fuentes(SRC).map((path) => ({ path, text: readFileSync(path, "utf8") }));

describe("por donde puede colarse el peso", () => {
  it("hay fuentes que revisar", () => {
    // Sin esto la prueba pasaria en verde si la carpeta cambiara de sitio.
    expect(FUENTES.length).toBeGreaterThan(10);
  });

  /**
   * `@oim-media/core` a secas arrastra `schema.js`, y con el zod entero. Las rutas
   * al fichero del modulo y el subcamino `/api` son las dos formas seguras.
   */
  it("nadie importa el indice de @oim-media/core", () => {
    const culpables = [];
    for (const { path, text } of FUENTES) {
      // Solo el paquete pelado: `@oim-media/core/api` y `@oim-media/core/loQueSea` no.
      if (/from\s+["']@oim\/core["']/.test(text)) culpables.push(path);
      if (/import\s*\(\s*["']@oim\/core["']\s*\)/.test(text)) culpables.push(path);
    }
    expect(culpables).toEqual([]);
  });

  /**
   * La linea de la que depende todo lo anterior. Sin ella, el empaquetador no
   * puede podar lo que el indice reexporta y basta UNA importacion del paquete
   * -que la regla de arriba impide, pero las reglas se editan- para meter zod
   * entero en lo que sirve el CDN.
   */
  it("@oim-media/core sigue declarando sideEffects: false", () => {
    const manifiesto = JSON.parse(
      readFileSync(join(__dirname, "..", "..", "..", "core", "package.json"), "utf8"),
    );
    expect(manifiesto.sideEffects).toBe(false);
  });

  /**
   * Un `import` estatico de lottie lo mete en el paquete principal aunque
   * ningun `.oim` lo use nunca. Dinamico, viaja en su propio trozo.
   */
  it("lottie solo se importa de forma dinamica", () => {
    const culpables = [];
    for (const { path, text } of FUENTES) {
      for (const linea of text.split("\n")) {
        if (!/lottie/i.test(linea)) continue;
        // The rule is about the LIBRARY: a static import of lottie-web puts it
        // in the bundle. Our own lottie-loader.ts is the gate to it and must be
        // importable statically, so match the package name, not any path that
        // happens to contain "lottie".
        if (/^\s*import\s+[^(]*from\s+["']lottie-web/.test(linea)) culpables.push(`${path}: ${linea.trim()}`);
        if (/^\s*import\s+["']lottie-web/.test(linea)) culpables.push(`${path}: ${linea.trim()}`);
      }
    }
    expect(culpables).toEqual([]);
  });
});

/**
 * La comprobacion sobre el artefacto. Es secundaria a proposito: un `dist`
 * viejo puede pasar mientras la fuente ya esta rota, y por eso las reglas de
 * arriba son las que mandan. Pero si el paquete construido lleva zod dentro,
 * eso es cierto pase lo que pase.
 */
describe("el paquete construido, si existe", () => {
  const hayPaquete = existsSync(BUNDLE);
  const bundle = hayPaquete ? readFileSync(BUNDLE, "utf8") : "";

  it.skipIf(!hayPaquete)("no contiene zod", () => {
    // Varias huellas: los nombres de clase se pueden minificar, las cadenas de
    // los codigos de error no.
    const huellas = ["ZodError", "invalid_union_discriminator", "too_big", "$ZodType"];
    const encontradas = huellas.filter((h) => bundle.includes(h));
    expect(encontradas).toEqual([]);
  });

  it.skipIf(!hayPaquete)("no contiene lottie en el trozo principal", () => {
    // `bodymovin` is Lottie's own runtime name and survives minification: it
    // appears twice in lottie_light.min.js. The previous fingerprint,
    // `AnimationItem`, appears zero times even in Lottie itself, so this test
    // stayed green while Lottie made up half of the bundle.
    expect(bundle.includes("bodymovin")).toBe(false);
  });
});

describe("lottie viaja aparte del player", () => {
  const DIST = join(__dirname, "..", "..", "dist");
  const hayPaquete = existsSync(BUNDLE);

  // A budget, not a target: each raise is a deliberate decision recorded in
  // the commit that makes it. Last raise: 59 KB for reveal and play (1.22.0).
  it.skipIf(!hayPaquete)("el player cabe en 59 KB gzip", async () => {
    const { gzipSync } = await import("node:zlib");
    const kb = gzipSync(readFileSync(BUNDLE)).length / 1024;
    expect(Math.round(kb)).toBeLessThanOrEqual(59);
  });

  it.skipIf(!hayPaquete)("el archivo de lottie esta junto a las dos rutas del player", () => {
    const version = JSON.parse(readFileSync(join(__dirname, "..", "..", "node_modules", "lottie-web", "package.json"), "utf8")).version;
    for (const dir of [join(DIST, "vendor"), join(DIST, "player", "v1", "vendor")]) {
      const file = join(dir, `lottie_light-${version}.js`);
      expect(existsSync(file)).toBe(true);
      expect(readFileSync(file, "utf8").includes("bodymovin")).toBe(true);
    }
  });
});

