/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { GEO_SHAPES, FRAME_SHAPES } from "./geoShapes";
import { frameSilhouette, usesFrameShapes } from "./frame-silhouette";
import { styleSchema } from "./schema";

const NUEVAS = [
  "pill", "octagon", "pentagon", "cross", "moon", "cloud", "drop",
  "bolt", "bubble", "flower", "burst", "arch",
];

/** All the numbers of a path; with only absolute M/L/C/Z they come in x,y pairs. */
const numeros = (d: string): number[] => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

describe("las doce formas nuevas del catalogo", () => {
  it("estan todas en GEO_SHAPES", () => {
    expect(NUEVAS.filter((n) => !(n in GEO_SHAPES))).toEqual([]);
  });

  it("son cerradas y rellenables", () => {
    for (const nombre of NUEVAS) {
      const d = GEO_SHAPES[nombre];
      if (d.tipo === "path") expect(d.rellenable, nombre).toBe(true);
    }
  });

  it("todas sus coordenadas caen en 0-100", () => {
    for (const nombre of NUEVAS) {
      const d = GEO_SHAPES[nombre];
      const valores = d.tipo === "polygon"
        ? d.puntos.flat()
        : numeros(d.d);
      for (const v of valores) {
        expect(v, `${nombre} se sale del viewBox`).toBeGreaterThanOrEqual(0);
        expect(v, `${nombre} se sale del viewBox`).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("FRAME_SHAPES", () => {
  it("empieza por el rectangulo y excluye la linea y el garabato", () => {
    expect(FRAME_SHAPES[0]).toBe("rectangle");
    expect(FRAME_SHAPES).not.toContain("line");
    expect(FRAME_SHAPES).not.toContain("scribble");
  });

  it("incluye las doce formas nuevas", () => {
    expect(NUEVAS.filter((n) => !FRAME_SHAPES.includes(n))).toEqual([]);
  });
});

describe("frameSilhouette", () => {
  it("una forma del catalogo da su trazado", () => {
    const s = frameSilhouette({ geoShape: "cloud" });
    expect(s).not.toBeNull();
    expect(s!.d).toBe((GEO_SHAPES.cloud as { d: string }).d);
    expect(s!.viewBox).toBe("0 0 100 100");
  });

  it("una forma de poligono da sus puntos", () => {
    const s = frameSilhouette({ geoShape: "octagon" });
    expect(s!.points).toContain("30,5");
    expect(s!.d).toBeUndefined();
  });

  it("un svgPath se devuelve tal cual, con el viewBox por defecto", () => {
    expect(frameSilhouette({ svgPath: "M0 0L100 0L50 100Z" })).toEqual({
      d: "M0 0L100 0L50 100Z",
      viewBox: "0 0 100 100",
    });
  });

  it("un svgPath usa su svgViewBox cuando lo trae", () => {
    expect(frameSilhouette({ svgPath: "M0 0Z", svgViewBox: "0 0 24 24" })!.viewBox).toBe("0 0 24 24");
  });

  it("el blob usa customBlobPath, luego svgPath, luego el catalogo", () => {
    expect(frameSilhouette({ geoShape: "blob", customBlobPath: "M1 1Z", svgPath: "M2 2Z" })!.d).toBe("M1 1Z");
    expect(frameSilhouette({ geoShape: "blob", svgPath: "M2 2Z" })!.d).toBe("M2 2Z");
    expect(frameSilhouette({ geoShape: "blob" })!.d).toBe((GEO_SHAPES.blob as { d: string }).d);
  });

  it("el rectangulo y las formas desconocidas dan null", () => {
    expect(frameSilhouette({ geoShape: "rectangle" })).toBeNull();
    expect(frameSilhouette({ geoShape: "trapecio" })).toBeNull();
    expect(frameSilhouette({})).toBeNull();
  });
});

describe("el esquema del svgPath", () => {
  const acepta = (svgPath: string) => styleSchema.safeParse({ svgPath }).success;

  it("rechaza marcado, comillas y url()", () => {
    expect(acepta("M0 0<script>")).toBe(false);
    expect(acepta("url(x)")).toBe(false);
    expect(acepta('M0 0"')).toBe(false);
  });

  it("acepta un trazado normal", () => {
    expect(acepta("M 10,10 L 90 90 Z")).toBe(true);
  });
});

describe("usesFrameShapes: cuando un .oim exige frame_shapes", () => {
  it("una forma nueva con foto la exige", () => {
    expect(usesFrameShapes({ type: "geo", geoShape: "cloud", fillType: "image" })).toBe(true);
  });

  it("un svgPath con foto la exige", () => {
    expect(usesFrameShapes({ type: "geo", svgPath: "M0 0Z", fillType: "image" })).toBe(true);
  });

  it("un volteo de la foto la exige", () => {
    expect(usesFrameShapes({ type: "geo", geoShape: "star", fillType: "image", fillImageFlipX: true })).toBe(true);
  });

  it("una estrella sin volteo no la exige", () => {
    expect(usesFrameShapes({ type: "geo", geoShape: "star", fillType: "image" })).toBe(false);
  });
});

describe("frameSilhouette rejects anything that is not path data", () => {
  it("drops a markup svgPath, a bad viewBox and a bad customBlobPath", () => {
    expect(frameSilhouette({ svgPath: 'M0 0"/><script>' })).toBeNull();
    expect(frameSilhouette({ svgPath: "M0 0Z", svgViewBox: '0 0 1 1" onload="x' })!.viewBox).toBe("0 0 100 100");
    expect(frameSilhouette({ geoShape: "blob", customBlobPath: "url(x)" })!.d).not.toContain("url");
  });
});
