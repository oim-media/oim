/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Quién puede reeditar un `.oim`.
 *
 * CANONICO. La copy del editor (`OIM-Studio/src/lib/parallax/`) sale de aqui
 * por `scripts/sincronizar-parallax.mjs` y su hash esta en `parallax.lock`.
 * Vive aqui y no en el editor porque **el visor tambien necesita esta regla**
 * para decidir que sello enseña, y dos implementaciones de «que significa un
 * valor desconocido» es exactamente la divergencia que llevamos dos dias
 * cerrando.
 *
 * Las dos preguntas de Josue —«¿el autor permite reeditar?» y «¿quien
 * puede?»— son la misma con tres respuestas. Los dos extremos ya existian: el
 * `immutable_lock` es el «nadie» y no habia forma de expresar el «cualquiera».
 */

export type ReeditPermission = "publico" | "solo_autor" | "sellado";

/** El valor cuando el archivo no dice nada. TODOS los .oim de hoy caen aqui. */
export const DEFAULT_PERMISSION: ReeditPermission = "solo_autor";

const VALIDOS: readonly ReeditPermission[] = ["publico", "solo_autor", "sellado"];

/**
 * Lee el permiso de los metadatos.
 *
 * **Un valor desconocido cae a `solo_autor`, nunca a `publico`.** Es la regla
 * que impide que un dato corrupto —o manipulado— ablande un permiso. El
 * default de un sistema de permisos se elige por lo que pasa cuando algo va
 * mal, no por lo que pasa cuando va bien.
 */
export function permissionOf(metadata: unknown): ReeditPermission {
  if (!metadata || typeof metadata !== "object") return DEFAULT_PERMISSION;
  const m = metadata as Record<string, unknown>;

  // El candado heredado gana sobre todo lo demas: hay archivos publicados que
  // lo llevan y ninguno lleva `reedicion` todavia. Si un archivo dijera
  // `reedicion: "publico"` e `immutable_lock: true`, lo prudente es el sellado.
  if (m.immutable_lock === true || m.immutable === true) return "sellado";

  const v = m.reedicion;
  return typeof v === "string" && (VALIDOS as readonly string[]).includes(v)
    ? (v as ReeditPermission)
    : DEFAULT_PERMISSION;
}

/**
 * Los campos que un `.oim` debe llevar para expresar este permiso.
 *
 * **La inversa de `permissionOf`, y vive aqui para que no puedan separarse.** El
 * candado y el permiso eran dos mecanismos para una sola idea: `permissionOf` ya
 * traducia `immutable_lock: true` a `"sellado"`, pero al ESCRIBIR cada lado
 * decidia por su cuenta. El editor exportaba solo el candado, con una etiqueta
 * que ademas decia otra cosa —«el JSON no podra ser modificado post-render»,
 * que es lo que hace la FIRMA, no esto—.
 *
 * Se escriben LOS DOS campos, y no es redundancia:
 *
 *   - `reedicion` viaja DENTRO del archivo. Es la declaracion: cualquiera que
 *     lo abra sabe que quiso su autor, sin preguntarle a nadie.
 *   - `immutable_lock` es lo que el backend guarda en el registro. Es la
 *     aplicacion: lo unico que puede negarse a firmar de verdad.
 *
 * Una declaracion sin aplicacion es una sugerencia; una aplicacion sin
 * declaracion es una puerta cerrada sin cartel.
 */
export function permissionFields(permiso: ReeditPermission): {
  reedicion: ReeditPermission;
  immutable_lock: boolean;
} {
  return { reedicion: permiso, immutable_lock: permiso === "sellado" };
}

export interface Verdict {
  permitido: boolean;
  /** Por que no, para poder decirselo a la persona sin adivinar. */
  reason?: "sellado" | "no_eres_el_autor";
}

/**
 * ¿Puede esta persona reeditar este documento?
 *
 * `esElAutor` es `null` cuando no se sabe —sin sesion, o sin haber preguntado
 * al registro—. En ese caso NO se concede: solo el permiso `publico` se
 * resuelve sin saber quien eres, que es justo lo que lo hace util para una
 * biblioteca.
 */
export function canReedit(
  permiso: ReeditPermission,
  esElAutor: boolean | null
): Verdict {
  if (permiso === "sellado") return { permitido: false, reason: "sellado" };
  if (permiso === "publico") return { permitido: true };
  return esElAutor === true
    ? { permitido: true }
    : { permitido: false, reason: "no_eres_el_autor" };
}

/**
 * ¿Hay que rechazar SIN preguntarle a nadie?
 *
 * Solo cuando la respuesta es segura. Es una pregunta distinta de
 * `canReedit`, y confundirlas rompe el caso mas comun:
 *
 * - `sellado` → si, nadie puede, y eso se sabe leyendo el archivo.
 * - `publico` → no, cualquiera puede.
 * - `solo_autor` → **NO se rechaza aqui**, salvo que se sepa a ciencia cierta
 *   que no eres el autor. Y casi nunca se sabe: el backend borra
 *   `creator_user_id` del canonico antes de firmar —es dato personal—, asi que
 *   un `.oim` no lleva dentro a quien lo hizo. La respuesta autoritativa vive
 *   en el registro.
 *
 * Rechazar por `null` bloquearia a todo el mundo incluso sus PROPIOS archivos,
 * porque ninguno de los .oim que existen hoy lleva autoria dentro.
 */
export function mustRejectWithoutAsking(
  permiso: ReeditPermission,
  esElAutor: boolean | null
): Verdict {
  if (permiso === "sellado") return { permitido: false, reason: "sellado" };
  if (permiso === "solo_autor" && esElAutor === false) {
    return { permitido: false, reason: "no_eres_el_autor" };
  }
  return { permitido: true };
}

/**
 * ¿Hay que preguntarle al registro por este documento?
 *
 * **Los publicos NO se consultan, ni para leer.** Sin fila en el registro su
 * `oim_id` esta libre, y el primero que lo reedite «como suyo» crearia la fila
 * con el como autor. Al ser insert-only, esa fila NO se puede sobrescribir
 * jamas: podria sellar el documento de otro. Si un publico nunca busca su id,
 * nadie puede apropiarselo por ese camino.
 */
export function registryQuery(permiso: ReeditPermission): boolean {
  return permiso !== "publico";
}

/**
 * Que sello merece el archivo.
 *
 * Hoy el visor solo distingue «firmado» de «no firmado», y con archivos
 * publicos esa etiqueta pasa a prometer de mas: cualquiera puede coger uno,
 * cambiar una cifra, re-firmarlo, y saldria igual de «verificado». No es un
 * fallo del modelo —es lo que significa publico— pero el sello tiene que
 * decirlo o deja de significar algo.
 */
export function signatureStamp(permiso: ReeditPermission): "verified" | "verified_sin_autoria" {
  return permiso === "publico" ? "verified_sin_autoria" : "verified";
}
