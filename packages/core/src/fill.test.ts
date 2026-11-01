/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { getFillCss, patternLayerCss, patternShapeMask, PATTERN_SHAPES, type Shape, svgSilhouetteMaskCss } from "./fill";
import { resolvePatternColors } from "./patterns";
import { shapeMaskCss } from "./fill";
import { GEO_SHAPES, pointsToAttribute } from "./geoShapes";

describe("getFillCss en @oim-media/player-oim", () => {
  const makeShape = (overrides: Partial<Shape> = {}): Shape => ({
    width: 200,
    height: 100,
    ...overrides
  });

  it("devuelve objeto vacio cuando no hay fillType o es 'none'", () => {
    expect(getFillCss(makeShape({ fillType: "none" }))).toEqual({});
    expect(getFillCss(makeShape({}))).toEqual({});
  });

  it("traduce fillType 'color' correctamente para formas y texto", () => {
    const cssGeo = getFillCss(makeShape({ fillType: "color", fillColor: "#FF0000", type: "geo" }));
    expect(cssGeo).toEqual({ backgroundColor: "#FF0000" });

    const cssText = getFillCss(makeShape({ fillType: "color", fillColor: "#00FF00", type: "text" }));
    expect(cssText).toEqual({ color: "#00FF00" });
  });

  it("traduce fillType 'gradient' para texto con clip", () => {
    const cssText = getFillCss(makeShape({
      type: "text",
      fillType: "gradient",
      fillGradient: "linear-gradient(90deg, red, blue)"
    }));
    expect(cssText).toEqual({
      backgroundImage: "linear-gradient(90deg, red, blue)",
      backgroundClip: "text",
      WebkitBackgroundClip: "text",
      color: "transparent"
    });
  });

  it("traduce fillType 'pattern' con generador SVG", () => {
    const css = getFillCss(makeShape({
      fillType: "pattern",
      fillPatternType: "clouds",
      fillPatternColor: "#000000",
      fillPatternBgColor: "#FFFFFF"
    }));
    expect(css.backgroundImage).toContain("data:image/svg+xml");
    expect(css.backgroundRepeat).toBe("repeat");
    expect(css.backgroundSize).toBe("160px 160px");
  });
});

describe("patternLayerCss", () => {
  const capa = (extra: Record<string, unknown> = {}) =>
    ({ id: "p", type: "pattern", width: 200, height: 200,
       fillPatternType: "clouds", ...extra }) as any;

  // What SEPARATES the layer from the fill: the fill adjusts once ("cover",
  // "no-repeat"); the layer tiles.
  it("tesela: repeat y un tamaño, nunca cover", () => {
    const css = patternLayerCss(capa());
    expect(css.backgroundRepeat).toBe("repeat");
    expect(css.backgroundSize).toBe("160px 160px");
    expect(css.backgroundSize).not.toBe("cover");
  });

  it("la escala multiplica la tesela: 160 * escala", () => {
    expect(patternLayerCss(capa({ fillPatternScale: 2.5 })).backgroundSize)
      .toBe("400px 400px");
  });

  it("pinta el patron pedido", () => {
    const css = patternLayerCss(capa({ fillPatternColor: "#F59E0B" }));
    expect(String(css.backgroundImage)).toContain("data:image/svg+xml");
  });

  it("emite la animacion con la direccion y la velocidad de la capa", () => {
    expect(patternLayerCss(capa({ fillPatternDirection: "left", fillPatternSpeed: 4 })).animation)
      .toBe("background-animation-left 4s linear infinite");
  });

  it("sin direccion declarada se desplaza a la derecha, como el fondo", () => {
    expect(String(patternLayerCss(capa({ fillPatternSpeed: 4 })).animation))
      .toContain("background-animation-right");
  });

  // A still layer must NOT pay for a composition cycle.
  it.each([
    ["direccion none", { fillPatternDirection: "none", fillPatternSpeed: 8 }],
    ["velocidad 0",    { fillPatternSpeed: 0 }],
    ["velocidad negativa", { fillPatternSpeed: -4 }],
    ["sin velocidad",  {}],
  ])("NO emite animacion: %s", (_caso, extra) => {
    expect(patternLayerCss(capa(extra)).animation).toBeUndefined();
  });

  // A foreign `.oim` can carry anything.
  it("una direccion desconocida no emite animacion y no lanza", () => {
    expect(patternLayerCss(capa({ fillPatternDirection: "diagonal", fillPatternSpeed: 8 } as any)).animation)
      .toBeUndefined();
  });

  it("publica la tesela como --oim-bg-tile, que es lo que leen los keyframes", () => {
    expect((patternLayerCss(capa({ fillPatternScale: 2 })) as any)["--oim-bg-tile"])
      .toBe("320px");
  });

  // A pattern type that the generator does not know: the layer comes out transparent,
  // but it is NOT thrown. A foreign `.oim` must not be able to bring the viewer down.
  it("un tipo de patron desconocido no lanza", () => {
    expect(() => patternLayerCss(capa({ fillPatternType: "no-existe" }))).not.toThrow();
  });
});

