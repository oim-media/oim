/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Text marks (contract 1.11.0): formatted phrases inside one text.
 *
 * A text carries `{name}…{/name}` tags whose style lives in `style.marks`; a
 * literal brace is doubled (`{{`, `}}`). This module is the ONLY
 * interpretation of that syntax: the editor, the player, the static export
 * and the translation all call it, and the backend's Python twin is tested
 * against the same cases (packages/spec/marks-cases.json). Five interpreters
 * of the same braces would disagree, the way the editor and the player once
 * drew the same sine wave in opposite directions.
 *
 * Painting is lenient (anything malformed is shown as text, an unclosed mark
 * runs to the end) so a view never breaks; signing is strict
 * (`validateMarks`), so a signed .oim only carries well-formed texts.
 * Spec: docs/superpowers/specs/2026-10-10-marcas-de-texto-design.md
 */

import type { TextMark } from "./schema.js";
import { resolveCssColor } from "./dynamic-colors.js";

// In limits.ts so schema.ts can use them without importing this module (a cycle).
import { MARK_NAME, MAX_MARKS } from "./limits.js";
export { MARK_NAME, MAX_MARKS };

export interface Run { text: string; mark?: string }
/** A mark over the plain text, `[from, to)`. */
export interface MarkRange { from: number; to: number; mark: string }

type Token =
  | { kind: "text"; s: string }
  | { kind: "open" | "close"; name: string; raw: string; at: number }
  | { kind: "stray"; raw: string; at: number };

const TAG = /^\{(\/?)([a-z][a-z0-9-]{0,23})\}/;

function tokenize(text: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === "{" || c === "}") {
      if (text[i + 1] === c) { out.push({ kind: "text", s: c }); i += 2; continue; }
      if (c === "{") {
        const m = TAG.exec(text.slice(i));
        if (m) {
          out.push({ kind: m[1] ? "close" : "open", name: m[2], raw: m[0], at: i });
          i += m[0].length;
          continue;
        }
      }
      out.push({ kind: "stray", raw: c, at: i });
      i += 1;
      continue;
    }
    let j = i;
    while (j < text.length && text[j] !== "{" && text[j] !== "}") j++;
    out.push({ kind: "text", s: text.slice(i, j) });
    i = j;
  }
  return out;
}

interface Reading { runs: Run[]; sequence: string[]; error?: { reason: string; at: number } }

function read(text: string, known: readonly string[]): Reading {
  const runs: Run[] = [];
  const sequence: string[] = [];
  let error: Reading["error"];
  let open: string | null = null;
  const fail = (reason: string, at: number) => { if (!error) error = { reason, at }; };
  const push = (s: string) => {
    if (!s) return;
    const last = runs[runs.length - 1];
    if (last && last.mark === (open ?? undefined)) last.text += s;
    else runs.push(open ? { text: s, mark: open } : { text: s });
  };

  for (const t of tokenize(text)) {
    if (t.kind === "text") push(t.s);
    else if (t.kind === "stray") { fail("stray brace", t.at); push(t.raw); }
    else if (!known.includes(t.name)) { fail(`unknown mark "${t.name}"`, t.at); push(t.raw); }
    else if (t.kind === "open") {
      if (open) { fail(`"${t.name}" inside "${open}"`, t.at); push(t.raw); }
      else { open = t.name; sequence.push(t.name); }
    } else if (open === t.name) open = null;
    else { fail(`"${t.name}" closed without being open`, t.at); push(t.raw); }
  }
  if (open) fail(`"${open}" is not closed`, text.length);
  return { runs, sequence, error };
}

/** The runs of a text, without tags or escapes. Lenient: malformed parts are text. */
export function parseMarks(text: string, known: readonly string[]): Run[] {
  return read(text, known).runs;
}

/** Strict check, for signing: every single brace forms a tag of a known mark, open and closed, not nested. */
export function validateMarks(text: string, known: readonly string[]): { ok: true } | { ok: false; reason: string; at: number } {
  const { error } = read(text, known);
  return error ? { ok: false, ...error } : { ok: true };
}

/** Plain text made safe to store: every brace doubled, so it can never form a tag. */
export function escapeMarks(plain: string): string {
  return plain.replace(/[{}]/g, (c) => c + c);
}

export function plainText(text: string, known: readonly string[]): string {
  return parseMarks(text, known).map((r) => r.text).join("");
}

/** Mark names in order of opening, to compare a translation with its source. */
export function marksSequence(text: string, known: readonly string[]): string[] {
  return read(text, known).sequence;
}

export function toRanges(text: string, known: readonly string[]): { plain: string; ranges: MarkRange[] } {
  let plain = "";
  const ranges: MarkRange[] = [];
  for (const r of parseMarks(text, known)) {
    if (r.mark) ranges.push({ from: plain.length, to: plain.length + r.text.length, mark: r.mark });
    plain += r.text;
  }
  return { plain, ranges };
}

/** The stored text for a plain text and its marks: the plain text escaped, tags inserted. */
export function fromRanges(plain: string, ranges: readonly MarkRange[]): string {
  let out = "";
  let at = 0;
  for (const r of [...ranges].sort((a, b) => a.from - b.from)) {
    const from = Math.max(r.from, at), to = Math.min(r.to, plain.length);
    if (to <= from) continue;
    out += escapeMarks(plain.slice(at, from)) + `{${r.mark}}` + escapeMarks(plain.slice(from, to)) + `{/${r.mark}}`;
    at = to;
  }
  return out + escapeMarks(plain.slice(at));
}

/** The text without one mark's tags: its phrases stay, as plain text. */
export function withoutMark(text: string, mark: string): string {
  let out = "";
  for (const t of tokenize(text)) {
    if (t.kind === "text") out += escapeMarks(t.s);
    else if (t.kind === "stray") out += t.raw;
    else if (t.name !== mark) out += t.raw;
  }
  return out;
}

export interface ResolvedMarkStyle {
  color?: string;
  fontWeight?: 700;
  fontStyle?: "italic";
  underline: boolean;
  highlight?: { style: "marker" | "box" | "pill" | "underline-thick"; color: string; paddingX: number; paddingY: number; borderRadius: number };
}

/**
 * The style every renderer paints for a mark. Colours resolve through
 * `resolveCssColor`, the same funnel (and sanitising) as every colour of a
 * .oim; the highlight defaults are those of `textHighlight` in the player.
 */
export function markStyle(mark: TextMark): ResolvedMarkStyle {
  const out: ResolvedMarkStyle = { underline: mark.underline === true };
  const color = resolveCssColor(mark.colorRole, mark.color);
  if (color) out.color = color;
  if (mark.bold) out.fontWeight = 700;
  if (mark.italic) out.fontStyle = "italic";
  if (mark.highlight) {
    const h = mark.highlight;
    out.highlight = {
      style: h.style ?? "marker",
      color: resolveCssColor(h.colorRole, h.color) || "rgba(245, 158, 11, 0.35)",
      paddingX: h.paddingX ?? 4,
      paddingY: h.paddingY ?? 2,
      borderRadius: h.borderRadius ?? 3,
    };
  }
  return out;
}
