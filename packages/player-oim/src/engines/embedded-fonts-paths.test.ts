/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Embedded fonts are registered on BOTH loading paths.
 *
 * The player loads through a worker when the browser allows it and through the
 * main thread when it does not. The happy-dom tests only see the second path,
 * and that is where registration was hooked: in Chrome the .oim carried its
 * fonts but the player kept requesting them from Google. Mounting the worker
 * here would require a signed .oim; this at least pins down that neither path
 * is left without registration.
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
