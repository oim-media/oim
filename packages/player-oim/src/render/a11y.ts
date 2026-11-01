/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Screen-reader reading of a .oim (contract 1.16.0). Pure: built from the
// document's slots, never from the painted DOM, so the duplicated tracks of a
// scene loop are not read twice and nothing here runs per frame.

import { resolveByLang, resolveContent } from "./localizedEntries.js";
import { plainOf } from "./marked-text.js";

export type NodoA11y =
  | { tipo: "texto"; lang: string; texto: string }
  | { tipo: "imagen"; etiqueta: string }
  | { tipo: "boton" | "enlace"; etiqueta: string; href?: string; slotId: string };

type Slot = { id: string; type?: string; position?: number[]; languages?: string[]; content?: any; style?: any; isInteractive?: boolean; interaction?: any };

const ROW_PX = 8;

/** Top to bottom, then left to right; boxes within 8 px of y share a row. */
export function ordenDeLectura<T extends { x: number; y: number }>(capas: T[]): T[] {
  const sorted = capas.slice().sort((a, b) => a.y - b.y);
  const rows: T[][] = [];
  for (const c of sorted) {
    const row = rows[rows.length - 1];
    if (row && c.y - row[0].y <= ROW_PX) row.push(c);
    else rows.push([c]);
  }
  return rows.flatMap((r) => r.sort((a, b) => a.x - b.x));
}

function altOf(style: any, lang: string, principal: string): string {
  const v = resolveByLang(style.alt, lang) ?? resolveByLang(style.alt, principal);
  return typeof v === "string" ? v.trim() : "";
}

// `actions` false (image mode): nothing is clickable, so nothing is a button.
export function nodosA11y(slots: Slot[], lang: string, principal: string, actions = true): NodoA11y[] {
  const items: { x: number; y: number; nodo: NodoA11y }[] = [];
  for (const s of slots || []) {
    if (!s || s.type === "group" || s.type === "mask" || s.type === "filter") continue;
    if (Array.isArray(s.languages) && !s.languages.includes("*") && !s.languages.includes(lang)) continue;
    const style = s.style || {};
    // A hidden layer is not on screen, so it is not read either.
    if (style.isVisible === false) continue;
    const alt = style.decorative === true ? "" : altOf(style, lang, principal);
    const texto = s.type && s.type !== "text" && s.type !== "artistic-text" ? "" : plainOf(resolveContent(s.content, lang), style.marks).trim();
    const interactive = actions && (s.isInteractive === true || style.isInteractive === true
      || (s.interaction && s.interaction.action_type === "toggle_elements"));
    let nodo: NodoA11y | null = null;
    if (interactive) {
      nodo = { tipo: "boton", etiqueta: texto || alt || (lang.startsWith("es") ? "Botón" : "Button"), slotId: String(s.id) };
    } else if (texto && style.decorative !== true) {
      nodo = { tipo: "texto", lang, texto };
    } else if (alt) {
      nodo = { tipo: "imagen", etiqueta: alt };
    }
    // shortcut: position is read as the box's top-left whatever the align; upgrade if centred anchors misorder real files.
    const p = Array.isArray(s.position) ? s.position : [0, 0];
    if (nodo) items.push({ x: Number(p[0]) || 0, y: Number(p[1]) || 0, nodo });
  }
  return ordenDeLectura(items).map((i) => i.nodo);
}

/** The figure's name: the document description (reader's language, else the principal), else the first text, else "Image". */
export function etiquetaDeLaObra(meta: { description?: Record<string, string> }, nodos: NodoA11y[], lang: string, principal = lang): string {
  const d = resolveByLang(meta && meta.description, lang) ?? resolveByLang(meta && meta.description, principal);
  if (typeof d === "string" && d.trim()) return d.trim();
  const t = nodos.find((n) => n.tipo === "texto");
  if (t && t.tipo === "texto") return t.texto;
  return lang.startsWith("es") ? "Imagen" : "Image";
}
