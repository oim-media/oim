/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The security verdict, in ONE single place.
 *
 * There were two copies, one per loading path, and they no longer said the same
 * thing: the main thread distinguished "signed without authorship", while the
 * worker's -the one almost all browsers use- always said "verified".
 *
 * And the signature did not check the image: signed metadata over a different
 * image came out "verified". Now the `image_hash` seal is compared with the real
 * hash, and an altered file is not shown.
 *
 * BUT only if the file declares `image_hash_alg: "sha256-idat"`. Once, a client
 * sent its own `image_hash` and the backend signed it without checking it:
 * an early real file carried the SHA-256 of an EMPTY input. Requiring those
 * hashes would reject legitimate files as altered.
 */

import { describe, it, expect } from "vitest";
import { securityVerdict, isRefused } from "./security";

const HASH = "a".repeat(64);
const ALG = "sha256-idat";
/** SHA-256 of nothing: what that early real file carried signed. */
const HASH_DE_NADA = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const base = { isSigned: true, isSigValid: true, imageHash: HASH };
const sellado = (extra: object = {}) => ({ image_hash: HASH, image_hash_alg: ALG, ...extra });

describe("securityVerdict", () => {
  it("valid signature and the image matches the seal: verified", () => {
    expect(securityVerdict({ ...base, metadata: sellado() })).toBe("verified");
  });

  it("the seal is compared case-insensitively", () => {
    expect(securityVerdict({ ...base, metadata: sellado({ image_hash: HASH.toUpperCase() }) })).toBe("verified");
  });

  it("a public file that matches: signed without authorship", () => {
    expect(securityVerdict({ ...base, metadata: sellado({ reedicion: "publico" }) })).toBe("verified_sin_autoria");
  });

  it("the image does not match the seal: altered", () => {
    expect(securityVerdict({ ...base, metadata: sellado({ image_hash: "b".repeat(64) }) })).toBe("image_mismatch");
  });

  it("there is a seal but the hash could not be computed: altered, never verified", () => {
    expect(securityVerdict({ ...base, imageHash: null, metadata: sellado() })).toBe("image_mismatch");
  });

  it("signed without an image seal: no seal", () => {
    expect(securityVerdict({ ...base, metadata: {} })).toBe("image_unsealed");
  });

  it("an old image_hash without an algorithm is NOT required, even if it does not match", () => {
    expect(securityVerdict({ ...base, metadata: { image_hash: HASH_DE_NADA } })).toBe("image_unsealed");
    expect(securityVerdict({ ...base, metadata: { image_hash: "b".repeat(64) } })).toBe("image_unsealed");
  });

  it("an algorithm this player does not know: no seal, not altered", () => {
    expect(securityVerdict({ ...base, metadata: sellado({ image_hash_alg: "blake3-futuro" }) })).toBe("image_unsealed");
  });

  it("an invalid signature beats everything about the image", () => {
    expect(securityVerdict({ ...base, isSigValid: false, metadata: sellado({ image_hash: "b".repeat(64) }) }))
      .toBe("invalid_signature");
  });

  it("no signature: legacy", () => {
    expect(securityVerdict({ ...base, isSigned: false, metadata: {} })).toBe("unsigned");
  });

  // "a blocked domain beats everything" was removed together with
  // `allowed_domains` (the sandbox): the player no longer checks which site a
  // file is opened on. `sandbox-no-network.test.ts` protects this.
});

describe("isRefused", () => {
  it("an altered file is not shown: neither the image nor the metadata", () => {
    expect(isRefused("image_mismatch")).toBe(true);
    expect(isRefused("invalid_signature")).toBe(true);
  });

  it("the other states are still shown", () => {
    for (const s of ["verified", "verified_sin_autoria", "image_unsealed", "unsigned"] as const) {
      expect(isRefused(s)).toBe(false);
    }
  });
});
