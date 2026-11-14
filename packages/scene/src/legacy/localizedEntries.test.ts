/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { localizedEntries, compareLangs, resolveContent } from "./localizedEntries";

const textLayer = (extra: any = {}) => ({
  id: "titulo",
  type: "text",
  content: { es: "Hola", en: "Hello", fr: "Hola" },
  style: { fontSize: "16px", ...extra },
});

describe("localizedEntries", () => {
  it("absent from the map means inheriting from the principal value", () => {
    const layer = textLayer({ fontSizes: { de: "13px" } });
    expect(localizedEntries(layer, "de").size).toBe("13px");
    expect(localizedEntries(layer, "es").size).toBe("16px");
  });

  // DECLARED behaviour change: `fontSizeOverrides` used to be read.
  // Contract 1.5.0 retired it with no deprecation phase, and the compiler
  // merges it into `fontSizes`, so a signed file never carries it.
  it("ignores fontSizeOverrides, retired in contract 1.5.0", () => {
    const layer = textLayer({ fontSizeOverrides: { de: "11px" } });
    expect(localizedEntries(layer, "de").size).toBe("16px");
  });

  it("an http(s) URL is not an image: the contract removed allow_external_urls", () => {
    const layer = { id: "u", type: "text", content: { es: "https://x.example/a.png" }, style: {} };
    expect(localizedEntries(layer, "es").maxWidthValue).toBe("80%");
  });

  it("a bare number is read as px, so as not to emit invalid CSS", () => {
    expect(localizedEntries(textLayer({ fontSizes: { de: 24 } }), "de").size).toBe("24px");
  });

  it("a size of 0 falls back to the principal, as the engine does", () => {
    // The engine chains with `||`, so a 0 is discarded. If `??` were used here it
    // would give "0px" and this module would stop reproducing what it replaces.
    expect(localizedEntries(textLayer({ fontSizes: { de: 0 } }), "de").size).toBe("16px");
  });

  it("a valid unit passes through unchanged", () => {
    expect(localizedEntries(textLayer({ fontSizes: { de: "4cqw" } }), "de").size).toBe("4cqw");
  });

  it("a background layer ignores maxWidths: otherwise it leaves an uncovered strip", () => {
    const fondo = {
      id: "background-pattern-slot",
      type: "image",
      content: { es: "data:image/png;base64,AAA" },
      style: { maxWidths: { es: "95%" } },
    };
    expect(localizedEntries(fondo, "es").maxWidthValue).toBe("none");
  });

  it("the default width depends on whether the content is an image", () => {
    expect(localizedEntries(textLayer(), "es").maxWidthValue).toBe("80%");
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
  it("if the triple is identical, the layer cannot look different", () => {
    // 'fr' has the same text as 'es' on purpose.
    expect(compareLangs(textLayer(), "es", "fr")).toBe("none");
  });

  it("changing only the size does not force a rebuild", () => {
    const layer = textLayer({ fontSizes: { fr: "13px" } });
    expect(compareLangs(layer, "es", "fr")).toBe("style-only");
  });

  it("changing only the maximum width does not either", () => {
    const layer = textLayer({ maxWidths: { fr: "95%" } });
    expect(compareLangs(layer, "es", "fr")).toBe("style-only");
  });

  it("changing the content does, because it decides what gets built", () => {
    expect(compareLangs(textLayer(), "es", "en")).toBe("content");
  });

  it("the content wins even if the size also changes", () => {
    const layer = textLayer({ fontSizes: { en: "13px" } });
    expect(compareLangs(layer, "es", "en")).toBe("content");
  });
});

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

describe("the engine cannot have its own copy of the rule", () => {
  // The engine is split: the painting half in renderer.ts, the player half in ImageEngine.ts.
  const source = [require("node:path").join(__dirname, "renderer.ts"), require("node:path").join(__dirname, "../../../player-oim/src/engines/ImageEngine.ts")].map((f) => require("node:fs").readFileSync(f, "utf8")).join("\n");

  it("ImageEngine ya no declara resolveLangValue ni _getContent", () => {
    // The rule lives in localizedEntries.ts. A second copy here is how
    // the parallax broke: two places deciding the same thing and diverging.
    expect(source).not.toMatch(/function\s+resolveLangValue/);
    expect(source).not.toMatch(/function\s+_getContent/);
  });

  it("ImageEngine asks the module for the entries per language", () => {
    expect(source).toMatch(/localizedEntries\s*\(/);
  });
});

describe("resolveContent with the principal under *", () => {
  it("a language without its own key receives the principal", () => {
    expect(resolveContent({ "*": "A", pt: "B" }, "fr")).toBe("A");
  });

  it("an English exception does not leak into the languages that inherit", () => {
    // The trap of the old order: without a * in front, fr fell through to `en` and got
    // the English exception instead of the main one.
    expect(resolveContent({ "*": "A", en: "B" }, "fr")).toBe("A");
  });

  it("its own key beats the principal, regardless of case", () => {
    expect(resolveContent({ "*": "A", pt: "B" }, "pt")).toBe("B");
    expect(resolveContent({ "*": "A", PT: "B" }, "pt")).toBe("B");
  });

  it("an empty exception stays empty: the author said it does not use the principal", () => {
    expect(resolveContent({ "*": "A", pt: "" }, "pt")).toBe("");
  });

  it("a file without * resolves exactly as before", () => {
    expect(resolveContent({ es: "Hola", en: "Hello" }, "fr")).toBe("Hello");
    expect(resolveContent({ es: "Hola", en: "" }, "en")).toBe("Hola");
  });
});

describe("compareLangs with the inherited medium", () => {
  const layer = {
    id: "img",
    type: "image",
    content: { "*": "data:image/png;base64,AAA", pt: "data:image/png;base64,BBB" },
    style: {},
  };

  it("two languages that inherit the same principal do not repaint the layer", () => {
    expect(compareLangs(layer, "es", "en")).toBe("none");
  });

  it("pasar a la excepcion si repinta", () => {
    expect(compareLangs(layer, "es", "pt")).toBe("content");
  });
});


