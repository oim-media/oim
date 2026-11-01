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

describe("getFillCss in @oim-media/player-oim", () => {
  const makeShape = (overrides: Partial<Shape> = {}): Shape => ({
    width: 200,
    height: 100,
    ...overrides
  });

  it("returns an empty object when there is no fillType or it is 'none'", () => {
    expect(getFillCss(makeShape({ fillType: "none" }))).toEqual({});
    expect(getFillCss(makeShape({}))).toEqual({});
  });

  it("translates fillType 'color' correctly for shapes and text", () => {
    const cssGeo = getFillCss(makeShape({ fillType: "color", fillColor: "#FF0000", type: "geo" }));
    expect(cssGeo).toEqual({ backgroundColor: "#FF0000" });

    const cssText = getFillCss(makeShape({ fillType: "color", fillColor: "#00FF00", type: "text" }));
    expect(cssText).toEqual({ color: "#00FF00" });
  });

  it("translates fillType 'gradient' for clipped text", () => {
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

  it("translates fillType 'pattern' with an SVG generator", () => {
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
  const layer = (extra: Record<string, unknown> = {}) =>
    ({ id: "p", type: "pattern", width: 200, height: 200,
       fillPatternType: "clouds", ...extra }) as any;

  // What SEPARATES the layer from the fill: the fill adjusts once ("cover",
  // "no-repeat"); the layer tiles.
  it("tile: repeat and a size, never cover", () => {
    const css = patternLayerCss(layer());
    expect(css.backgroundRepeat).toBe("repeat");
    expect(css.backgroundSize).toBe("160px 160px");
    expect(css.backgroundSize).not.toBe("cover");
  });

  it("the scale multiplies the tile: 160 * scale", () => {
    expect(patternLayerCss(layer({ fillPatternScale: 2.5 })).backgroundSize)
      .toBe("400px 400px");
  });

  it("paints the requested pattern", () => {
    const css = patternLayerCss(layer({ fillPatternColor: "#F59E0B" }));
    expect(String(css.backgroundImage)).toContain("data:image/svg+xml");
  });

  it("emits the animation with the direction and speed of the layer", () => {
    expect(patternLayerCss(layer({ fillPatternDirection: "left", fillPatternSpeed: 4 })).animation)
      .toBe("background-animation-left 4s linear infinite");
  });

  it("with no declared direction it moves right, like the background", () => {
    expect(String(patternLayerCss(layer({ fillPatternSpeed: 4 })).animation))
      .toContain("background-animation-right");
  });

  // A still layer must NOT pay for a composition cycle.
  it.each([
    ["direccion none", { fillPatternDirection: "none", fillPatternSpeed: 8 }],
    ["speed 0",    { fillPatternSpeed: 0 }],
    ["speed negativa", { fillPatternSpeed: -4 }],
    ["no speed",  {}],
  ])("NO emite animacion: %s", (_caso, extra) => {
    expect(patternLayerCss(layer(extra)).animation).toBeUndefined();
  });

  // A foreign `.oim` can carry anything.
  it("an unknown direction emits no animation and does not throw", () => {
    expect(patternLayerCss(layer({ fillPatternDirection: "diagonal", fillPatternSpeed: 8 } as any)).animation)
      .toBeUndefined();
  });

  it("publishes the tile as --oim-bg-tile, which is what the keyframes read", () => {
    expect((patternLayerCss(layer({ fillPatternScale: 2 })) as any)["--oim-bg-tile"])
      .toBe("320px");
  });

  // A pattern type that the generator does not know: the layer comes out transparent,
  // but it is NOT thrown. A foreign `.oim` must not be able to bring the viewer down.
  it("an unknown pattern type does not throw", () => {
    expect(() => patternLayerCss(layer({ fillPatternType: "no-existe" }))).not.toThrow();
  });
});

describe("the pattern layer is a WINDOW, not a canvas that stretches", () => {
  const layer = (extra: Record<string, unknown> = {}) =>
    ({ id: "p", type: "pattern", fillPatternType: "clouds", ...extra }) as any;

  // The invariant that defines the layer: resizing it shows MORE or LESS
  // pattern, not a bigger or smaller one. What fixes it is the
  // scale, not the node's size -just like the moving background-.
  it("the motif size does NOT depend on the layer size", () => {
    const small = patternLayerCss(layer({ width: 120, height: 90 }));
    const large = patternLayerCss(layer({ width: 960, height: 720 }));
    expect(small.backgroundSize).toBe(large.backgroundSize);
    expect(small.backgroundSize).toBe("160px 160px");
  });

  // What DOES change it is the scale, which is the author's control.
  it("but the scale does change it", () => {
    expect(patternLayerCss(layer({ width: 120, fillPatternScale: 2 })).backgroundSize)
      .toBe("320px 320px");
  });

  // `repeat` is what makes enlarging the window show more pattern instead of
  // a gap.
  it("and when enlarged, more pattern appears, not a gap", () => {
    expect(patternLayerCss(layer({ width: 960, height: 720 })).backgroundRepeat)
      .toBe("repeat");
  });
});

describe("the shapes of the pattern layer", () => {
  const svgOf = (css: any) => decodeURIComponent(String(css.maskImage).replace(/^url\("data:image\/svg\+xml,/, "").replace(/"\)$/, ""));

  it("are exactly these nine, in this order", () => {
    expect(PATTERN_SHAPES).toEqual(["rectangle", "circle", "triangle", "star", "diamond", "hexagon", "heart", "arrow", "blob"]);
  });

  it("each shape carries EXACTLY the GEO_SHAPES geometry, stretched to the box", () => {
    for (const id of PATTERN_SHAPES.filter((s) => s !== "rectangle")) {
      const css: any = patternShapeMask(id);
      const svg = svgOf(css);
      const d = GEO_SHAPES[id];
      if (d.kind === "polygon") expect(svg).toContain(`points="${pointsToAttribute(d.points)}"`);
      else expect(svg).toContain(`d="${d.d}"`);
      expect(svg).toContain('viewBox="0 0 100 100"');
      expect(svg).toContain('preserveAspectRatio="none"');
      expect(css.maskSize).toBe("100% 100%");
      expect(css.maskRepeat).toBe("no-repeat");
      expect(css.WebkitMaskImage).toBe(css.maskImage);
    }
  });

  it("the rectangle, open shapes and unknown ones carry no mask", () => {
    for (const id of [undefined, "rectangle", "rect", "line", "scribble", "no-existe"]) {
      expect(patternShapeMask(id as any)).toEqual({});
    }
  });

  it("patternLayerCss includes the shape mask", () => {
    const css: any = patternLayerCss({ type: "pattern", fillPatternType: "clouds", geoShape: "circle" } as any);
    expect(css.maskImage).toBe((patternShapeMask("circle") as any).maskImage);
    expect(css.backgroundRepeat).toBe("repeat");
  });
});

describe("phase A: a pattern fill on a shape tiles and moves", () => {
  const conPatron = (extra: Record<string, unknown> = {}) =>
    getFillCss({ type: "geo", width: 200, height: 100, fillType: "pattern", fillPatternType: "clouds",
      fillPatternColor: "#FFFFFF", fillPatternBgColor: "#000000", ...extra } as any) as any;

  it("repeats the tile instead of stretching a single one", () => {
    const css = conPatron({ fillPatternScale: 0.5 });
    expect(css.backgroundRepeat).toBe("repeat");
    expect(css.backgroundSize).toBe("80px 80px");
    expect(css["--oim-bg-tile"]).toBe("80px");
  });

  it("with speed it moves in its direction; without speed, it does not", () => {
    expect(conPatron({ fillPatternSpeed: 6, fillPatternDirection: "up" }).animation).toBe("background-animation-up 6s linear infinite");
    expect(conPatron({ fillPatternSpeed: 0 }).animation).toBeUndefined();
  });

  it("the tile is the same as the one of the pattern layer", () => {
    const fields = { fillPatternType: "stars", fillPatternColor: "#111111", fillPatternBgColor: "#EEEEEE", fillPatternScale: 1.5, fillPatternSpeed: 4, fillPatternDirection: "left" };
    const fillCss: any = getFillCss({ type: "geo", fillType: "pattern", ...fields } as any);
    const layer: any = patternLayerCss({ type: "pattern", ...fields } as any);
    for (const k of ["backgroundImage", "backgroundSize", "backgroundRepeat", "animation", "--oim-bg-tile"]) {
      expect(fillCss[k]).toBe(layer[k]);
    }
  });
});

describe("fase A: shapeMaskCss", () => {
  it("is the shape mask, and patternShapeMask stays the same", () => {
    expect(shapeMaskCss("circle")).toEqual(patternShapeMask("circle"));
    expect((shapeMaskCss("heart") as any).maskImage).toMatch(/^url\("data:image\/svg\+xml,/);
    expect(shapeMaskCss("rectangle")).toEqual({});
  });

  // An image fill keeps its colour under the photo; without a mask that colour
  // painted the whole box around an arch (the shape list stopped at 9 shapes).
  it("masks every closed catalogue shape, not only the pattern ones", () => {
    const closed = Object.entries(GEO_SHAPES)
      .filter(([, d]) => d.kind === "polygon" || d.fillable)
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

describe("phase B: the pattern fill passes its figures through", () => {
  it("the lists of the shape reach the tile", () => {
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
  it("resolvePatternColors resolves palette roles with a safe fallback", () => {
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
