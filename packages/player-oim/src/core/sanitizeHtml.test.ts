/**
 * @vitest-environment jsdom
 *
 * `sanitizeHtml` had a shortcut that skipped ALL sanitizing for anything that starts with
 * `<svg`. Since every SVG starts that way, the filter never ran on vector content: an
 * authored `<svg onload="...">` reached the live document intact, and the `.oim` travels
 * to third parties.
 *
 * These tests run in two directions at once, and both matter:
 *
 *   - the hostile content is cleaned
 *   - the LEGITIMATE content survives
 *
 * The second group is not filler. The shortcut was added because the allowlist was so
 * short that it mutilated good SVG, so without these tests the fix gets reverted as soon as
 * someone sees a mask disappear.
 */

import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "./security";

const limpio = (s: string) => sanitizeHtml(s).toLowerCase();

describe("lo hostil se limpia", () => {
  it("quita onload del propio <svg>", () => {
    const salida = limpio('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><circle r="9"/></svg>');
    expect(salida).not.toContain("onload");
    // but the shape is kept: sanitizing is not deleting
    expect(salida).toContain("circle");
  });

  it("quita <script> aunque venga dentro del SVG", () => {
    expect(limpio('<svg><script>alert(1)</script><path d="M0 0"/></svg>')).not.toContain("<script");
  });

  it("quita onerror de una imagen anidada", () => {
    expect(limpio('<svg><image href="x" onerror="alert(1)"/></svg>')).not.toContain("onerror");
  });

  it("quita cualquier manejador on*, no solo los conocidos", () => {
    const salida = limpio('<svg onmouseover="a()" onfocus="b()" onanimationstart="c()"><rect/></svg>');
    expect(salida).not.toContain("onmouseover");
    expect(salida).not.toContain("onfocus");
    expect(salida).not.toContain("onanimationstart");
  });

  it("quita <foreignObject>, que permite meter HTML arbitrario", () => {
    expect(limpio('<svg><foreignObject><iframe src="x"></iframe></foreignObject></svg>')).not.toContain("iframe");
  });

  it("quita href con javascript:, en cualquier caja", () => {
    expect(limpio('<svg><a href="JaVaScRiPt:alert(1)"><rect/></a></svg>')).not.toContain("javascript");
  });

  it("quita href con javascript: partido por un salto de linea", () => {
    // The browser normalizes this to `javascript:`; an `indexOf("javascript:")` did
    // not catch it. The scheme allowlist does.
    expect(limpio('<svg><a href="java\nscript:alert(1)"><rect/></a></svg>')).not.toContain("script:");
  });

  it("quita <use href> apuntando fuera del documento", () => {
    const salida = limpio('<svg><use href="http://malo.example/x.svg#i"/></svg>');
    expect(salida).not.toContain("malo.example");
  });

  it("conserva <use href='#id'>, que es una referencia interna legitima", () => {
    expect(limpio('<svg><defs><path id="p" d="M0 0"/></defs><use href="#p"/></svg>')).toContain('href="#p"');
  });
});

describe("lo legitimo sobrevive", () => {
  it("un icono con grupos, trazo y fill queda intacto", () => {
    const salida = limpio(
      '<svg viewBox="0 0 24 24"><g fill="none" stroke="#333" stroke-width="2" stroke-linecap="round">' +
      '<path d="M3 12h18"/><circle cx="12" cy="12" r="9"/></g></svg>'
    );
    for (const t of ["viewbox", "path", "circle", "stroke-width", "stroke-linecap", "fill"]) {
      expect(salida, t).toContain(t);
    }
  });

  it("un degradado conserva sus paradas y unidades", () => {
    const salida = limpio(
      '<svg><defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#f00"/><stop offset="1" stop-color="#00f" stop-opacity="0.5"/>' +
      '</linearGradient></defs><rect fill="url(#g)"/></svg>'
    );
    for (const t of ["lineargradient", "gradientunits", "stop-color", "stop-opacity", "offset"]) {
      expect(salida, t).toContain(t);
    }
  });

  it("una mascara y un recorte sobreviven", () => {
    // This is what the shortcut was protecting: with the short list, they disappeared.
    const salida = limpio(
      '<svg><defs><clipPath id="c" clipPathUnits="objectBoundingBox"><path d="M0 0"/></clipPath>' +
      '<mask id="m" maskUnits="userSpaceOnUse"><rect fill="#fff"/></mask></defs>' +
      '<g clip-path="url(#c)" mask="url(#m)"><rect/></g></svg>'
    );
    for (const t of ["clippath", "clippathunits", "mask", "maskunits", "clip-path"]) {
      expect(salida, t).toContain(t);
    }
  });

  it("un filtro de desenfoque sobrevive", () => {
    const salida = limpio(
      '<svg><defs><filter id="f" filterUnits="userSpaceOnUse">' +
      '<feGaussianBlur stdDeviation="3" result="b"/><feColorMatrix type="matrix" values="0 0 0"/>' +
      '</filter></defs><rect filter="url(#f)"/></svg>'
    );
    for (const t of ["filter", "fegaussianblur", "stddeviation", "fecolormatrix", "values"]) {
      expect(salida, t).toContain(t);
    }
  });

  it("el transform y el fill-rule no se pierden", () => {
    const salida = limpio('<svg><path d="M0 0" transform="translate(4 4) rotate(45)" fill-rule="evenodd"/></svg>');
    expect(salida).toContain("transform");
    expect(salida).toContain("fill-rule");
  });

  it("el HTML de un slot de text enriquecido sigue funcionando", () => {
    const salida = limpio('<div><span class="x"><b>Hola</b> <i>mundo</i></span></div>');
    for (const t of ["<div", "<span", "<b>", "<i>", "hola", "mundo"]) {
      expect(salida, t).toContain(t);
    }
  });
});

describe("casos limite", () => {
  it("una cadena vacia no revienta", () => {
    expect(sanitizeHtml("")).toBe("");
  });

  it("text plano pasa tal cual", () => {
    expect(sanitizeHtml("Hola mundo")).toContain("Hola mundo");
  });
});
