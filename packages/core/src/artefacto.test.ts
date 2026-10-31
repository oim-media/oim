/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Que lo que se empaqueta sea lo que hay en `src`, y nada mas.
 *
 * `superficie-publicada.test.ts` vigila las EXPORTACIONES del codigo fuente.
 * Esto vigila el ARTEFACTO, que es lo que de verdad viaja: `files: ["dist"]`
 * mete en el tarball todo lo que haya en ese directorio, lo genere el build de
 * hoy o el de hace tres meses. `tsc` no borra nada al recompilar.
 *
 * Medido el 27/08/2026, al preparar el primer `pnpm pack`. El tarball llevaba:
 *
 *   - `binary.test.js`, `integration.test.js`, `schema.test.js` - las pruebas
 *     compiladas, de antes de que `tsconfig` las excluyera;
 *   - `dist/src/` - un arbol duplicado entero, de cuando `rootDir` era otro;
 *   - **`serialize.js`**, cuyo fuente se BORRO a proposito. El comentario que
 *     dejo su borrado en `index.ts` explica por que: anclaba la posicion al
 *     centro del slot -`anchorX += w / 2`- mientras el compilador real, el del
 *     backend, la ancla a la esquina superior izquierda, «un tercero que
 *     integrara contra este paquete habria obtenido todo desplazado media
 *     caja, sin ningun error que lo delatara».
 *
 * O sea que el fichero se quito del fuente para que nadie lo recibiera, y se
 * habria distribuido igual. Borrar el codigo no borro el artefacto.
 *
 * El build ahora limpia `dist` antes de compilar. Esto vigila que siga
 * haciendolo, y que nadie deje caer nada suelto ahi.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const RAIZ = join(__dirname, "..");
const SRC = join(RAIZ, "src");
const DIST = join(RAIZ, "dist");

/** Rutas relativas de todo lo que hay dentro, incluidos subdirectorios. */
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
 * Los modulos de `src`, con su ruta relativa y sin extension.
 *
 * Recorre los subdirectorios desde que `generative/` vive aqui: 21 ficheros que
 * antes estaban duplicados byte a byte en los dos repositorios. Mirar solo el
 * primer nivel dejaria 1.974 lineas del artefacto sin vigilar.
 *
 * Los ficheros que no son `.ts` -como `__baseline_snapshots__.json`, que lee una
 * prueba- no se compilan, asi que no aparecen en `dist` y no cuentan.
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
   * La comprobacion que muerde: cualquier fichero de mas -una prueba
   * compilada, un modulo borrado del fuente, un arbol viejo- aparece aqui como
   * un nombre que `src` no tiene.
   */
  it("contiene exactamente los modulos de src, ni uno mas", () => {
    const esperado = MODULOS.flatMap((m) => [`${m}.d.ts`, `${m}.js`]).sort();
    expect(contenido(DIST)).toEqual(esperado);
  });

  it("no lleva pruebas compiladas", () => {
    expect(contenido(DIST).filter((f) => /\.test\.(js|d\.ts)$/.test(f))).toEqual([]);
  });

  /**
   * `dist/src/` llego a existir con una copy entera del paquete: un consumidor
   * que importara por esa ruta recibiria otra version del mismo codigo.
   *
   * La regla ya no puede ser «ningun subdirectorio» —`generative/` es uno
   * legitimo— asi que se comprueba que los que haya salgan de `src`. Un
   * `dist/src/` no tiene contrapartida ahi y sigue cayendo.
   */
  it("sus subdirectorios son los de src, y no otros", () => {
    const enDist = new Set(
      contenido(DIST).filter((f) => f.includes("/")).map((f) => f.split("/")[0]),
    );
    const enSrc = new Set(MODULOS.filter((m) => m.includes("/")).map((m) => m.split("/")[0]));
    expect([...enDist].sort()).toEqual([...enSrc].sort());
  });

  /**
   * Sin esto, todo lo de arriba puede pasar en verde sobre el build de la
   * semana pasada mientras `src` ya dice otra cosa. Es el mismo fallo que
   * `dist-al-dia.test.js` vigila en el player.
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
