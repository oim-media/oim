/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { playerString } from "./strings";

describe("playerString", () => {
  it("answers in Spanish for an es-ES language", () => {
    expect(playerString("button", "es-ES")).toBe("Botón");
    expect(playerString("image", "es")).toBe("Imagen");
  });

  it("answers in English for any other language", () => {
    expect(playerString("button", "fr")).toBe("Button");
    expect(playerString("image", "fr")).toBe("Image");
  });

  it("answers in English when there is no language", () => {
    expect(playerString("button", undefined)).toBe("Button");
    expect(playerString("tampered", undefined).startsWith("Tampered file")).toBe(true);
  });

  it("keeps the Spanish tampered message exactly as it was", () => {
    expect(playerString("tampered", "es")).toBe(
      "Archivo alterado: no coincide con su firma. OIM no lo muestra."
    );
  });
});
