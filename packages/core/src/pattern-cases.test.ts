/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// The cases live in packages/spec/pattern-cases.json so every player (web,
// Flutter) lays a pattern tile out the same way: where each figure goes, its
// scale, rotation and colour.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { generatePatternSVG } from "./patterns.js";

type Figure = { x: number; y: number; scale: number; rotation: number; color: string };
type Case = { name: string; options: Parameters<typeof generatePatternSVG>[0]; figures: Figure[] };
const CASES: Case[] = JSON.parse(readFileSync(join(__dirname, "..", "..", "spec", "pattern-cases.json"), "utf8"));

const FIGURE = /<g transform="translate\(([-\d.e]+), ([-\d.e]+)\) scale\(([-\d.e]+)\) rotate\(([-\d.e]+)\) translate\(-12, -12\)" fill="([^"]+)" stroke="([^"]+)"/g;

describe("generatePatternSVG shared cases", () => {
  it("has cases", () => expect(CASES.length).toBeGreaterThan(3));
  for (const c of CASES) {
    it(c.name, () => {
      const svg = decodeURIComponent(generatePatternSVG(c.options).split(",")[1]);
      const got = [...svg.matchAll(FIGURE)].map((m) => ({
        x: +m[1], y: +m[2], scale: +m[3], rotation: +m[4], color: m[5] === "none" ? m[6] : m[5],
      }));
      expect(got).toEqual(c.figures);
    });
  }
});
