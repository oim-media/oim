/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `oim-player.test.js` imports `../dist/oim-player.js`: it tests the BUILT
 * package, not the source.
 *
 * That makes it a generator of false greens. Its seven tests stayed green all morning,
 * validating the build from the day before, while the source changed underneath.
 * They only turned red when `dist/` was rebuilt to deploy, that is, at the end,
 * when they no longer warned of anything.
 *
 * This guard does not fix that file's design. It does the one cheap thing that
 * can be done: shout when the build is older than the source, so that its green
 * means something.
 *
 * In `.js` and not `.ts` for the same reason as its neighbour `oim-player.test.js`: this
 * package has no `@types/node`, so an `import "node:fs"` in TypeScript adds three errors
 * to the typecheck. It is noted as pending.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const construido = path.join(raiz, "dist", "oim-player.js");
const fuente = path.join(raiz, "src");

/** The most recently modified source file. */
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
