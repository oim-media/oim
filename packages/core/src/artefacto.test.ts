/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * That what gets packaged is what is in `src`, and nothing more.
 *
 * `superficie-publicada.test.ts` watches the EXPORTS of the source code.
 * This watches the ARTIFACT, which is what really travels: `files: ["dist"]`
 * puts everything in that directory into the tarball, whether it was produced by
 * today's build or the one from three months ago. `tsc` deletes nothing when it recompiles.
 *
 * Measured when preparing the first `pnpm pack`. The tarball carried:
 *
 *   - `binary.test.js`, `integration.test.js`, `schema.test.js`: the compiled tests, from
 *     before `tsconfig` excluded them;
 *   - `dist/src/`: a whole duplicated tree, from when `rootDir` was something else;
 *   - **`serialize.js`**, whose source was DELETED on purpose. The comment that its
 *     deletion left in `index.ts` explains why: it anchored the position to the centre of
 *     the slot (`anchorX += w / 2`) while the real compiler, the backend's, anchors it to the
 *     top-left corner. "A third party integrating against this package would have got
 *     everything shifted by half a box, with no error
 *     to give it away."
 *
 * So the file was taken out of the source so that nobody would receive it, and it would
 * have been distributed anyway. Deleting the code did not delete the artifact.
 *
 * The build now cleans `dist` before compiling. This watches that it keeps doing so,
 * and that nobody lets anything stray drop in there.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const RAIZ = join(__dirname, "..");
const SRC = join(RAIZ, "src");
const DIST = join(RAIZ, "dist");

/** Relative paths of everything inside, including subdirectories. */
function contenido(dir: string, prefijo = ""): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefijo ? `${prefijo}/${entrada.name}` : entrada.name;
    if (entrada.isDirectory()) salida.push(...contenido(join(dir, entrada.name), rel));
    else salida.push(rel);
  }
  return salida.sort();
}

function masReciente(dir: string): number {
  let max = 0;
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const ruta = join(dir, entrada.name);
    if (entrada.isDirectory()) max = Math.max(max, masReciente(ruta));
    else if (entrada.name.endsWith(".ts") && !entrada.name.endsWith(".test.ts")) {
      max = Math.max(max, statSync(ruta).mtimeMs);
    }
  }
  return max;
}

/**
 * The modules of `src`, with their relative path and without extension.
 *
 * It walks the subdirectories since `generative/` lives here: 21 files that
 * were previously duplicated byte for byte in both repositories. Looking only at the
 * first level would leave 1,974 lines of the artifact unwatched.
 *
 * Files that are not `.ts` (such as `__baseline_snapshots__.json`, which a test reads)
 * are not compiled, so they do not appear in `dist` and do not count.
 */
function modulosDe(dir: string, prefijo = ""): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefijo ? `${prefijo}/${entrada.name}` : entrada.name;
    if (entrada.isDirectory()) salida.push(...modulosDe(join(dir, entrada.name), rel));
    else if (entrada.name.endsWith(".ts") && !entrada.name.endsWith(".test.ts")) {
      salida.push(rel.replace(/\.ts$/, ""));
    }
  }
  return salida.sort();
}

const MODULOS = modulosDe(SRC);

describe("el artefacto que se empaqueta", () => {
  it("existe", () => {
    expect(existsSync(DIST), "no hay dist/. Ejecuta `pnpm --filter @oim-media/core build`").toBe(true);
  });

  /**
   * The check that bites: any extra file (a compiled test, a module deleted from
   * the source, an old tree) shows up here as a name that `src` does not
   * have.
   */
  it("contiene exactamente los modulos de src, ni uno mas", () => {
    const esperado = MODULOS.flatMap((m) => [`${m}.d.ts`, `${m}.js`]).sort();
    expect(contenido(DIST)).toEqual(esperado);
  });

  it("no lleva pruebas compiladas", () => {
    expect(contenido(DIST).filter((f) => /\.test\.(js|d\.ts)$/.test(f))).toEqual([]);
  });

  /**
   * `dist/src/` came to exist with a whole copy of the package: a consumer
   * that imported through that path would get another version of the same code.
   *
   * The rule can no longer be "no subdirectory" (`generative/` is a legitimate one),
   * so it checks that whatever is there comes out of `src`. A `dist/src/` has no counterpart
   * there and still fails.
   */
  it("sus subdirectorios son los de src, y no otros", () => {
    const enDist = new Set(
      contenido(DIST).filter((f) => f.includes("/")).map((f) => f.split("/")[0]),
    );
    const enSrc = new Set(MODULOS.filter((m) => m.includes("/")).map((m) => m.split("/")[0]));
    expect([...enDist].sort()).toEqual([...enSrc].sort());
  });

  /**
   * Without this, all of the above can pass green on last week's build while `src` already
   * says something else. It is the same failure that `dist-al-dia.test.js` watches for in the
   * player.
   */
  it("no es mas viejo que src", () => {
    const construido = Math.max(...contenido(DIST).map((f) => statSync(join(DIST, f)).mtimeMs));
    const fuente = masReciente(SRC);
    const atraso = Math.round((fuente - construido) / 1000);
    expect(
      construido >= fuente,
      `dist/ va ${atraso}s por detras de src/. Ejecuta \`pnpm --filter @oim-media/core build\``,
    ).toBe(true);
  });
});
