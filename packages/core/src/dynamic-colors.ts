/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type DynamicColorRole =
  | "primary"
  | "on-primary"
  | "secondary"
  | "on-secondary"
  | "surface"
  | "on-surface"
  | "outline"
  | "accent"
  | "text-primary"
  | "text-secondary"
  | "text-muted"
  | "text-on-accent";

export const DYNAMIC_COLOR_ROLES: readonly DynamicColorRole[] = [
  "primary",
  "on-primary",
  "secondary",
  "on-secondary",
  "surface",
  "on-surface",
  "outline",
  "accent",
  "text-primary",
  "text-secondary",
  "text-muted",
  "text-on-accent",
] as const;

/** Colors of a named palette: one color per role that the palette defines. */
export type Palette = Partial<Record<DynamicColorRole, string>>;

const ROLE_SET = new Set<string>(DYNAMIC_COLOR_ROLES);

/**
 * Checks whether a value belongs to the allowlist of recognized semantic roles.
 */
export function isValidDynamicColorRole(role: unknown): role is DynamicColorRole {
  return typeof role === "string" && ROLE_SET.has(role);
}

/**
 * Color forms accepted from a .oim file.
 *
 * An ALLOWLIST, on purpose: a list of what is forbidden always falls short. It
 * was measured against the 391 colors of real projects and covers 100%: 343
 * 6-digit hex, 20 `var()`, 16 rgb/rgba and 12 `transparent`.
 *
 * A .oim color is foreign data: the schema does not validate its format, and
 * anyone can produce the file. Without this, a value such as
 * "red; background-image: url(https://third-party/beacon)" becomes TWO
 * declarations when it reaches a `style` attribute, and opening a foreign file
 * would request a resource from a third party.
 */
const HEX = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
// Only numbers, units and separators: no quotes, no `;`, no `url(`.
const FUNCION_COLOR = /^(?:rgb|rgba|hsl|hsla)\(\s*[0-9a-zA-Z.,%/\s+-]*\)$/;
const PALABRAS = new Set(["transparent", "currentcolor", "none", "inherit"]);
// A variable's name cannot inject anything; the danger lives in its default
// value, which is validated separately and recursively.
const VAR_SIMPLE = /^var\(\s*(--[A-Za-z0-9_-]+)\s*\)$/;
const VAR_CON_RESPALDO = /^var\(\s*(--[A-Za-z0-9_-]+)\s*,([\s\S]+)\)$/;

/**
 * The same whitelist as a single regex source, for the portable contract.
 *
 * JSON Schema cannot carry a function, and a reader in Python or Rust only
 * gets the `pattern`. It is built from the pieces above so the two cannot
 * drift, and it is STRICTER, never looser: `var()` fallbacks nest two levels
 * here and four in `isSafeCssColor`. What an editor writes must be a subset
 * of what the player paints safely; a test holds that line.
 */
const P_HEX = "#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})";
const P_FUNCION = "(?:rgb|rgba|hsl|hsla)\\(\\s*[0-9a-zA-Z.,%/\\s+-]*\\)";
const P_PALABRA = "(?:transparent|currentColor|currentcolor|none|inherit)";
const P_NOMBRE = "--[A-Za-z0-9_-]+";
const P_BASE = `(?:${P_HEX}|${P_FUNCION}|${P_PALABRA})`;
const P_VAR0 = `var\\(\\s*${P_NOMBRE}\\s*\\)`;
const P_VAR1 = `var\\(\\s*${P_NOMBRE}\\s*,\\s*(?:${P_BASE}|${P_VAR0})\\s*\\)`;
const P_VAR2 = `var\\(\\s*${P_NOMBRE}\\s*,\\s*(?:${P_BASE}|${P_VAR0}|${P_VAR1})\\s*\\)`;

export const CSS_COLOR_PATTERN = `^(?:${P_BASE}|${P_VAR0}|${P_VAR1}|${P_VAR2})$`;

/**
 * Whether a value is a color expression that can be painted safely.
 *
 * `profundidad` (depth) cuts off nested `var()` calls: without it, a file with
 * a thousand levels would exhaust the stack.
 */
