/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { normalizeLegacyKeys } from "./legacyKeys";
import { permissionOf, signatureStamp } from "./reeditPermission";
import { extractOIM } from "./binary";
import { REFERENCE_OIM } from "../test/fixtures/index";

describe("normalizeLegacyKeys", () => {
  it.each([
    [{ reedicion: "publico" }, { reedit: "public" }],
    [{ reedicion: "solo_autor" }, { reedit: "author_only" }],
    [{ reedicion: "sellado" }, { reedit: "sealed" }],
    [{ reedit: "public" }, { reedit: "public" }],
    [{ reedicion: "publico", reedit: "sealed" }, { reedit: "sealed" }],
    [{ reedicion: "xyz" }, { reedit: "author_only" }],
    [{}, {}],
  ])("normalizes %j", (input, out) => {
    expect(normalizeLegacyKeys(input)).toEqual(out);
  });

  it("does not mutate its input", () => {
    const m = { reedicion: "publico" };
    normalizeLegacyKeys(m);
    expect(m).toEqual({ reedicion: "publico" });
  });

  it("an unknown value in reedit is author_only, never public", () => {
    expect(normalizeLegacyKeys({ reedit: "PUBLIC" })).toEqual({ reedit: "author_only" });
  });

  it("leaves unrelated keys alone", () => {
    expect(normalizeLegacyKeys({ name: "x", reedicion: "publico" })).toEqual({ name: "x", reedit: "public" });
  });

  it("a signed file from before 1.23.0 is read as public, with the authorless seal", async () => {
    // The signature is checked over the original bytes (see the player test
    // reference-fixture.test.ts); normalization only runs afterwards.
    const { metadata } = await extractOIM(new Blob([readFileSync(REFERENCE_OIM)], { type: "image/png" }));
    expect(metadata.reedicion).toBe("publico");
    const normalized = normalizeLegacyKeys(metadata);
    expect(normalized.reedit).toBe("public");
    expect(signatureStamp(permissionOf(normalized))).toBe("verified_authorless");
  });
});
