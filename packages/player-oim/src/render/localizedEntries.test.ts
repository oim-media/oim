/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { localizedEntries, compareLangs, resolveContent } from "./localizedEntries";

const capaDeTexto = (extra: any = {}) => ({
  id: "titulo",
  type: "text",
  content: { es: "Hola", en: "Hello", fr: "Hola" },
  style: { fontSize: "16px", ...extra },
});

describe("localizedEntries", () => {
  it("ausente en el mapa significa heredar del valor principal", () => {
    const capa = capaDeTexto({ fontSizes: { de: "13px" } });
    expect(localizedEntries(capa, "de").size).toBe("13px");
    expect(localizedEntries(capa, "es").size).toBe("16px");
  });

  // DECLARED behaviour change: `fontSizeOverrides` used to be read.
  // Contract 1.5.0 retired it with no deprecation phase, and the compiler
  // merges it into `fontSizes`, so a signed file never carries it.
  it("ignora fontSizeOverrides, retirado en el contrato 1.5.0", () => {
    const capa = capaDeTexto({ fontSizeOverrides: { de: "11px" } });
    expect(localizedEntries(capa, "de").size).toBe("16px");
  });

  it("una URL http(s) no es una imagen: el contrato retiro allow_external_urls", () => {
    const capa = { id: "u", type: "text", content: { es: "https://x.example/a.png" }, style: {} };
    expect(localizedEntries(capa, "es").maxWidthValue).toBe("80%");
  });

  it("un numero pelado se interpreta como px, para no emitir CSS invalido", () => {
    expect(localizedEntries(capaDeTexto({ fontSizes: { de: 24 } }), "de").size).toBe("24px");
  });

  it("un size 0 cae al principal, como hace el motor", () => {
    // The engine chains with `||`, so a 0 is discarded. If `??` were used here it
    // would give "0px" and this module would stop reproducing what it replaces.
    expect(localizedEntries(capaDeTexto({ fontSizes: { de: 0 } }), "de").size).toBe("16px");
  });

  it("una unidad valida pasa tal cual", () => {
    expect(localizedEntries(capaDeTexto({ fontSizes: { de: "4cqw" } }), "de").size).toBe("4cqw");
  });

  it("una capa de fondo ignora maxWidths: si no, deja una franja sin cubrir", () => {
    const fondo = {
      id: "background-pattern-slot",
      type: "image",
      content: { es: "data:image/png;base64,AAA" },
      style: { maxWidths: { es: "95%" } },
    };
    expect(localizedEntries(fondo, "es").maxWidthValue).toBe("none");
  });

  it("el ancho por defecto depende de si el content es imagen", () => {
    expect(localizedEntries(capaDeTexto(), "es").maxWidthValue).toBe("80%");
    const img = { id: "i", type: "image", content: { es: "data:image/png;base64,AAA" }, style: {} };
    expect(localizedEntries(img, "es").maxWidthValue).toBe("none");
  });

  // A shape has an exact width: capped at 80%, a full-width band drew short.
  it("a shape without maxWidth is not capped at 80%", () => {
    const geo = { id: "g", type: "geo", style: { width: "100cqw" } };
    expect(localizedEntries(geo, "es").maxWidthValue).toBe("none");
  });
});

describe("compareLangs", () => {
  it("si la terna es identica, la capa no puede verse distinta", () => {
    // 'fr' has the same text as 'es' on purpose.
    expect(compareLangs(capaDeTexto(), "es", "fr")).toBe("none");
  });

  it("cambiar solo el size no obliga a reconstruir", () => {
    const capa = capaDeTexto({ fontSizes: { fr: "13px" } });
    expect(compareLangs(capa, "es", "fr")).toBe("style-only");
  });

  it("cambiar solo el ancho maximo tampoco", () => {
    const capa = capaDeTexto({ maxWidths: { fr: "95%" } });
    expect(compareLangs(capa, "es", "fr")).toBe("style-only");
  });

  it("cambiar el content si, porque decide que se construye", () => {
    expect(compareLangs(capaDeTexto(), "es", "en")).toBe("content");
  });

  it("el content manda aunque tambien cambie el size", () => {
    const capa = capaDeTexto({ fontSizes: { en: "13px" } });
    expect(compareLangs(capa, "es", "en")).toBe("content");
  });
});

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

describe("el motor no puede tener su propia copy de la regla", () => {
  const fuente = readFileSync(
    fileURLToPath(new URL("../engines/ImageEngine.ts", import.meta.url)),
    "utf8"
  );

  it("ImageEngine ya no declara resolveLangValue ni _getContent", () => {
    // The rule lives in localizedEntries.ts. A second copy here is how
    // the parallax broke: two places deciding the same thing and diverging.
    expect(fuente).not.toMatch(/function\s+resolveLangValue/);
    expect(fuente).not.toMatch(/function\s+_getContent/);
  });

  it("ImageEngine pide las entradas por idioma al modulo", () => {
    expect(fuente).toMatch(/localizedEntries\s*\(/);
  });
});

describe("resolveContent con el principal bajo *", () => {
  it("un idioma sin clave propia recibe el principal", () => {
    expect(resolveContent({ "*": "A", pt: "B" }, "fr")).toBe("A");
  });

  it("una excepcion en ingles no se cuela en los idiomas que heredan", () => {
    // The trap of the old order: without a * in front, fr fell through to `en` and got
    // the English exception instead of the main one.
    expect(resolveContent({ "*": "A", en: "B" }, "fr")).toBe("A");
  });

  it("la clave propia gana al principal, sin distinguir mayusculas", () => {
    expect(resolveContent({ "*": "A", pt: "B" }, "pt")).toBe("B");
    expect(resolveContent({ "*": "A", PT: "B" }, "pt")).toBe("B");
  });

  it("una excepcion vacia se queda vacia: el autor dijo que no usa el principal", () => {
    expect(resolveContent({ "*": "A", pt: "" }, "pt")).toBe("");
  });

  it("un archivo sin * se resuelve exactamente como antes", () => {
    expect(resolveContent({ es: "Hola", en: "Hello" }, "fr")).toBe("Hello");
    expect(resolveContent({ es: "Hola", en: "" }, "en")).toBe("Hola");
  });
});

describe("compareLangs con el medio heredado", () => {
  const capa = {
    id: "img",
    type: "image",
    content: { "*": "data:image/png;base64,AAA", pt: "data:image/png;base64,BBB" },
    style: {},
  };

  it("dos idiomas que heredan el mismo principal no repintan la capa", () => {
    expect(compareLangs(capa, "es", "en")).toBe("none");
  });

  it("pasar a la excepcion si repinta", () => {
    expect(compareLangs(capa, "es", "pt")).toBe("content");
  });
});


