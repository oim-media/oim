/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The only things the language can change in a layer. The inventory is CLOSED:
 * if a fourth entry is ever added, it must be added here, or `setLang` will
 * not know there is something new to update.
 */
export interface LocalizedEntries {
  content: string;
  size: string;
  maxWidthValue: string;
}

export type ChangeKind = "none" | "style-only" | "content";

/** Looks up a language key, ignoring case. Missing = undefined. */
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

/** The language's content, with the same fallback chain the engine uses. */
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
 * An `http(s)` URL no longer counts as an image: the contract retired
 * `allow_external_urls` in 1.1.0, and a .oim does not connect to anyone when
 * opened. The parameter that allowed it was always passed as `false`.
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
 * The EFFECTIVE values, not the resolved ones. The difference matters: a
 * background layer ignores `maxWidths` because otherwise the background would
 * stay at 80% and leave an uncovered strip. If `setLang` wrote the resolved
 * value, the result would depend on which path you took to get there.
 */
export function localizedEntries(
  slot: any,
  lang: string
): LocalizedEntries {
  // Short aliases (st, c) were retired in 1.12.0: one name per concept.
  const style = (slot && slot.style) || {};
  const content = resolveContent(slot && slot.content, lang);
  const isImage = isImageContent(slot, content);

  const size = normalizeSize(
    // `||` and not `??` ON PURPOSE: that is what the engine does, and a size 0
    // must fall back to the main value there too. With `??`, a 0 would give
    // "0px" and this module would stop being a faithful copy of what it
    // replaces.
    // Only `fontSizes`: `fontSizeOverrides` was retired in contract 1.5.0 and
    // the compiler folds it into `fontSizes`.
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
 * What must be done to this layer when switching from one language to another.
 *
 * `content` always wins because it decides WHAT gets built -text, image, SVG or
 * Lottie-; the size and width only end up in `slotEl.style.*`, and the browser
 * takes care of the reflow.
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
