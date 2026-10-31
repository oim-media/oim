/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Los vectores de conformidad: que cumplirlos signifique algo.
 *
 * `packages/spec` promete que una implementacion en cualquier lenguaje puede
 * ser correcta sin leer el TypeScript. El JSON Schema dice que FORMA tiene un
 * .oim; los vectores dicen que RESULTADO debe producir un lector al abrir uno
 * concreto. Sin ellos «cumple la spec» no se puede comprobar, solo afirmar.
 *
 * Esta prueba los ejecuta contra NUESTRO lector. No es circular por accidente,
 * es circular a proposito y en una direccion: la implementacion de referencia
 * define el resultado esperado, y esta prueba impide que la referencia se
 * mueva sin que los vectores se muevan con ella. El dia que un lector en Swift
 * discrepe, hay un fichero concreto sobre el que discutir en vez de dos
 * opiniones.
 *
 * Se comprueba lo que dos implementaciones pueden discrepar DE VERDAD: la
 * geometria ya normalizada a `cqw`, la jerarquia de grupos, la profundidad del
 * parallax y la interactividad declarada. No el metadato entero — un volcado
 * completo se rompe cada vez que el compilado añade un campo, y entonces se
 * regenera sin mirar, que es un vector que ya no comprueba nada.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { extractOIM } from "./binary";
import { OimMetadataSchema } from "./schema";

const VECTORES = join(__dirname, "..", "..", "spec", "vectors");

const CASOS = existsSync(VECTORES)
  ? readdirSync(VECTORES).filter((f) => f.endsWith(".oim.png")).sort()
  : [];

/** Lo mismo que emite `tools/generar-vectores.mjs`. Si divergen, el vector miente. */
const DEL_ESTILO = [
  "width", "height", "fontSize", "borderRadius", "fillColor",
  "groupId", "childIds", "isInteractive", "states", "parallax",
  "isVisible", "reveal", "animation",
  "fontFamily", "fontWeight", "fontStyle", "textTransform", "letterSpacing", "lineHeight",
  "shadowEnabled", "shadowColor", "shadowBlur", "shadowOffsetX", "shadowOffsetY", "shadowOpacity",
  "blendMode", "opacity", "borderWidth", "borderColor", "strokeStyle",
  "filterPreset", "filterBlur", "filterBrightness", "filterContrast", "filterSaturate", "filterHueRotate",
  "textRuns",
  // Contract 1.10.0, vector layer-grain. Same list as tools/generar-vectores.mjs.
  "grain", "grainIntensity", "grainSize", "grainBlend",
  // Vector layer-blur: the contract's blur field, which the player ignored.
  "layerBlur",
  "flipX", "flipY", "imageCrop", "alt", "decorative", "fillImage", "fillImageCrop",
  "fillType", "geoShape", "svgPath", "svgViewBox", "fillImageFlipX", "fillImageFlipY",
  // 1.21.0: colour roles of patterns, backgrounds and shadows.
  "fillPatternType", "fillPatternColor", "fillPatternColorRole", "fillPatternBgColor", "fillPatternBgColorRole",
  "backgroundType", "backgroundPatternType", "backgroundPatternColor", "backgroundPatternColorRole",
  "backgroundPatternBgColor", "backgroundPatternBgColorRole", "shadowColorRole",
];

function loQueSeEspera(m: any) {
  return {
    canvas: m.canvas,
    languages: m.languages,
    signed: Boolean(m.signature),
    key_version: m.key_version,
    // 1.20.0: same projection as generar-vectores.mjs, so the palettes vector is checked.
    ...(m.palettes ? { palettes: m.palettes, defaultPalette: m.defaultPalette } : {}),
    slots: (m.slots || []).map((s: any) => {
      const style: Record<string, unknown> = {};
      for (const k of DEL_ESTILO) if (s.style && s.style[k] !== undefined) style[k] = s.style[k];
      const fila: Record<string, unknown> = { id: s.id, type: s.type, position: s.position };
      if (s.name !== undefined) fila.name = s.name;
      if (s.content !== undefined) fila.content = s.content;
      if (s.parallax !== undefined) fila.parallax = s.parallax;
      if (Object.keys(style).length) fila.style = style;
      return fila;
    }),
  };
}

describe("los vectores de conformidad", () => {
  /**
   * Sin esto la suite pasaria en verde el dia que alguien mueva el directorio:
   * cero vectores, cero comprobaciones, todo correcto.
   * Ahora exigimos la matriz canónica completa de 20 vectores normativos.
   */
  it("hay al menos 20 vectores de conformidad normativos", () => {
    expect(CASOS.length).toBeGreaterThanOrEqual(20);
  });

  it.each(CASOS)("%s produce el resultado que declara", async (fichero) => {
    const esperado = JSON.parse(
      readFileSync(join(VECTORES, fichero.replace(".oim.png", ".expected.json")), "utf8"),
    );
    const { metadata } = await extractOIM(new Blob([readFileSync(join(VECTORES, fichero))]));
    const obtenido = loQueSeEspera(metadata);
    // `description` es para quien lee el vector, no parte del resultado.
    const { description, ...resto } = esperado;
    expect(obtenido).toEqual(resto);
  });

  it.each(CASOS)("%s valida contra el JSON Schema publicado", async (fichero) => {
    const { metadata } = await extractOIM(new Blob([readFileSync(join(VECTORES, fichero))]));
    const r = OimMetadataSchema.safeParse(metadata);
    const problemas = r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    expect(problemas).toEqual([]);
  });

  /**
   * Un vector sin firma comprobaria la mitad del formato. Todos salieron de
   * `/v1/oim/package`, que es lo que firma en produccion.
   */
  it.each(CASOS)("%s viene firmado, como un .oim real", async (fichero) => {
    const { metadata } = await extractOIM(new Blob([readFileSync(join(VECTORES, fichero))]));
    expect(metadata.signature).toBeTruthy();
    expect(metadata.key_version).toBe("v1");
  });

  /** Una suite amplia verifica dimensiones ortogonales del formato. */
  it("cubren interactividad, jerarquia, profundidad, multilingüe, tipografía y efectos", async () => {
    const cubre = {
      interactivo: false,
      grupo: false,
      parallax: false,
      multilang: false,
      tipografia: false,
      sombra: false,
      blend: false,
      textRuns: false,
    };
    for (const f of CASOS) {
      const { metadata } = await extractOIM(new Blob([readFileSync(join(VECTORES, f))]));
      if (metadata.languages && metadata.languages.length >= 3) cubre.multilang = true;
      for (const s of metadata.slots || []) {
        if (s.content && Object.keys(s.content).length >= 3) cubre.multilang = true;
        if (s.style?.isInteractive) cubre.interactivo = true;
        if (s.style?.childIds?.length) cubre.grupo = true;
        if (s.style?.parallax?.enabled) cubre.parallax = true;
        if (s.style?.fontFamily && s.style?.fontWeight) cubre.tipografia = true;
        if (s.style?.shadowEnabled) cubre.sombra = true;
        if (s.style?.blendMode) cubre.blend = true;
        if (s.style?.textRuns) cubre.textRuns = true;
      }
    }
    expect(cubre).toEqual({
      interactivo: true,
      grupo: true,
      parallax: true,
      multilang: true,
      tipografia: true,
      sombra: true,
      blend: true,
      textRuns: true,
    });
  });
});