export function isSafeCssColor(valor: unknown, profundidad = 0): boolean {
  if (typeof valor !== "string") return false;
  const v = valor.trim();
  if (!v || v.length > 128 || profundidad > 4) return false;
  // A second lock, and REDUNDANT today: a mutation check showed that removing it
  // breaks no test, because the allowlist below -positive and anchored- already
  // rejects these payloads. It is kept in case someone widens `FUNCION_COLOR`,
  // not because it is catching anything now.
  if (/[;{}<>"]/.test(v) || v.includes(String.fromCharCode(92))) return false;
  if (/url\(|expression\(|\/\*/i.test(v)) return false;
  if (HEX.test(v)) return true;
  if (PALABRAS.has(v.toLowerCase())) return true;
  if (FUNCION_COLOR.test(v)) return true;
  if (VAR_SIMPLE.test(v)) return true;
  const conRespaldo = VAR_CON_RESPALDO.exec(v);
  if (conRespaldo) return isSafeCssColor(conRespaldo[2], profundidad + 1);
  return false;
}

/**
 * Picks the document's palette and returns its colors, already sanitized.
 *
 * Order: `requested` if it exists; otherwise `dark`/`light` according to
 * `prefersDark` when the document carries both; otherwise `defaultPalette`. A
 * name that does not exist does not count. An invalid color is discarded and
 * the rest of the palette is kept.
 */
export function resolvePalette(
  doc: { palettes?: Record<string, Palette>; defaultPalette?: string },
  opts: { requested?: string | null; prefersDark?: boolean } = {}
): { name: string; colors: Palette } | null {
  const paletas = doc.palettes ?? {};
  // The preference only decides when the document carries BOTH palettes; with
  // only one there is nothing to choose between, and defaultPalette wins.
  const ambas = Object.hasOwn(paletas, "dark") && Object.hasOwn(paletas, "light");
  const porPreferencia = ambas && opts.prefersDark !== undefined ? (opts.prefersDark ? "dark" : "light") : undefined;
  const nombre = [opts.requested, porPreferencia, doc.defaultPalette]
    .find((n): n is string => typeof n === "string" && Object.hasOwn(paletas, n));
  if (nombre === undefined) return null;
  const colors: Palette = {};
  for (const role of DYNAMIC_COLOR_ROLES) {
    const valor = paletas[nombre][role];
    if (isSafeCssColor(valor)) colors[role] = String(valor).trim();
  }
  return { name: nombre, colors };
}

/**
 * Resolves a CSS color expression for the web renderer:
 * - If it has a valid semantic role and a base color (fallback):
 *   var(--oim-color-${role}, var(--oim-palette-${role}, ${fallback}))
 * - If it has a valid semantic role and NO fallback:
 *   var(--oim-color-${role}, var(--oim-palette-${role}))
 * - If it has NO valid role: returns the direct fallback color, or an empty string.
 *
 * The role is resolved in the viewer's palette (`--oim-palette-*`), and the
 * layer's fixed color stays as the fallback for those who do not know it.
 */
export function resolveCssColor(
  role: DynamicColorRole | string | undefined | null,
  fallback?: string | null
): string {
  // Sanitizing lives HERE, in the funnel that all 13 places painting color in
  // the player pass through, and not in each sink: a new sink will be safe from
  // the start without anyone having to remember.
  //
  // Invalid values are DISCARDED rather than falling back to a default color:
  // the shape comes out visibly odd and the tampered file shows, instead of
  // being disguised.
  const bruto = fallback != null && fallback !== "" ? String(fallback).trim() : undefined;
  const cleanFallback = bruto && isSafeCssColor(bruto) ? bruto : undefined;
  if (isValidDynamicColorRole(role)) {
    const paleta = "var(--oim-palette-" + role + (cleanFallback ? ", " + cleanFallback : "") + ")";
    return "var(--oim-color-" + role + ", " + paleta + ")";
  }
  return cleanFallback || "";
}
