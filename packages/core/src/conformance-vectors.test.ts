/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Conformance vectors: what it means to meet them.
 *
 * `packages/spec` promises that an implementation in any language can be
 * correct without reading the TypeScript. The JSON Schema says what SHAPE a
 * .oim has; the vectors say what RESULT a reader must produce when opening a
 * specific one. Without them, "meets the spec" cannot be checked, only asserted.
 *
 * This test runs them against OUR reader. It is not circular by accident, it
 * is circular on purpose and in one direction: the reference implementation
 * defines the expected result, and this test prevents the reference from moving
 * without the vectors moving with it. The day a reader in Swift disagrees, there
 * is a concrete file to argue about instead of two opinions.
 *
 * It checks what two implementations can REALLY disagree about: the geometry
 * already normalized to `cqw`, the group hierarchy, the parallax depth, and the
 * declared interactivity. Not the whole metadata — a full dump breaks every
 * time the compiled output adds a field, and then it gets regenerated without a
 * look, which is a vector that no longer checks anything.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { extractOIM } from "./binary";
import { OimMetadataSchema } from "./schema";

const VECTORS = join(__dirname, "..", "..", "spec", "vectors");

const CASES = existsSync(VECTORS)
  ? readdirSync(VECTORS).filter((f) => f.endsWith(".oim.png")).sort()
  : [];

/** The same thing the vector generator (run by the signing service) emits. If they diverge, the vector lies. */
const DEL_ESTILO = [
  "width", "height", "fontSize", "borderRadius", "fillColor",
  "groupId", "childIds", "isInteractive", "states", "parallax",
  "isVisible", "reveal", "animation",
  "fontFamily", "fontWeight", "fontStyle", "textTransform", "letterSpacing", "lineHeight",
  "shadowEnabled", "shadowColor", "shadowBlur", "shadowOffsetX", "shadowOffsetY", "shadowOpacity",
  "blendMode", "opacity", "borderWidth", "borderColor", "strokeStyle",
  "filterPreset", "filterBlur", "filterBrightness", "filterContrast", "filterSaturate", "filterHueRotate",
  "textRuns",
  // Contract 1.10.0, vector layer-grain. Same list as the vector generator.
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

function expectedOutput(m: any) {
  return {
    canvas: m.canvas,
    languages: m.languages,
    signed: Boolean(m.signature),
    key_version: m.key_version,
    // 1.20.0: same projection as the vector generator, so the palettes vector is checked.
    ...(m.palettes ? { palettes: m.palettes, defaultPalette: m.defaultPalette } : {}),
    // 1.23.0: the reedit permission is part of the result, so reedit-english checks it.
    ...(m.reedit !== undefined ? { reedit: m.reedit } : {}),
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

describe("the conformance vectors", () => {
  /**
   * Without this, the suite would pass green the day someone moves the
   * directory: zero vectors, zero checks, all correct.
   * Now we require the full canonical matrix of 20 normative vectors.
   */
  it("there are at least 20 normative conformance vectors", () => {
    expect(CASES.length).toBeGreaterThanOrEqual(20);
  });

  it.each(CASES)("%s produces the result it declares", async (file) => {
    const expected = JSON.parse(
      readFileSync(join(VECTORS, file.replace(".oim.png", ".expected.json")), "utf8"),
    );
    const { metadata } = await extractOIM(new Blob([readFileSync(join(VECTORS, file))]));
    const actual = expectedOutput(metadata);
    // `description` is for whoever reads the vector, not part of the result.
    const { description, ...rest } = expected;
    expect(actual).toEqual(rest);
  });

  it.each(CASES)("%s validates against the published JSON Schema", async (file) => {
    const { metadata } = await extractOIM(new Blob([readFileSync(join(VECTORS, file))]));
    const r = OimMetadataSchema.safeParse(metadata);
    const problems = r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    expect(problems).toEqual([]);
  });

  /**
   * A vector without a signature would check only half the format. All of them
   * came out of `/v1/oim/package`, which is what signs in production.
   */
  it.each(CASES)("%s is signed, like a real .oim", async (file) => {
    const expected = JSON.parse(readFileSync(join(VECTORS, file.replace(".oim.png", ".expected.json")), "utf8"));
    // `signed: false` marks a vector that the signing service could not produce. It checks its key and not authorship.
    if (expected.signed === false) return;
    const { metadata } = await extractOIM(new Blob([readFileSync(join(VECTORS, file))]));
    expect(metadata.signature).toBeTruthy();
    expect(metadata.key_version).toBe("v1");
  });

  /** A broad suite checks orthogonal dimensions of the format. */
  it("they cover interactivity, hierarchy, depth, multilingual text, typography and effects", async () => {
    const covers = {
      interactive: false,
      group: false,
      parallax: false,
      multilang: false,
      typography: false,
      shadow: false,
      blend: false,
      textRuns: false,
    };
    for (const f of CASES) {
      const { metadata } = await extractOIM(new Blob([readFileSync(join(VECTORS, f))]));
      if (metadata.languages && metadata.languages.length >= 3) covers.multilang = true;
      for (const s of metadata.slots || []) {
        if (s.content && Object.keys(s.content).length >= 3) covers.multilang = true;
        if (s.style?.isInteractive) covers.interactive = true;
        if (s.style?.childIds?.length) covers.group = true;
        if (s.style?.parallax?.enabled) covers.parallax = true;
        if (s.style?.fontFamily && s.style?.fontWeight) covers.typography = true;
        if (s.style?.shadowEnabled) covers.shadow = true;
        if (s.style?.blendMode) covers.blend = true;
        if (s.style?.textRuns) covers.textRuns = true;
      }
    }
    expect(covers).toEqual({
      interactive: true,
      group: true,
      parallax: true,
      multilang: true,
      typography: true,
      shadow: true,
      blend: true,
      textRuns: true,
    });
  });
});
