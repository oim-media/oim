/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * El veredicto de seguridad, en UN solo sitio.
 *
 * Habia dos copias, una por camino de carga, y ya no decian lo mismo: la del
 * hilo principal distinguia «firmado sin autoria» y la del worker -la que usan
 * casi todos los navegadores- decia siempre «verificado».
 *
 * Y la firma no miraba la imagen: metadatos firmados sobre otra imagen salian
 * «verificados». Ahora el sello `image_hash` se compara con el hash real, y un
 * archivo alterado no se muestra.
 *
 * PERO solo si el archivo declara `image_hash_alg: "sha256-idat"`. En junio de
 * 2026 un cliente mandaba su propio `image_hash` y el backend lo firmaba sin
 * mirarlo: `object_view.oim` lleva el SHA-256 de una entrada VACIA. Exigir esos
 * hashes rechazaria como alterados archivos legitimos.
 */

import { describe, it, expect } from "vitest";
import { securityVerdict, isRefused } from "./security";

const HASH = "a".repeat(64);
const ALG = "sha256-idat";
/** SHA-256 de nada: lo que lleva firmado `object_view.oim`, de junio. */
const HASH_DE_NADA = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const base = { isSigned: true, isSigValid: true, imageHash: HASH };
const sellado = (extra: object = {}) => ({ image_hash: HASH, image_hash_alg: ALG, ...extra });

describe("securityVerdict", () => {
  it("firma valida y la imagen casa con el sello: verificado", () => {
    expect(securityVerdict({ ...base, metadata: sellado() })).toBe("verified");
  });

  it("el sello se compara sin distinguir mayusculas", () => {
    expect(securityVerdict({ ...base, metadata: sellado({ image_hash: HASH.toUpperCase() }) })).toBe("verified");
  });

  it("un archivo publico que casa: firmado sin autoria", () => {
    expect(securityVerdict({ ...base, metadata: sellado({ reedicion: "publico" }) })).toBe("verified_sin_autoria");
  });

  it("la imagen no casa con el sello: alterada", () => {
    expect(securityVerdict({ ...base, metadata: sellado({ image_hash: "b".repeat(64) }) })).toBe("image_mismatch");
  });

  it("hay sello pero no se pudo calcular el hash: alterada, nunca verificada", () => {
    expect(securityVerdict({ ...base, imageHash: null, metadata: sellado() })).toBe("image_mismatch");
  });

  it("firmado sin sello de imagen: sin sello", () => {
    expect(securityVerdict({ ...base, metadata: {} })).toBe("image_unsealed");
  });

  it("un image_hash antiguo sin algoritmo NO se exige, aunque no case", () => {
    expect(securityVerdict({ ...base, metadata: { image_hash: HASH_DE_NADA } })).toBe("image_unsealed");
    expect(securityVerdict({ ...base, metadata: { image_hash: "b".repeat(64) } })).toBe("image_unsealed");
  });

  it("un algoritmo que este player no conoce: sin sello, no alterado", () => {
    expect(securityVerdict({ ...base, metadata: sellado({ image_hash_alg: "blake3-futuro" }) })).toBe("image_unsealed");
  });

  it("firma invalida gana a todo lo de la imagen", () => {
    expect(securityVerdict({ ...base, isSigValid: false, metadata: sellado({ image_hash: "b".repeat(64) }) }))
      .toBe("invalid_signature");
  });

  it("sin firma: legacy", () => {
    expect(securityVerdict({ ...base, isSigned: false, metadata: {} })).toBe("unsigned");
  });

  // «dominio bloqueado gana a todo» se retiro con `allowed_domains` (sandbox,
  // 24 sept 2026): el player ya no mira en que sitio se abre un archivo.
  // Lo protege sandbox-sin-red.test.ts.
});

describe("isRefused", () => {
  it("un archivo alterado no se muestra: ni la imagen ni los metadatos", () => {
    expect(isRefused("image_mismatch")).toBe(true);
    expect(isRefused("invalid_signature")).toBe(true);
  });

  it("el resto de estados si se muestran", () => {
    for (const s of ["verified", "verified_sin_autoria", "image_unsealed", "unsigned"] as const) {
      expect(isRefused(s)).toBe(false);
    }
  });
});
