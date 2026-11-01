/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SHARED and CANONICAL TABLE. It is copied as-is to the editor: the same cases
 * run on both sides. The table travelling with the module is what prevents
 * a copy from deciding by itself what an unknown value means.
 */

import { describe, it, expect } from "vitest";
import {
  permissionOf, canReedit, mustRejectWithoutAsking, registryQuery, signatureStamp,
  permissionFields, DEFAULT_PERMISSION,
} from "./reeditPermission";

describe("reading the permission from the file", () => {
  it("a .oim WITHOUT the field is `solo_autor`", () => {
    // These are ALL that exist today: none of the 14 real files carries it.
    // With this default nothing changes for what is already published.
    expect(permissionOf({})).toBe("solo_autor");
    expect(permissionOf({ name: "x" })).toBe("solo_autor");
  });

  it("reads the three valid values", () => {
    expect(permissionOf({ reedicion: "publico" })).toBe("publico");
    expect(permissionOf({ reedicion: "solo_autor" })).toBe("solo_autor");
    expect(permissionOf({ reedicion: "sellado" })).toBe("sellado");
  });

  it("an UNKNOWN value falls back to `solo_autor`, never to `publico`", () => {
    // The rule that stops corrupt data (or tampered data) from softening a
    // permission. A permission system's default is chosen by what happens
    // when something goes wrong.
    expect(permissionOf({ reedicion: "libre" })).toBe("solo_autor");
    expect(permissionOf({ reedicion: "PUBLICO" })).toBe("solo_autor");
    expect(permissionOf({ reedicion: "" })).toBe("solo_autor");
    expect(permissionOf({ reedicion: true })).toBe("solo_autor");
    expect(permissionOf({ reedicion: null })).toBe("solo_autor");
  });

  it("`immutable_lock` wins over `reedicion`", () => {
    // There are published files with the lock and none with `reedicion`. In the face of
    // a contradiction, the prudent choice is the seal.
    expect(permissionOf({ immutable_lock: true, reedicion: "publico" })).toBe("sellado");
    expect(permissionOf({ immutable: true, reedicion: "publico" })).toBe("sellado");
  });

  it("an `immutable_lock: false` does NOT seal", () => {
    // The 14 real files carry it as false. If this sealed, none of them could be
    // reopened.
    expect(permissionOf({ immutable_lock: false })).toBe("solo_autor");
    expect(permissionOf({ immutable_lock: false, reedicion: "publico" })).toBe("publico");
  });

  it("a string \"true\" does not count as a lock", () => {
    expect(permissionOf({ immutable_lock: "true" })).toBe("solo_autor");
  });

  it("without metadata it does not blow up", () => {
    expect(permissionOf(null)).toBe(DEFAULT_PERMISSION);
    expect(permissionOf(undefined)).toBe(DEFAULT_PERMISSION);
    expect(permissionOf("a string")).toBe(DEFAULT_PERMISSION);
  });
});

describe("who may re-edit", () => {
  it("a sealed one: nobody, not even its author", () => {
    expect(canReedit("sellado", true)).toEqual({ permitido: false, reason: "sellado" });
    expect(canReedit("sellado", false)).toEqual({ permitido: false, reason: "sellado" });
  });

  it("a public one: anyone, even without knowing who you are", () => {
    // This is what makes it useful for a library: it resolves without a session and
    // without asking the server anything.
    expect(canReedit("publico", null)).toEqual({ permitido: true });
    expect(canReedit("publico", false)).toEqual({ permitido: true });
  });

  it("a `solo_autor`: only its author", () => {
    expect(canReedit("solo_autor", true)).toEqual({ permitido: true });
    expect(canReedit("solo_autor", false)).toEqual({ permitido: false, reason: "no_eres_el_autor" });
  });

  it("and if it is NOT known whether you are the author, it is not granted", () => {
    // Without a session or without having asked the registry. Granting "just in case"
    // would turn a permission into a suggestion.
    expect(canReedit("solo_autor", null)).toEqual({ permitido: false, reason: "no_eres_el_autor" });
  });
});

describe("which documents are asked of the registry", () => {
  it("the public ones are NOT, and that is deliberate", () => {
    // Without a row, its `oim_id` is free. The first one to re-edit it "as theirs"
    // would create the row with themselves as author, and since it is insert-only nobody
    // could correct it: they could seal someone else's document.
    expect(registryQuery("publico")).toBe(false);
  });

  it("the others are", () => {
    expect(registryQuery("solo_autor")).toBe(true);
    expect(registryQuery("sellado")).toBe(true);
  });
});

describe("the viewer seal", () => {
  it("a public one is signed WITHOUT authorship, and that has to be said", () => {
    // Anyone can take an official one, change a figure and re-sign it. With the same
    // green seal, "Verified signature" would stop meaning anything.
    expect(signatureStamp("publico")).toBe("verified_sin_autoria");
  });

  it("the others keep the usual seal", () => {
    expect(signatureStamp("solo_autor")).toBe("verified");
    expect(signatureStamp("sellado")).toBe("verified");
  });
});

describe("what can be rejected WITHOUT asking anyone", () => {
  it("a sealed one, yes: it is known by reading the file", () => {
    expect(mustRejectWithoutAsking("sellado", null).permitido).toBe(false);
  });

  it("a public one, no: anyone can", () => {
    expect(mustRejectWithoutAsking("publico", null).permitido).toBe(true);
  });

  it("a `solo_autor` with UNKNOWN authorship is let through", () => {
    // It is the normal case and the one that must be gotten right. NONE of today's .oim
    // files carries authorship inside: the backend deletes `creator_user_id` from the
    // canonical form before signing, for personal data. Rejecting here would block
    // everyone, even their OWN files.
    expect(mustRejectWithoutAsking("solo_autor", null).permitido).toBe(true);
  });

  it("...but if it is KNOWN that you are not the author, it is rejected", () => {
    expect(mustRejectWithoutAsking("solo_autor", false))
      .toEqual({ permitido: false, reason: "no_eres_el_autor" });
  });

  it("and it is not the same as `canReedit`", () => {
    // `canReedit` decides with the answer already in hand, and so it DENIES
    // when in doubt. `mustRejectWithoutAsking` decides before asking, and so it only
    // rejects when it is certain. Confusing them breaks the normal case.
    expect(canReedit("solo_autor", null).permitido).toBe(false);
    expect(mustRejectWithoutAsking("solo_autor", null).permitido).toBe(true);
  });
});

describe("writing the permission into the file", () => {
  it("a sealed one writes the lock; the others do not", () => {
    // The lock is the only thing the backend can enforce. Without it, a "nobody can
    // re-edit this" would be a suggestion written into the file.
    expect(permissionFields("sellado")).toEqual({ reedicion: "sellado", immutable_lock: true });
    expect(permissionFields("solo_autor")).toEqual({ reedicion: "solo_autor", immutable_lock: false });
    expect(permissionFields("publico")).toEqual({ reedicion: "publico", immutable_lock: false });
  });

  it("and what is written reads back the same, for all three", () => {
    // THIS is the proof that the two mechanisms are one. If writing and reading
    // disagreed on a single value, we would be back to two systems.
    for (const p of ["publico", "solo_autor", "sellado"] as const) {
      expect(permissionOf(permissionFields(p))).toBe(p);
    }
  });

  it("an `immutable_lock: false` does not prevent the permission from being read", () => {
    // The 14 real files carry it as false. If writing it that way made the
    // permission fall back to the default, publishing a public one would be impossible.
    expect(permissionOf(permissionFields("publico"))).toBe("publico");
  });
});
