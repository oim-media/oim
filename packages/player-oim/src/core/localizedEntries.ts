/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Lo unico que el idioma puede cambiar en una capa. El inventario es CERRADO:
 * si algun dia se anade una cuarta entrada, se anade aqui o `setLang` no se
 * enterara de que hay algo nuevo que actualizar.
 */
export interface LocalizedEntries {
  content: string;
  size: string;
  maxWidthValue: string;
}

export type ChangeKind = "none" | "style-only" | "content";

/** Busca una clave de idioma sin distinguir mayusculas. Ausente = undefined. */
export function resolveByLang(map: any, lang: string): any {
  if (!map || typeof map !== "object") return undefined;
  const lk = (lang || "").toLowerCase();
  if (map[lk] !== undefined) return map[lk];
  const keys = Object.keys(map);
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].toLowerCase() === lk) return map[keys[i]];
  }
  return undefined;
}

/** El content del idioma, con la misma cadena de reservas que usa el motor. */
export function resolveContent(content: any, lang: string): string {
  const map = content || {};
  // Media layers keep their principal under "*" and give an exception its own
  // key. That key is final even when empty: the author chose "this language
  // does not use the principal". With "*" present there is no fallback to
  // `en`/`es`, which is what stops an English exception from leaking into the
  // languages that inherit. Text never carries "*", so it keeps falling back
  // past empty translations exactly as before.
  if (map["*"] !== undefined) {
    const own = resolveByLang(map, lang);
    return typeof own === "string" ? own : String(map["*"] ?? "");
  }
  function read(key: string): string | undefined {
    if (map[key] !== undefined && map[key] !== "") return map[key];
    const lk = key.toLowerCase();
    const uk = key.toUpperCase();
    if (map[uk] !== undefined && map[uk] !== "") return map[uk];
    if (map[lk] !== undefined && map[lk] !== "") return map[lk];
    const keys = Object.keys(map);
    for (let i = 0; i < keys.length; i++) {
      if (keys[i].toLowerCase() === lk && map[keys[i]] !== "") return map[keys[i]];
    }
    return undefined;
  }
  let text = read(lang) || read("en") || read("es") || read("default") || "";
  if (!text) {
    const keys = Object.keys(map);
    if (keys.length > 0) text = map[keys[0]] || "";
  }
  return text;
}

/**
 * Una URL `http(s)` ya no cuenta como imagen: el contrato retiro
 * `allow_external_urls` en 1.1.0 y un .oim no conecta con nadie al abrirse.
 * El parametro que lo permitia se pasaba siempre a `false`.
 */
export function isImageContent(slot: any, content: string): boolean {
  if (slot && slot.type === "image") return true;
  return content.indexOf("data:image/") === 0;
}

export function isBackground(slot: any): boolean {
  return !!slot && (slot.is_background_pattern === true || slot.id === "background-pattern-slot");
}

const RE_CSS_UNIT = /^[\d.+-]+(cqw|cqh|cqi|cqb|rem|em|ex|ch|vw|vh|vmin|vmax|%|px|pt|pc|cm|mm|in|lh|rlh)$/i;

function normalizeSize(value: any, fallback: any): string {
  const reserved = fallback != null ? fallback.toString() : "16px";
  let t = (value != null ? value.toString() : "").trim();
  if (!t || t === "undefined" || t === "null") return reserved;
  if (RE_CSS_UNIT.test(t)) return t;
  const n = parseFloat(t);
  return isNaN(n) ? reserved : n + "px";
}

/**
 * Los valores EFECTIVOS, no los resueltos. La diferencia importa: una capa de
 * fondo ignora `maxWidths` porque si no el fondo se queda al 80% y deja una
 * franja sin cubrir. Si `setLang` escribiera el valor resuelto, el resultado
 * dependeria de por que camino llegaste.
 */
export function localizedEntries(
  slot: any,
  lang: string
): LocalizedEntries {
  // Short aliases (st, c) retired in 1.12.0: one name per concept.
  const style = (slot && slot.style) || {};
  const content = resolveContent(slot && slot.content, lang);
  const isImage = isImageContent(slot, content);

  const size = normalizeSize(
    // `||` y no `??` A PROPOSITO: es lo que hace el motor, y un size 0 debe
    // caer al principal igual que alli. Con `??` un 0 daria "0px" y este modulo
    // dejaria de ser una copy fiel de lo que sustituye.
    // Solo `fontSizes`: `fontSizeOverrides` se retiro en el contrato 1.5.0 y
    // el compilador lo funde en `fontSizes`.
    resolveByLang(style.fontSizes, lang) || style.fontSize,
    style.fontSize || "16px"
  );

  const maxWidthValue = isBackground(slot)
    ? "none"
    : resolveByLang(style.maxWidths, lang) ||
      // The 80% fallback wraps a text with no width; a shape, group or
      // filter has an exact width that the cap only cut short.
      (isImage || (slot?.type ?? "text") !== "text" ? style.maxWidth || "none" : style.maxWidth || "80%");

  return { content, size, maxWidthValue };
}

/**
 * Que hay que hacerle a esta capa al pasar de un idioma a otro.
 *
 * `content` gana siempre porque decide QUE se construye —text, imagen, SVG o
 * Lottie—; el size y el ancho solo acaban en `slotEl.style.*` y del reflujo se
 * encarga el navegador.
 */
export function compareLangs(
  slot: any,
  before: string,
  after: string
): ChangeKind {
  const a = localizedEntries(slot, before);
  const b = localizedEntries(slot, after);
  if (a.content !== b.content) return "content";
  if (a.size !== b.size || a.maxWidthValue !== b.maxWidthValue) return "style-only";
  return "none";
}
