/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `oim-player.test.js` importa `../dist/oim-player.js`: prueba el PAQUETE
 * CONSTRUIDO, no la fuente.
 *
 * Eso lo convierte en un generador de falsos verdes. El 21 de agosto sus siete
 * pruebas estuvieron en verde toda la mañana validando el build de la vispera,
 * mientras la fuente cambiaba debajo. Solo se pusieron en rojo al reconstruir
 * `dist/` para desplegar —es decir, al final, cuando ya no avisaban de nada—.
 *
 * Esta guardia no arregla el diseño de aquel archivo. Hace lo unico que se
 * puede hacer barato: gritar cuando el build es mas viejo que la fuente, para
 * que su verde signifique algo.
 *
 * En `.js` y no en `.ts` por lo mismo que su vecino `oim-player.test.js`: este
 * paquete no tiene `@types/node`, asi que un `import "node:fs"` en TypeScript
 * suma tres errores al typecheck. Esta anotado en PENDIENTE.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const construido = path.join(raiz, "dist", "oim-player.js");
const fuente = path.join(raiz, "src");

/** El archivo de fuente modificado mas recientemente. */
function masReciente(dir) {
  let max = 0;
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entrada.name);
    if (entrada.isDirectory()) max = Math.max(max, masReciente(entryPath));
    else if (/\.(ts|js)$/.test(entrada.name) && !/\.test\.[tj]s$/.test(entrada.name)) {
      max = Math.max(max, fs.statSync(entryPath).mtimeMs);
    }
  }
  return max;
}

describe("el paquete construido no puede ser mas viejo que la fuente", () => {
  it("existe dist/oim-player.js", () => {
    expect(
      fs.existsSync(construido),
      "no hay build. `oim-player.test.js` lo importa: ejecuta `pnpm build`."
    ).toBe(true);
  });

  it("y se construyo DESPUES del ultimo cambio en src/", () => {
    const construidoEn = fs.statSync(construido).mtimeMs;
    const fuenteEn = masReciente(fuente);
    const atraso = Math.round((fuenteEn - construidoEn) / 1000);
    expect(
      construidoEn >= fuenteEn,
      `dist/oim-player.js va ${atraso}s por detras de src/. Las siete pruebas de ` +
      `\`oim-player.test.js\` estan validando el build ANTERIOR y su verde no ` +
      `significa nada. Ejecuta \`pnpm build\`.`
    ).toBe(true);
  });
});
