/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { generatePatternSVG, PATTERN_PRESET_SVGS, recolorPatternSvg } from "./patterns";

const svgDe = (uri: string) => decodeURIComponent(uri.replace(/^data:image\/svg\+xml;utf8,/, ""));
const base = { type: "stars", bgColor: "#0F172A", fgColor: "#38BDF8", scale: 1 };

describe("phase B: quantity and dispersion per figure", () => {
  it("without per-figure lists, the tile is IDENTICAL to the earlier one", () => {
    const before = readFileSync(new URL("./__fixtures__/pattern-no-lists.txt", import.meta.url), "utf8");
    expect(generatePatternSVG({ ...base, colors: ["#38BDF8", "#EC4899"], svgs: ["stars", "heart"], sizes: [1, 1.5], count: 15, dispersion: 0.5 })).toBe(before);
  });

  it("with counts, each figure places exactly its quantity, on its grid", () => {
    const svg = svgDe(generatePatternSVG({ ...base, svgs: ["dots"], counts: [4], dispersions: [0] }));
    // 4 figures on a 2x2 grid of an 160px tile, no jitter: centres at 40 and 120.
    expect(svg.match(/translate\(-12, -12\)/g)?.length).toBe(4);
    for (const c of ["translate(40, 40)", "translate(120, 40)", "translate(40, 120)", "translate(120, 120)"]) expect(svg).toContain(c);
  });

  it("two figures with different quantities add up their quantities", () => {
    const svg = svgDe(generatePatternSVG({ ...base, svgs: ["dots", "stars"], counts: [1, 4], dispersions: [0, 0] }));
    expect(svg.match(/translate\(-12, -12\)/g)?.length).toBe(5);
  });
});

describe("phase B: figure safety", () => {
  it("a text figure is escaped", () => {
    const svg = svgDe(generatePatternSVG({ ...base, svgs: ['<b>"x"&'], counts: [1], dispersions: [0] }));
    expect(svg).toContain("&lt;b&gt;&quot;x&quot;&amp;");
    expect(svg).not.toContain("<b>");
  });

  it("a figure longer than 8000 characters falls back to the preset", () => {
    const svg = svgDe(generatePatternSVG({ ...base, svgs: ["x".repeat(9000)], counts: [1], dispersions: [0] }));
    expect(svg).not.toContain("xxxxxxxxxx");
    expect(svg).toContain(PATTERN_PRESET_SVGS.stars.slice(0, 20));
  });
});

describe("phase B: CSS compatibility of the data URI", () => {
  it("escapes parentheses in the URI so CSS parsers do not discard the background", () => {
    const uri = generatePatternSVG({ ...base, counts: [1], dispersions: [0] });
    const sinPrefijo = uri.replace(/^data:image\/svg\+xml;utf8,/, "");
    expect(sinPrefijo).toContain("%28");
    expect(sinPrefijo).toContain("%29");
    expect(sinPrefijo).not.toContain("(");
    expect(sinPrefijo).not.toContain(")");
  });
});

describe("recolorPatternSvg: keeps the geometry and reassigns colors", () => {
  it("replaces the background and figures, keeping the SVG structure intact", () => {
    const originalSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="100%" height="100%" fill="#18181b"/><g transform="translate(20, 20)" fill="#a3e635"><circle cx="12" cy="12" r="6"/></g><g transform="translate(60, 20)" fill="#a3e635"><circle cx="12" cy="12" r="6"/></g></svg>';
    const recolored = recolorPatternSvg(
      originalSvg,
      "#18181b",
      "#0f172a",
      "#a3e635",
      "#c084fc"
    );
    expect(recolored).toContain('fill="#0f172a"');
    expect(recolored).toContain('fill="#c084fc"');
    expect(recolored).not.toContain('fill="#18181b"');
    expect(recolored).not.toContain('fill="#a3e635"');
    expect(recolored).toContain('translate(20, 20)');
    expect(recolored).toContain('translate(60, 20)');
  });

  it("replaces colors regardless of letter case", () => {
    const originalSvg = '<svg><rect fill="#18181B"/><circle fill="#A3E635"/></svg>';
    const recolored = recolorPatternSvg(
      originalSvg,
      "#18181b",
      "#222222",
      "#a3e635",
      "#ff00ff"
    );
    expect(recolored).toBe('<svg><rect fill="#222222"/><circle fill="#ff00ff"/></svg>');
  });

  it("supports a list of several colors", () => {
    const originalSvg = '<svg><rect fill="#000"/><path fill="#111"/><path fill="#222"/></svg>';
    const recolored = recolorPatternSvg(
      originalSvg,
      "#000",
      "#fff",
      "#111",
      "#aaa",
      ["#111", "#222"],
      ["#aaa", "#bbb"]
    );
    expect(recolored).toBe('<svg><rect fill="#fff"/><path fill="#aaa"/><path fill="#bbb"/></svg>');
  });

  it("swaps an inverted pair in one pass, without repainting the first change", () => {
    const svg = '<svg><rect fill="#ffffff"/><circle fill="#000000"/></svg>';
    expect(recolorPatternSvg(svg, "#ffffff", "#000000", "#000000", "#ffffff")).toBe(
      '<svg><rect fill="#000000"/><circle fill="#ffffff"/></svg>'
    );
  });

  it("does not match a short hex inside a longer one", () => {
    const svg = '<svg><rect fill="#ffffff"/><circle fill="#fff"/></svg>';
    expect(recolorPatternSvg(svg, "#fff", "#111", "#222", "#333")).toBe(
      '<svg><rect fill="#ffffff"/><circle fill="#111"/></svg>'
    );
  });

  it("returns an empty string if the input SVG is empty", () => {
    expect(recolorPatternSvg("", "#000", "#111", "#222", "#333")).toBe("");
  });
});
