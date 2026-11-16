/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// The CDN player's generative fills and pattern tiles: separate scripts,
// fetched only when the document uses them.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureFeatures } from "./features-external.js";
import { renderGenerativeSVG } from "./generative-external.js";
import { patternTileUri, isMultiColorPattern } from "./patterns-external.js";

const scripts = (part: string) => Array.from(document.querySelectorAll(`script[data-oim-${part}]`)) as HTMLScriptElement[];
beforeEach(() => {
  const create = document.createElement.bind(document);
  document.createElement = function (tag: string, options?: ElementCreationOptions) {
    const el = create(tag, options);
    const off = Object.getOwnPropertySymbols(el).find((s) => s.description === "disableEvaluation");
    if (tag.toLowerCase() === "script" && off) (el as any)[off] = true;
    return el;
  } as typeof document.createElement;
});
afterEach(() => {
  document.querySelectorAll("script").forEach((s) => s.remove());
  delete (globalThis as any).__oimGenerative;
  delete (globalThis as any).__oimPatterns;
});

describe("optional parts as separate scripts", () => {
  it("a document without them fetches nothing", async () => {
    await ensureFeatures({ generative: false, patterns: false });
    expect(document.querySelectorAll("script")).toHaveLength(0);
  });

  it("fetches only the part the document uses, once, next to the player", async () => {
    const first = ensureFeatures({ generative: true, patterns: false });
    const second = ensureFeatures({ generative: true, patterns: false });
    expect(scripts("generative")).toHaveLength(1);
    expect(scripts("patterns")).toHaveLength(0);
    expect(scripts("generative")[0].src).toMatch(/\/vendor\/oim-generative/);
    (globalThis as any).__oimGenerative = { renderGenerativeSVG: () => "data:svg" };
    scripts("generative")[0].onload!(new Event("load"));
    await Promise.all([first, second]);
    expect(renderGenerativeSVG({} as never, { width: 1, height: 1 })).toBe("data:svg");
  });

  it("before it loads, a pattern or a generative fill paints nothing instead of throwing", () => {
    expect(patternTileUri({}, "", "#fff", "#000")).toBe("");
    expect(isMultiColorPattern({})).toBe(false);
    expect(renderGenerativeSVG({} as never, { width: 1, height: 1 })).toBe("");
  });

  it("a script that fails to load rejects with its URL", async () => {
    const pending = ensureFeatures({ generative: false, patterns: true });
    scripts("patterns")[0].onerror!(new Event("error"));
    await expect(pending).rejects.toThrow(/vendor\/oim-patterns/);
  });
});
