/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Las fuentes incrustadas se registran en los DOS caminos de carga.
 *
 * El player carga por un worker cuando el navegador lo permite y por el hilo
 * principal cuando no. Las pruebas en happy-dom solo ven el segundo, y ahi se
 * enganchaba el registro: en Chrome el .oim llevaba sus fuentes y el player las
 * seguia pidiendo a Google. Montar el worker aqui exigiria un .oim firmado;
 * esto al menos fija que ninguno de los dos caminos se quede sin el registro.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("los dos caminos de carga registran las fuentes incrustadas", () => {
  it("hay un registro en cada uno", () => {
    const fuente = readFileSync(join(__dirname, "ImageEngine.ts"), "utf8");
    const registros = fuente.split("registerEmbeddedFonts(readEmbeddedFonts(").length - 1;
    expect(registros).toBe(2);
  });
});
