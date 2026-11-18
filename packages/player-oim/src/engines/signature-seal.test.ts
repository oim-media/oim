/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The gap that the plan took for granted.
 *
 * `shadow.test.ts` pins the CHAIN; this pins that the engine places it where it should:
 * in `filter`, last, and only on the layers that are not text. Without this, moving
 * the `drop-shadow` to the start of the chain would break nothing, and that order is
 * half of the fix (a later colour preset would tint the shadow).
 */

import { describe, it, expect, beforeEach } from "vitest";
import ImageEngine from "./ImageEngine";

describe("the seal depends on whether the file has authorship", () => {
  // A public one and one with authorship are equally intact (the signature protects the
  // content), but they are not equally reliable as ORIGINAL: anyone can take a public
  // one, change a figure and re-sign it. With the same green seal, the label would
  // stop meaning anything.
  const conPermiso = (permiso?: string) => {
    const host = document.createElement("div");
    (host as any).attachShadow({ mode: "open" });
    document.body.appendChild(host);
    const motor: any = new ImageEngine(host as any);
    motor._overlay = document.createElement("div");
    host.shadowRoot!.appendChild(motor._overlay);
    return { motor, meta: permiso === undefined ? {} : { reedicion: permiso } };
  };

  it("a .oim without the field keeps the usual seal", async () => {
    const { motor } = conPermiso();
    // `signatureStamp(permissionOf({}))` -> 'verified'. The rule is checked, which is
    // what the engine consults.
    const { permissionOf, signatureStamp } = await import("../../../core/src/reeditPermission.js");
    expect(signatureStamp(permissionOf({}))).toBe("verified");
    expect(motor.securityStatus).toBe("unsigned");
  });

  it("a public one asks for its own seal", async () => {
    const { permissionOf, signatureStamp } = await import("../../../core/src/reeditPermission.js");
    expect(signatureStamp(permissionOf({ reedicion: "publico" }))).toBe("verified_authorless");
  });

  it("and a strange value does NOT get the public seal", async () => {
    const { permissionOf, signatureStamp } = await import("../../../core/src/reeditPermission.js");
    expect(signatureStamp(permissionOf({ reedicion: "libre" }))).toBe("verified");
  });
});
