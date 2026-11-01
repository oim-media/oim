/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

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

const clean = (s: string) => sanitizeHtml(s).toLowerCase();

describe("hostile content is cleaned", () => {
  it("removes onload from the <svg> itself", () => {
    const output = clean('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><circle r="9"/></svg>');
    expect(output).not.toContain("onload");
    // but the shape is kept: sanitizing is not deleting
    expect(output).toContain("circle");
  });

  it("removes <script> even when it comes inside the SVG", () => {
    expect(clean('<svg><script>alert(1)</script><path d="M0 0"/></svg>')).not.toContain("<script");
  });

  it("removes onerror from a nested image", () => {
    expect(clean('<svg><image href="x" onerror="alert(1)"/></svg>')).not.toContain("onerror");
  });

  it("removes any on* handler, not only the known ones", () => {
    const output = clean('<svg onmouseover="a()" onfocus="b()" onanimationstart="c()"><rect/></svg>');
    expect(output).not.toContain("onmouseover");
    expect(output).not.toContain("onfocus");
    expect(output).not.toContain("onanimationstart");
  });

  it("removes <foreignObject>, which allows arbitrary HTML to be injected", () => {
    expect(clean('<svg><foreignObject><iframe src="x"></iframe></foreignObject></svg>')).not.toContain("iframe");
  });

  it("removes href with javascript:, in any box", () => {
    expect(clean('<svg><a href="JaVaScRiPt:alert(1)"><rect/></a></svg>')).not.toContain("javascript");
  });

  it("removes href with javascript: split by a line break", () => {
    // The browser normalizes this to `javascript:`; an `indexOf("javascript:")` did
    // not catch it. The scheme allowlist does.
    expect(clean('<svg><a href="java\nscript:alert(1)"><rect/></a></svg>')).not.toContain("script:");
  });

  it("removes <use href> pointing outside the document", () => {
    const output = clean('<svg><use href="http://malo.example/x.svg#i"/></svg>');
    expect(output).not.toContain("malo.example");
  });

  it("keeps <use href='#id'>, which is a legitimate internal reference", () => {
    expect(clean('<svg><defs><path id="p" d="M0 0"/></defs><use href="#p"/></svg>')).toContain('href="#p"');
  });
});

describe("lo legitimo sobrevive", () => {
  it("an icon with groups, stroke and fill stays intact", () => {
    const output = clean(
      '<svg viewBox="0 0 24 24"><g fill="none" stroke="#333" stroke-width="2" stroke-linecap="round">' +
      '<path d="M3 12h18"/><circle cx="12" cy="12" r="9"/></g></svg>'
    );
    for (const t of ["viewbox", "path", "circle", "stroke-width", "stroke-linecap", "fill"]) {
      expect(output, t).toContain(t);
    }
  });

  it("a gradient keeps its stops and units", () => {
    const output = clean(
      '<svg><defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#f00"/><stop offset="1" stop-color="#00f" stop-opacity="0.5"/>' +
      '</linearGradient></defs><rect fill="url(#g)"/></svg>'
    );
    for (const t of ["lineargradient", "gradientunits", "stop-color", "stop-opacity", "offset"]) {
      expect(output, t).toContain(t);
    }
  });

  it("a mask and a clip survive", () => {
    // This is what the shortcut was protecting: with the short list, they disappeared.
    const output = clean(
      '<svg><defs><clipPath id="c" clipPathUnits="objectBoundingBox"><path d="M0 0"/></clipPath>' +
      '<mask id="m" maskUnits="userSpaceOnUse"><rect fill="#fff"/></mask></defs>' +
      '<g clip-path="url(#c)" mask="url(#m)"><rect/></g></svg>'
    );
    for (const t of ["clippath", "clippathunits", "mask", "maskunits", "clip-path"]) {
      expect(output, t).toContain(t);
    }
  });

  it("a blur filter survives", () => {
    const output = clean(
      '<svg><defs><filter id="f" filterUnits="userSpaceOnUse">' +
      '<feGaussianBlur stdDeviation="3" result="b"/><feColorMatrix type="matrix" values="0 0 0"/>' +
      '</filter></defs><rect filter="url(#f)"/></svg>'
    );
    for (const t of ["filter", "fegaussianblur", "stddeviation", "fecolormatrix", "values"]) {
      expect(output, t).toContain(t);
    }
  });

  it("the transform and the fill-rule are not lost", () => {
    const output = clean('<svg><path d="M0 0" transform="translate(4 4) rotate(45)" fill-rule="evenodd"/></svg>');
    expect(output).toContain("transform");
    expect(output).toContain("fill-rule");
  });

  it("the HTML of a rich-text slot still works", () => {
    const output = clean('<div><span class="x"><b>Hola</b> <i>mundo</i></span></div>');
    for (const t of ["<div", "<span", "<b>", "<i>", "hola", "mundo"]) {
      expect(output, t).toContain(t);
    }
  });
});

describe("casos limite", () => {
  it("an empty string does not blow up", () => {
    expect(sanitizeHtml("")).toBe("");
  });

  it("text plano pasa tal cual", () => {
    expect(sanitizeHtml("Hola mundo")).toContain("Hola mundo");
  });
});
