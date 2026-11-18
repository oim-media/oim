/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// The CDN player's `upgrade` is a separate script, fetched once, only when needed.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureUpgrade, upgrade } from "./upgrade-external.js";

const scripts = () => Array.from(document.querySelectorAll("script[data-oim-upgrade]")) as HTMLScriptElement[];
// happy-dom would try to run the script; it only has to be put on the page.
beforeEach(() => {
  const create = document.createElement.bind(document);
  document.createElement = function (tag: string, options?: ElementCreationOptions) {
    const el = create(tag, options);
    const off = Object.getOwnPropertySymbols(el).find((s) => s.description === "disableEvaluation");
    if (tag.toLowerCase() === "script" && off) (el as any)[off] = true;
    return el;
  } as typeof document.createElement;
});
afterEach(() => { scripts().forEach((s) => s.remove()); delete (globalThis as any).__oimUpgrade; });

describe("upgrade as a separate script", () => {
  it("is not callable before it is loaded", () => {
    expect(() => upgrade({} as never)).toThrow("ensureUpgrade");
  });

  it("is fetched once, next to the player, and then runs", async () => {
    const first = ensureUpgrade();
    const second = ensureUpgrade();
    expect(scripts()).toHaveLength(1);
    expect(scripts()[0].src).toMatch(/\/vendor\/oim-upgrade/);
    (globalThis as any).__oimUpgrade = () => ({ document: { layers: [] } });
    scripts()[0].onload!(new Event("load"));
    await Promise.all([first, second]);
    expect(upgrade({} as never)).toEqual({ document: { layers: [] } });
  });

  it("already there, nothing is fetched", async () => {
    (globalThis as any).__oimUpgrade = () => ({});
    await ensureUpgrade();
    expect(scripts()).toEqual([]);
  });
});
