/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * TABLA COMPARTIDA, y CANONICA. Se copy tal cual al editor: los mismos casos
 * corren en los dos lados. Que la tabla viaje con el modulo es lo que impide
 * que una copy decida por su cuenta que significa un valor desconocido.
 */

import { describe, it, expect } from "vitest";
import {
  permissionOf, canReedit, mustRejectWithoutAsking, registryQuery, signatureStamp,
  permissionFields, DEFAULT_PERMISSION,
} from "./reeditPermission";

describe("leer el permiso del archivo", () => {
  it("un .oim SIN el campo es `solo_autor`", () => {
    // Son TODOS los que existen hoy: ninguno de los 14 archivos reales lo
    // lleva. Con este defecto, nada cambia para lo ya publicado.
    expect(permissionOf({})).toBe("solo_autor");
    expect(permissionOf({ nombre: "x" })).toBe("solo_autor");
  });

  it("lee los tres valores validos", () => {
    expect(permissionOf({ reedicion: "publico" })).toBe("publico");
    expect(permissionOf({ reedicion: "solo_autor" })).toBe("solo_autor");
    expect(permissionOf({ reedicion: "sellado" })).toBe("sellado");
  });

  it("un valor DESCONOCIDO cae a `solo_autor`, nunca a `publico`", () => {
    // La regla que impide que un dato corrupto -o manipulado- ablande un
    // permiso. El defecto de un sistema de permisos se elige por lo que pasa
    // cuando algo va mal.
    expect(permissionOf({ reedicion: "libre" })).toBe("solo_autor");
    expect(permissionOf({ reedicion: "PUBLICO" })).toBe("solo_autor");
    expect(permissionOf({ reedicion: "" })).toBe("solo_autor");
    expect(permissionOf({ reedicion: true })).toBe("solo_autor");
    expect(permissionOf({ reedicion: null })).toBe("solo_autor");
  });

  it("`immutable_lock` gana sobre `reedicion`", () => {
    // Hay archivos publicados con el candado y ninguno con `reedicion`. Ante
    // una contradiccion, lo prudente es el sellado.
    expect(permissionOf({ immutable_lock: true, reedicion: "publico" })).toBe("sellado");
    expect(permissionOf({ immutable: true, reedicion: "publico" })).toBe("sellado");
  });

  it("un `immutable_lock: false` NO sella", () => {
    // Los 14 archivos reales lo traen a false. Si esto sellara, no se podria
    // reabrir ninguno.
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
    // Es lo que lo hace util para una biblioteca: se resuelve sin sesion y sin
    // preguntarle nada al servidor.
    expect(canReedit("publico", null)).toEqual({ permitido: true });
    expect(canReedit("publico", false)).toEqual({ permitido: true });
  });

  it("un `solo_autor`, solo su autor", () => {
    expect(canReedit("solo_autor", true)).toEqual({ permitido: true });
    expect(canReedit("solo_autor", false)).toEqual({ permitido: false, reason: "no_eres_el_autor" });
  });

  it("y si NO se sabe si eres el autor, no se concede", () => {
    // Sin sesion o sin haber preguntado al registro. Conceder «por si acaso»
    // convertiria un permiso en una sugerencia.
    expect(canReedit("solo_autor", null)).toEqual({ permitido: false, reason: "no_eres_el_autor" });
  });
});

describe("a que documentos se les pregunta al registro", () => {
  it("a los publicos NO, y es deliberado", () => {
    // Sin fila, su `oim_id` esta libre. El primero que lo reedite «como suyo»
    // crearia la fila con el como autor, y al ser insert-only nadie podria
    // corregirla: podria sellar el documento de otro.
    expect(registryQuery("publico")).toBe(false);
  });

  it("a los demas si", () => {
    expect(registryQuery("solo_autor")).toBe(true);
    expect(registryQuery("sellado")).toBe(true);
  });
});

describe("el sello del visor", () => {
  it("un publico se firma SIN autoria, y hay que decirlo", () => {
    // Cualquiera puede coger un publico, cambiar una cifra y re-firmarlo. Con
    // el mismo sello verde, «Firma verificada» dejaria de significar algo.
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
    // Es el caso normal y el que hace falta acertar. NINGUN .oim de hoy lleva
    // autoria dentro: el backend borra `creator_user_id` del canonico antes de
    // firmar, por dato personal. Rechazar aqui bloquearia a todo el mundo
    // incluso sus PROPIOS archivos.
    expect(mustRejectWithoutAsking("solo_autor", null).permitido).toBe(true);
  });

  it("...pero si se SABE que no eres el autor, se rechaza", () => {
    expect(mustRejectWithoutAsking("solo_autor", false))
      .toEqual({ permitido: false, reason: "no_eres_el_autor" });
  });

  it("y no es lo mismo que `canReedit`", () => {
    // `canReedit` decide con la respuesta ya en la mano y por eso DENIEGA
    // ante la duda. `mustRejectWithoutAsking` decide antes de preguntar y por
    // eso solo rechaza cuando esta seguro. Confundirlas rompe lo normal.
    expect(canReedit("solo_autor", null).permitido).toBe(false);
    expect(mustRejectWithoutAsking("solo_autor", null).permitido).toBe(true);
  });
});

describe("escribir el permiso en el archivo", () => {
  it("un sellado escribe el candado; los demas no", () => {
    // El candado es lo unico que el backend puede hacer cumplir. Sin el, un
    // «nadie puede reeditar esto» seria una sugerencia escrita en el archivo.
    expect(permissionFields("sellado")).toEqual({ reedicion: "sellado", immutable_lock: true });
    expect(permissionFields("solo_autor")).toEqual({ reedicion: "solo_autor", immutable_lock: false });
    expect(permissionFields("publico")).toEqual({ reedicion: "publico", immutable_lock: false });
  });

  it("y lo escrito se vuelve a leer igual, los tres", () => {
    // ESTA es la prueba de que los dos mecanismos son uno. Si escribir y leer
    // discreparan en un solo valor, volveriamos a tener dos sistemas.
    for (const p of ["publico", "solo_autor", "sellado"] as const) {
      expect(permissionOf(permissionFields(p))).toBe(p);
    }
  });

  it("un `immutable_lock: false` no impide que el permiso se lea", () => {
    // Los 14 archivos reales lo traen a false. Si escribirlo asi hiciera caer
    // el permiso al defecto, publicar un publico seria imposible.
    expect(permissionOf(permissionFields("publico"))).toBe("publico");
  });
});
