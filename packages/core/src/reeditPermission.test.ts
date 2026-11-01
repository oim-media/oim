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
  it("a .oim WITHOUT the field is `author_only`", () => {
    // These are ALL that exist today: none of the 14 real files carries it.
    // With this default nothing changes for what is already published.
    expect(permissionOf({})).toBe("author_only");
    expect(permissionOf({ name: "x" })).toBe("author_only");
  });

  it("reads the three valid values from `reedit`", () => {
    expect(permissionOf({ reedit: "public" })).toBe("public");
    expect(permissionOf({ reedit: "author_only" })).toBe("author_only");
    expect(permissionOf({ reedit: "sealed" })).toBe("sealed");
  });

  it("reads the legacy `reedicion` values as their English equivalents", () => {
    // Signed files from before 1.23.0 keep their Spanish key and values.
    expect(permissionOf({ reedicion: "publico" })).toBe("public");
    expect(permissionOf({ reedicion: "solo_autor" })).toBe("author_only");
    expect(permissionOf({ reedicion: "sellado" })).toBe("sealed");
  });

  it("an UNKNOWN value falls back to `author_only`, never to `public`", () => {
    // The rule that stops corrupt data (or tampered data) from softening a
    // permission. A permission system's default is chosen by what happens
    // when something goes wrong.
    expect(permissionOf({ reedicion: "libre" })).toBe("author_only");
    expect(permissionOf({ reedicion: "PUBLICO" })).toBe("author_only");
    expect(permissionOf({ reedicion: "" })).toBe("author_only");
    expect(permissionOf({ reedicion: true })).toBe("author_only");
    expect(permissionOf({ reedicion: null })).toBe("author_only");
    expect(permissionOf({ reedit: "PUBLIC" })).toBe("author_only");
  });

  it("`reedit` wins over `reedicion` when both are present", () => {
    expect(permissionOf({ reedicion: "publico", reedit: "sealed" })).toBe("sealed");
  });

  it("`immutable_lock` wins over `reedicion`", () => {
    // There are published files with the lock and none with `reedicion`. In the face of
    // a contradiction, the prudent choice is the seal.
    expect(permissionOf({ immutable_lock: true, reedicion: "publico" })).toBe("sealed");
    expect(permissionOf({ immutable: true, reedit: "public" })).toBe("sealed");
  });

  it("an `immutable_lock: false` does NOT seal", () => {
    // The 14 real files carry it as false. If this sealed, none of them could be
    // reopened.
    expect(permissionOf({ immutable_lock: false })).toBe("author_only");
    expect(permissionOf({ immutable_lock: false, reedicion: "publico" })).toBe("public");
  });

  it("a string \"true\" does not count as a lock", () => {
    expect(permissionOf({ immutable_lock: "true" })).toBe("author_only");
  });

  it("without metadata it does not blow up", () => {
    expect(permissionOf(null)).toBe(DEFAULT_PERMISSION);
    expect(permissionOf(undefined)).toBe(DEFAULT_PERMISSION);
    expect(permissionOf("a string")).toBe(DEFAULT_PERMISSION);
  });
});

describe("who may re-edit", () => {
  it("a sealed one: nobody, not even its author", () => {
    expect(canReedit("sealed", true)).toEqual({ allowed: false, permitido: false, reason: "sealed" });
    expect(canReedit("sealed", false)).toEqual({ allowed: false, permitido: false, reason: "sealed" });
  });

  it("a public one: anyone, even without knowing who you are", () => {
    // This is what makes it useful for a library: it resolves without a session and
    // without asking the server anything.
    expect(canReedit("public", null)).toEqual({ allowed: true, permitido: true });
    expect(canReedit("public", false)).toEqual({ allowed: true, permitido: true });
  });

  it("an `author_only`: only its author", () => {
    expect(canReedit("author_only", true)).toEqual({ allowed: true, permitido: true });
    expect(canReedit("author_only", false)).toEqual({ allowed: false, permitido: false, reason: "not_the_author" });
  });

  it("and if it is NOT known whether you are the author, it is not granted", () => {
    // Without a session or without having asked the registry. Granting "just in case"
    // would turn a permission into a suggestion.
    expect(canReedit("author_only", null)).toEqual({ allowed: false, permitido: false, reason: "not_the_author" });
  });
});