describe("la capa de patron es una VENTANA, no un lienzo que estira", () => {
  const capa = (extra: Record<string, unknown> = {}) =>
    ({ id: "p", type: "pattern", fillPatternType: "clouds", ...extra }) as any;

  // The invariant that defines the layer: resizing it shows MORE or LESS
  // pattern, not a bigger or smaller one. What fixes it is the
  // scale, not the node's size -just like the moving background-.
  it("el tamaño del motivo NO depende del tamaño de la capa", () => {
    const pequena = patternLayerCss(capa({ width: 120, height: 90 }));
    const grande = patternLayerCss(capa({ width: 960, height: 720 }));
    expect(pequena.backgroundSize).toBe(grande.backgroundSize);
    expect(pequena.backgroundSize).toBe("160px 160px");
  });

  // What DOES change it is the scale, which is the author's control.
  it("pero la escala si lo cambia", () => {
    expect(patternLayerCss(capa({ width: 120, fillPatternScale: 2 })).backgroundSize)
      .toBe("320px 320px");
  });

  // `repeat` is what makes enlarging the window show more pattern instead of
  // a gap.
  it("y al agrandarla aparece mas patron, no un hueco", () => {
    expect(patternLayerCss(capa({ width: 960, height: 720 })).backgroundRepeat)
      .toBe("repeat");
  });
});

describe("las formas de la capa de patron", () => {
  const svgOf = (css: any) => decodeURIComponent(String(css.maskImage).replace(/^url\("data:image\/svg\+xml,/, "").replace(/"\)$/, ""));

  it("son exactamente estas nueve, en este orden", () => {
    expect(PATTERN_SHAPES).toEqual(["rectangle", "circle", "triangle", "star", "diamond", "hexagon", "heart", "arrow", "blob"]);
  });

  it("cada forma lleva EXACTAMENTE la geometria de GEO_SHAPES, estirada a la caja", () => {
    for (const id of PATTERN_SHAPES.filter((s) => s !== "rectangle")) {
      const css: any = patternShapeMask(id);
      const svg = svgOf(css);
      const d = GEO_SHAPES[id];
      if (d.tipo === "polygon") expect(svg).toContain(`points="${pointsToAttribute(d.puntos)}"`);
      else expect(svg).toContain(`d="${d.d}"`);
      expect(svg).toContain('viewBox="0 0 100 100"');
      expect(svg).toContain('preserveAspectRatio="none"');
      expect(css.maskSize).toBe("100% 100%");
      expect(css.maskRepeat).toBe("no-repeat");
      expect(css.WebkitMaskImage).toBe(css.maskImage);
    }
  });

  it("el rectangulo, las formas abiertas y lo desconocido no llevan mascara", () => {
    for (const id of [undefined, "rectangle", "rect", "line", "scribble", "no-existe"]) {
      expect(patternShapeMask(id as any)).toEqual({});
    }
  });

  it("patternLayerCss incluye la mascara de la forma", () => {
    const css: any = patternLayerCss({ type: "pattern", fillPatternType: "clouds", geoShape: "circle" } as any);
    expect(css.maskImage).toBe((patternShapeMask("circle") as any).maskImage);
    expect(css.backgroundRepeat).toBe("repeat");
  });
});

describe("fase A: el relleno de patron de una forma tesela y se mueve", () => {
  const conPatron = (extra: Record<string, unknown> = {}) =>
    getFillCss({ type: "geo", width: 200, height: 100, fillType: "pattern", fillPatternType: "clouds",
      fillPatternColor: "#FFFFFF", fillPatternBgColor: "#000000", ...extra } as any) as any;

  it("repite la tesela en vez de estirar una sola", () => {
    const css = conPatron({ fillPatternScale: 0.5 });
    expect(css.backgroundRepeat).toBe("repeat");
    expect(css.backgroundSize).toBe("80px 80px");
    expect(css["--oim-bg-tile"]).toBe("80px");
  });

  it("con velocidad se mueve en su direccion; sin velocidad, no", () => {
    expect(conPatron({ fillPatternSpeed: 6, fillPatternDirection: "up" }).animation).toBe("background-animation-up 6s linear infinite");
    expect(conPatron({ fillPatternSpeed: 0 }).animation).toBeUndefined();
  });

  it("la tesela es la misma que la de la capa de patron", () => {
    const campos = { fillPatternType: "stars", fillPatternColor: "#111111", fillPatternBgColor: "#EEEEEE", fillPatternScale: 1.5, fillPatternSpeed: 4, fillPatternDirection: "left" };
    const relleno: any = getFillCss({ type: "geo", fillType: "pattern", ...campos } as any);
    const capa: any = patternLayerCss({ type: "pattern", ...campos } as any);
    for (const k of ["backgroundImage", "backgroundSize", "backgroundRepeat", "animation", "--oim-bg-tile"]) {
      expect(relleno[k]).toBe(capa[k]);
    }
  });
});

