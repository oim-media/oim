/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Texts the player itself shows (not the author's content). Spanish when the
// active language is Spanish, English for every other language.

const TEXTS = {
  tampered: {
    es: "Archivo alterado: no coincide con su firma. OIM no lo muestra.",
    en: "Tampered file: it does not match its signature. OIM does not show it.",
  },
  button: { es: "Botón", en: "Button" },
  image: { es: "Imagen", en: "Image" },
  loadError: { es: "Error cargando OIM: ", en: "Could not load OIM: " },
} as const;

export function playerString(key: keyof typeof TEXTS, lang: string | undefined): string {
  const spanish = (lang ?? "").toLowerCase().startsWith("es");
  return TEXTS[key][spanish ? "es" : "en"];
}