describe("which documents are asked of the registry", () => {
  it("the public ones are NOT, and that is deliberate", () => {
    // Without a row, its `oim_id` is free. The first one to re-edit it "as theirs"
    // would create the row with themselves as author, and since it is insert-only nobody
    // could correct it: they could seal someone else's document.
    expect(registryQuery("public")).toBe(false);
  });

  it("the others are", () => {
    expect(registryQuery("author_only")).toBe(true);
    expect(registryQuery("sealed")).toBe(true);
  });
});

describe("the viewer seal", () => {
  it("a public one is signed WITHOUT authorship, and that has to be said", () => {
    // Anyone can take an official one, change a figure and re-sign it. With the same
    // green seal, "Verified signature" would stop meaning anything.
    expect(signatureStamp("public")).toBe("verified_authorless");
  });

  it("the others keep the usual seal", () => {
    expect(signatureStamp("author_only")).toBe("verified");
    expect(signatureStamp("sealed")).toBe("verified");
  });
});

describe("what can be rejected WITHOUT asking anyone", () => {
  it("a sealed one, yes: it is known by reading the file", () => {
    expect(mustRejectWithoutAsking("sealed", null).allowed).toBe(false);
  });

  it("a public one, no: anyone can", () => {
    expect(mustRejectWithoutAsking("public", null).allowed).toBe(true);
  });

  it("an `author_only` with UNKNOWN authorship is let through", () => {
    // It is the normal case and the one that must be gotten right. NONE of today's .oim
    // files carries authorship inside: the backend deletes `creator_user_id` from the
    // canonical form before signing, for personal data. Rejecting here would block
    // everyone, even their OWN files.
    expect(mustRejectWithoutAsking("author_only", null).allowed).toBe(true);
  });

  it("...but if it is KNOWN that you are not the author, it is rejected", () => {
    expect(mustRejectWithoutAsking("author_only", false))
      .toEqual({ allowed: false, permitido: false, reason: "not_the_author" });
  });

  it("and it is not the same as `canReedit`", () => {
    // `canReedit` decides with the answer already in hand, and so it DENIES
    // when in doubt. `mustRejectWithoutAsking` decides before asking, and so it only
    // rejects when it is certain. Confusing them breaks the normal case.
    expect(canReedit("author_only", null).allowed).toBe(false);
    expect(mustRejectWithoutAsking("author_only", null).allowed).toBe(true);
  });
});

describe("writing the permission into the file", () => {
  it("a sealed one writes the lock; the others do not", () => {
    // The lock is the only thing the backend can enforce. Without it, a "nobody can
    // re-edit this" would be a suggestion written into the file.
    expect(permissionFields("sealed")).toEqual({ reedit: "sealed", immutable_lock: true });
    expect(permissionFields("author_only")).toEqual({ reedit: "author_only", immutable_lock: false });
    expect(permissionFields("public")).toEqual({ reedit: "public", immutable_lock: false });
  });

  it("and what is written reads back the same, for all three", () => {
    // THIS is the proof that the two mechanisms are one. If writing and reading
    // disagreed on a single value, we would be back to two systems.
    for (const p of ["public", "author_only", "sealed"] as const) {
      expect(permissionOf(permissionFields(p))).toBe(p);
    }
  });

  it("an `immutable_lock: false` does not prevent the permission from being read", () => {
    // The 14 real files carry it as false. If writing it that way made the
    // permission fall back to the default, publishing a public one would be impossible.
    expect(permissionOf(permissionFields("public"))).toBe("public");
  });
});

describe("English verdict and deprecated permitido", () => {
  it("canReedit returns allowed, the English reason, and permitido with the same value", () => {
    const v = canReedit("author_only", false);
    expect(v).toEqual({ allowed: false, permitido: false, reason: "not_the_author" });
  });
});
