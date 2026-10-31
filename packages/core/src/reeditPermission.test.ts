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

describe("leer el permiso del archivo", () => {
  it("un .oim SIN el campo es `solo_autor`", () => {
    // These are ALL that exist today: none of the 14 real files carries it.
    // With this default nothing changes for what is already published.
    expect(permissionOf({})).toBe("solo_autor");
    expect(permissionOf({ nombre: "x" })).toBe("solo_autor");
  });

  it("lee los tres valores validos", () => {
    expect(permissionOf({ reedicion: "publico" })).toBe("publico");
    expect(permissionOf({ reedicion: "solo_autor" })).toBe("solo_autor");
    expect(permissionOf({ reedicion: "sellado" })).toBe("sellado");
  });

  it("un valor DESCONOCIDO cae a `solo_autor`, nunca a `publico`", () => {
    // The rule that stops corrupt data (or tampered data) from softening a
    // permission. A permission system's default is chosen by what happens
    // when something goes wrong.
    expect(permissionOf({ reedicion: "libre" })).toBe("solo_autor");
    expect(permissionOf({ reedicion: "PUBLICO" })).toBe("solo_autor");
    expect(permissionOf({ reedicion: "" })).toBe("solo_autor");
    expect(permissionOf({ reedicion: true })).toBe("solo_autor");
    expect(permissionOf({ reedicion: null })).toBe("solo_autor");
  });

  it("`immutable_lock` gana sobre `reedicion`", () => {
    // There are published files with the lock and none with `reedicion`. In the face of
    // a contradiction, the prudent choice is the seal.
    expect(permissionOf({ immutable_lock: true, reedicion: "publico" })).toBe("sellado");
    expect(permissionOf({ immutable: true, reedicion: "publico" })).toBe("sellado");
  });

  it("un `immutable_lock: false` NO sella", () => {
    // The 14 real files carry it as false. If this sealed, none of them could be
    // reopened.
    expect(permissionOf({ immutable_lock: false })).toBe("solo_autor");
    expect(permissionOf({ immutable_lock: false, reedicion: "publico" })).toBe("publico");
  });

  it("una cadena \"true\" no cuenta como candado", () => {
    expect(permissionOf({ immutable_lock: "true" })).toBe("solo_autor");
  });

  it("sin metadatos no revienta", () => {
    expect(permissionOf(null)).toBe(DEFAULT_PERMISSION);
    expect(permissionOf(undefined)).toBe(DEFAULT_PERMISSION);
    expect(permissionOf("una cadena")).toBe(DEFAULT_PERMISSION);
  });
});

describe("quien puede reeditar", () => {
  it("un sellado, nadie — ni siquiera su autor", () => {
    expect(canReedit("sellado", true)).toEqual({ permitido: false, reason: "sellado" });
    expect(canReedit("sellado", false)).toEqual({ permitido: false, reason: "sellado" });
  });

  it("un publico, cualquiera — incluso sin saber quien eres", () => {
    // This is what makes it useful for a library: it resolves without a session and
    // without asking the server anything.
    expect(canReedit("publico", null)).toEqual({ permitido: true });
    expect(canReedit("publico", false)).toEqual({ permitido: true });
  });

  it("un `solo_autor`, solo su autor", () => {
    expect(canReedit("solo_autor", true)).toEqual({ permitido: true });
    expect(canReedit("solo_autor", false)).toEqual({ permitido: false, reason: "no_eres_el_autor" });
  });

  it("y si NO se sabe si eres el autor, no se concede", () => {
    // Without a session or without having asked the registry. Granting "just in case"
    // would turn a permission into a suggestion.
    expect(canReedit("solo_autor", null)).toEqual({ permitido: false, reason: "no_eres_el_autor" });
  });
});

describe("a que documentos se les pregunta al registro", () => {
  it("a los publicos NO, y es deliberado", () => {
    // Without a row, its `oim_id` is free. The first one to re-edit it "as theirs"
    // would create the row with themselves as author, and since it is insert-only nobody
    // could correct it: they could seal someone else's document.
    expect(registryQuery("publico")).toBe(false);
  });

  it("a los demas si", () => {
    expect(registryQuery("solo_autor")).toBe(true);
    expect(registryQuery("sellado")).toBe(true);
  });
});

describe("el sello del visor", () => {
  it("un publico se firma SIN autoria, y hay que decirlo", () => {
    // Anyone can take an official one, change a figure and re-sign it. With the same
    // green seal, "Verified signature" would stop meaning anything.
    expect(signatureStamp("publico")).toBe("verified_sin_autoria");
  });

  it("los demas conservan el sello de siempre", () => {
    expect(signatureStamp("solo_autor")).toBe("verified");
    expect(signatureStamp("sellado")).toBe("verified");
  });
});

describe("que se puede rechazar SIN preguntarle a nadie", () => {
  it("un sellado, si: se sabe leyendo el archivo", () => {
    expect(mustRejectWithoutAsking("sellado", null).permitido).toBe(false);
  });

  it("un publico, no: cualquiera puede", () => {
    expect(mustRejectWithoutAsking("publico", null).permitido).toBe(true);
  });

  it("un `solo_autor` con autoria DESCONOCIDA se deja pasar", () => {
    // It is the normal case and the one that must be gotten right. NONE of today's .oim
    // files carries authorship inside: the backend deletes `creator_user_id` from the
    // canonical form before signing, for personal data. Rejecting here would block
    // everyone, even their OWN files.
    expect(mustRejectWithoutAsking("solo_autor", null).permitido).toBe(true);
  });

  it("...pero si se SABE que no eres el autor, se rechaza", () => {
    expect(mustRejectWithoutAsking("solo_autor", false))
      .toEqual({ permitido: false, reason: "no_eres_el_autor" });
  });

  it("y no es lo mismo que `canReedit`", () => {
    // `canReedit` decides with the answer already in hand, and so it DENIES
    // when in doubt. `mustRejectWithoutAsking` decides before asking, and so it only
    // rejects when it is certain. Confusing them breaks the normal case.
    expect(canReedit("solo_autor", null).permitido).toBe(false);
    expect(mustRejectWithoutAsking("solo_autor", null).permitido).toBe(true);
  });
});

describe("escribir el permiso en el archivo", () => {
  it("un sellado escribe el candado; los demas no", () => {
    // The lock is the only thing the backend can enforce. Without it, a "nobody can
    // re-edit this" would be a suggestion written into the file.
    expect(permissionFields("sellado")).toEqual({ reedicion: "sellado", immutable_lock: true });
    expect(permissionFields("solo_autor")).toEqual({ reedicion: "solo_autor", immutable_lock: false });
    expect(permissionFields("publico")).toEqual({ reedicion: "publico", immutable_lock: false });
  });

  it("y lo escrito se vuelve a leer igual, los tres", () => {
    // THIS is the proof that the two mechanisms are one. If writing and reading
    // disagreed on a single value, we would be back to two systems.
    for (const p of ["publico", "solo_autor", "sellado"] as const) {
      expect(permissionOf(permissionFields(p))).toBe(p);
    }
  });

  it("un `immutable_lock: false` no impide que el permiso se lea", () => {
    // The 14 real files carry it as false. If writing it that way made the
    // permission fall back to the default, publishing a public one would be impossible.
    expect(permissionOf(permissionFields("publico"))).toBe("publico");
  });
});
