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

export type A11yNode =
  | { type: "text"; lang: string; text: string }
  | { type: "image"; label: string }
  | { type: "button" | "link"; label: string; href?: string; slotId: string };

type Slot = { id: string; type?: string; position?: number[]; languages?: string[]; content?: any; style?: any; isInteractive?: boolean; interaction?: any };

const ROW_PX = 8;

/** Top to bottom, then left to right; boxes within 8 px of y share a row. */
export function readingOrder<T extends { x: number; y: number }>(layers: T[]): T[] {
  const sorted = layers.slice().sort((a, b) => a.y - b.y);
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
export function a11yNodes(slots: Slot[], lang: string, principal: string, actions = true): A11yNode[] {
  const items: { x: number; y: number; node: A11yNode }[] = [];
  for (const s of slots || []) {
    if (!s || s.type === "group" || s.type === "mask" || s.type === "filter") continue;
    if (Array.isArray(s.languages) && !s.languages.includes("*") && !s.languages.includes(lang)) continue;
    const style = s.style || {};
    // A hidden layer is not on screen, so it is not read either.
    if (style.isVisible === false) continue;
    const alt = style.decorative === true ? "" : altOf(style, lang, principal);
    const text = s.type && s.type !== "text" && s.type !== "artistic-text" ? "" : plainOf(resolveContent(s.content, lang), style.marks).trim();
    const interactive = actions && (s.isInteractive === true || style.isInteractive === true
      || (s.interaction && s.interaction.action_type === "toggle_elements"));
    let node: A11yNode | null = null;
    if (interactive) {
      node = { type: "button", label: text || alt || (lang.startsWith("es") ? "Botón" : "Button"), slotId: String(s.id) };
    } else if (text && style.decorative !== true) {
      node = { type: "text", lang, text };
    } else if (alt) {
      node = { type: "image", label: alt };
    }
    // shortcut: position is read as the box's top-left whatever the align; upgrade if centred anchors misorder real files.
    const p = Array.isArray(s.position) ? s.position : [0, 0];
    if (node) items.push({ x: Number(p[0]) || 0, y: Number(p[1]) || 0, node });
  }
  return readingOrder(items).map((i) => i.node);
}

/** The figure's name: the document description (reader's language, else the principal), else the first text, else "Image". */
export function artworkLabel(meta: { description?: Record<string, string> }, nodes: A11yNode[], lang: string, principal = lang): string {
  const d = resolveByLang(meta && meta.description, lang) ?? resolveByLang(meta && meta.description, principal);
  if (typeof d === "string" && d.trim()) return d.trim();
  const t = nodes.find((n) => n.type === "text");
  if (t && t.type === "text") return t.text;
  return lang.startsWith("es") ? "Imagen" : "Image";
}