describe("fase A: shapeMaskCss", () => {
  it("es la mascara de las formas, y patternShapeMask sigue siendo la misma", () => {
    expect(shapeMaskCss("circle")).toEqual(patternShapeMask("circle"));
    expect((shapeMaskCss("heart") as any).maskImage).toMatch(/^url\("data:image\/svg\+xml,/);
    expect(shapeMaskCss("rectangle")).toEqual({});
  });

  // An image fill keeps its colour under the photo; without a mask that colour
  // painted the whole box around an arch (the shape list stopped at 9 shapes).
  it("masks every closed catalogue shape, not only the pattern ones", () => {
    const closed = Object.entries(GEO_SHAPES)
      .filter(([, d]) => d.tipo === "polygon" || d.rellenable)
      .map(([name]) => name);
    expect(closed).toContain("arch");
    for (const name of closed) {
      expect((shapeMaskCss(name) as any).maskImage, name).toMatch(/^url\("data:image\/svg\+xml,/);
    }
  });

  it("leaves open strokes and unknown names unmasked", () => {
    expect(shapeMaskCss("line")).toEqual({});
    expect(shapeMaskCss("scribble")).toEqual({});
    expect(shapeMaskCss("no-such-shape")).toEqual({});
  });
});

describe("fase B: el relleno de patron pasa sus figuras", () => {
  it("las listas de la forma llegan a la tesela", () => {
    const css: any = getFillCss({ type: "geo", fillType: "pattern", fillPatternType: "stars", fillPatternSvgs: ["🔥"], fillPatternColors: ["#FF0000"], fillPatternCounts: [1], fillPatternDispersions: [0] } as any);
    const svg = decodeURIComponent(String(css.backgroundImage).replace(/^url\("data:image\/svg\+xml;utf8,/, "").replace(/"\)$/, ""));
    expect(svg).toContain("🔥");
    expect(svg).toContain("#FF0000");
  });
});




describe("svgSilhouetteMaskCss", () => {
  const decode = (css: Record<string, unknown>) =>
    decodeURIComponent(String(css.maskImage).replace(/^url\("data:image\/svg\+xml,/, "").replace(/"\)$/, ""));

  it("every fill turns black (as a gradient fill paints them all), strokes keep `none`", () => {
    // A pattern or generative fill on an icon painted its whole box.
    const icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 1" fill="transparent" style="stroke:#f00;fill:none"/><circle r="1" stroke="none"/></svg>`;
    const svg = decode(svgSilhouetteMaskCss(icon) as Record<string, unknown>);
    expect(svg).not.toMatch(/fill="(none|transparent)"|fill:none/);
    expect(svg).toContain("style=\"stroke:#000;fill:#000\"");
    expect(svg).toContain('stroke="#000" stroke-width="2"');
    expect(svg).toContain('stroke="none"');
    expect(svg).not.toMatch(/currentColor|#f00/);
  });

  it("stretches like the drawing and does not repeat", () => {
    const css = svgSilhouetteMaskCss(`<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>`) as Record<string, unknown>;
    expect(css.maskSize).toBe("100% 100%");
    expect(css.maskRepeat).toBe("no-repeat");
    expect(css.WebkitMaskImage).toBe(css.maskImage);
  });

  it("without an <svg> there is no mask", () => {
    expect(svgSilhouetteMaskCss("hola")).toEqual({});
  });
});

describe("getFillCss: image fill paints its colour underneath (contract 1.17.0)", () => {
  it("fillType image gives the fillColor as background, as a colour does", () => {
    expect(getFillCss({ type: "geo", fillType: "image", fillColor: "#d4d4d8", fillImage: "data:image/png;base64,aGVsbG8=" } as Shape))
      .toEqual({ backgroundColor: "#d4d4d8" });
  });

  it("without a colour there is no background", () => {
    expect(getFillCss({ type: "geo", fillType: "image" } as Shape)).toEqual({});
  });
});

describe("resolvePatternColors", () => {
  it("resolvePatternColors resuelve roles de paleta con respaldo seguro", () => {
    const shape = {
      fillPatternColor: "#112233",
      fillPatternColorRole: "accent" as const,
      fillPatternBgColor: "#ffffff",
      fillPatternBgColorRole: "surface" as const,
    };
    const palette = { accent: "#ff0088", surface: "#000000" };
    const resueltos = resolvePatternColors(shape, palette);
    expect(resueltos.fgColor).toBe("#ff0088");
    expect(resueltos.bgColor).toBe("#000000");

    const sinPaleta = resolvePatternColors(shape, null);
    expect(sinPaleta.fgColor).toBe("#112233");
    expect(sinPaleta.bgColor).toBe("#ffffff");
  });

  it("drops unsafe colours from the file or the palette", () => {
    const shape = {
      fillPatternColor: '#000"/><script>',
      fillPatternColorRole: "accent" as const,
      fillPatternBgColor: "url(x)",
    };
    expect(resolvePatternColors(shape, null)).toEqual({ fgColor: "#000000", bgColor: "transparent" });
    expect(resolvePatternColors(shape, { accent: "red;x:y" }).fgColor).toBe("#000000");
  });
});
