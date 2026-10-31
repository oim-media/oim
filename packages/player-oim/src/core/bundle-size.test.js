/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The player's main package must not load what it does not need.
 *
 * The player is embedded in third-party pages. Every kilobyte is paid by someone
 * who did not choose to use it, on a connection we do not control, and an extra
 * library is also attack surface on a foreign site.
 *
 * Today two weights are avoided, and both maneuvers are invisible when reading:
 *
 *   - **zod** comes in through the index of `@oim-media/core`, which re-exports
 *     `schema.js`. Two things avoid it, and it is worth not confusing them,
 *     because only one is indispensable: `binary.ts` and `grupos.ts` import the
 *     module FILE instead of the package, and `@oim-media/core` declares
 *     `sideEffects: false`, which is what authorizes the bundler to prune what
 *     nobody uses.
 *
 *     Measured: importing the bare index does NOT bloat the package -pruning
 *     takes care of it-. But removing `sideEffects: false` as well, the package
 *     goes from 302,606 to 451,956 bytes, 49% more, with zod inside. The line in
 *     the manifest is the one that holds this up, and it was the one nobody watched.
 *   - **lottie-web**: a dynamic `import()` does NOT split it here. The CDN
 *     build is a single `iife`, which inlines every `import()`. It stays out
 *     because the package build aliases `lottie_light` to `lottie-external.ts`,
 *     which loads it as a separate file (vendor/) only when a .oim needs it.
 *
 * The two were held up only by a comment. A comment does not stop the next
 * change from writing `from '@oim-media/core'` and adding all of zod to the
 * package the CDN serves, with nothing objecting and nobody measuring it.
 *
 * In `.js` and not `.ts`, for the same reason as its neighbor `dist-up-to-date.test.js`:
 * this package has no `@types/node`, so an `import "node:fs"` in TypeScript adds
 * errors to the `typecheck`. It was first written in `.ts` and added FIVE errors,
 * which went unnoticed because the filter at the time only looked at the files
 * being touched.
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
    // Without this, the test would pass green if the folder moved.
    expect(FUENTES.length).toBeGreaterThan(10);
  });

  /**
   * `@oim-media/core` bare drags in `schema.js`, and with it all of zod. The
   * paths to the module file and the `/api` subpath are the two safe forms.
   */
  it("nadie importa el indice de @oim-media/core", () => {
    const culpables = [];
    for (const { path, text } of FUENTES) {
      // Only the bare package: `@oim-media/core/api` and `@oim-media/core/loQueSea` (a placeholder name) are not.
      if (/from\s+["']@oim\/core["']/.test(text)) culpables.push(path);
      if (/import\s*\(\s*["']@oim\/core["']\s*\)/.test(text)) culpables.push(path);
    }
    expect(culpables).toEqual([]);
  });

  /**
   * The line that everything above depends on. Without it, the bundler cannot
   * prune what the index re-exports, and it takes just ONE import of the package
   * -which the rule above prevents, but rules get edited- to put all of zod
   * into what the CDN serves.
   */
  it("@oim-media/core sigue declarando sideEffects: false", () => {
    const manifiesto = JSON.parse(
      readFileSync(join(__dirname, "..", "..", "..", "core", "package.json"), "utf8"),
    );
    expect(manifiesto.sideEffects).toBe(false);
  });

  /**
   * A static `import` of lottie pulls it into the main package even if no
   * `.oim` ever uses it. Dynamic, it travels in its own chunk.
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
 * The check on the artifact. It is secondary on purpose: an old `dist` can pass
 * while the source is already broken, which is why the rules above take
 * precedence. But if the built package carries zod inside, that is true no
 * matter what passes.
 */
describe("el paquete construido, si existe", () => {
  const hayPaquete = existsSync(BUNDLE);
  const bundle = hayPaquete ? readFileSync(BUNDLE, "utf8") : "";

  it.skipIf(!hayPaquete)("no contiene zod", () => {
    // Several fingerprints: class names can be minified, error-code strings cannot.
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

