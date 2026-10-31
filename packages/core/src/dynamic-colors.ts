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

/** Colores de una paleta con nombre: un color por rol que la paleta define. */
export type Palette = Partial<Record<DynamicColorRole, string>>;

const ROLE_SET = new Set<string>(DYNAMIC_COLOR_ROLES);

/**
 * Valida si un valor pertenece a la lista blanca de roles semanticos reconocidos.
 */
export function isValidDynamicColorRole(role: unknown): role is DynamicColorRole {
  return typeof role === "string" && ROLE_SET.has(role);
}

/**
 * Formas de color que se aceptan de un archivo .oim.
 *
 * Lista BLANCA, y a proposito: una lista de lo prohibido siempre se queda
 * corta. Se midio contra los 391 colores de los proyectos reales y cubre el
 * 100%: 343 hex de 6, 20 `var()`, 16 rgb/rgba y 12 `transparent`.
 *
 * Un color del .oim es dato ajeno: el esquema no valida su formato y el
 * archivo puede fabricarlo cualquiera. Sin esto, un valor como
 * "red; background-image: url(https://tercero/baliza)" se convierte en DOS
 * declaraciones al llegar a un atributo `style`, y abrir un archivo ajeno
 * pide un recurso a un tercero.
 */
const HEX = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
// Solo numeros, unidades y separadores: ni comillas, ni `;`, ni `url(`.
const FUNCION_COLOR = /^(?:rgb|rgba|hsl|hsla)\(\s*[0-9a-zA-Z.,%/\s+-]*\)$/;
const PALABRAS = new Set(["transparent", "currentcolor", "none", "inherit"]);
// El nombre de una variable no puede inyectar nada; el peligro vive en su
// valor por defecto, que se valida aparte y de forma recursiva.
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
 * Si un valor es una expresion de color que se puede pintar sin riesgo.
 *
 * `profundidad` corta los `var()` anidados: sin ella, un archivo con mil
 * niveles agotaria la pila.
 */
export function isSafeCssColor(valor: unknown, profundidad = 0): boolean {
  if (typeof valor !== "string") return false;
  const v = valor.trim();
  if (!v || v.length > 128 || profundidad > 4) return false;
  // Segundo cerrojo, y hoy REDUNDANTE: se comprobo por mutacion que quitarlo
  // no rompe ninguna prueba, porque la lista blanca de abajo -positiva y
  // anclada- ya rechaza estas cargas. Se conserva por si alguien ensancha
  // `FUNCION_COLOR`, no porque este atrapando algo ahora.
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
 * Elige la paleta del documento y devuelve sus colores ya saneados.
 *
 * Orden: `requested` si existe; si no, `dark`/`light` según `prefersDark`
 * cuando el documento trae ambas; si no, `defaultPalette`. Un nombre que no existe
 * no cuenta. Un color inválido se descarta y el resto de la paleta se queda.
 */
export function resolvePalette(
  doc: { palettes?: Record<string, Palette>; defaultPalette?: string },
  opts: { requested?: string | null; prefersDark?: boolean } = {}
): { name: string; colors: Palette } | null {
  const paletas = doc.palettes ?? {};
  // La preferencia solo decide si el documento trae AMBAS paletas; con una
  // sola no hay a cual elegir y manda defaultPalette.
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
 * Resuelve una expresion de color CSS para el renderizador web:
 * - Si tiene un rol semantico valido y un color base (fallback):
 *   var(--oim-color-${role}, var(--oim-palette-${role}, ${fallback}))
 * - Si tiene un rol semantico valido y NO tiene fallback:
 *   var(--oim-color-${role}, var(--oim-palette-${role}))
 * - Si NO tiene rol valido: devuelve el color de fallback directo o cadena vacia.
 *
 * El rol se resuelve en la paleta del visor (`--oim-palette-*`) y el color
 * fijo de la capa queda como respaldo para los que no la conocen.
 */
export function resolveCssColor(
  role: DynamicColorRole | string | undefined | null,
  fallback?: string | null
): string {
  // El saneado vive AQUI, en el embudo por el que pasan los 13 sitios que
  // pintan color en el player, y no en cada sumidero: un sumidero nuevo
  // nacera seguro sin que nadie se acuerde.
  //
  // Se DESCARTA lo invalido en vez de caer a un color por defecto: la figura
  // sale visiblemente rara y el archivo manipulado se nota, en vez de
  // disimularse.
  const bruto = fallback != null && fallback !== "" ? String(fallback).trim() : undefined;
  const cleanFallback = bruto && isSafeCssColor(bruto) ? bruto : undefined;
  if (isValidDynamicColorRole(role)) {
    const paleta = "var(--oim-palette-" + role + (cleanFallback ? ", " + cleanFallback : "") + ")";
    return "var(--oim-color-" + role + ", " + paleta + ")";
  }
  return cleanFallback || "";
}
