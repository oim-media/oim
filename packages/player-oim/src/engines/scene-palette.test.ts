/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { DYNAMIC_COLOR_ROLES } from "../../../core/src/dynamic-colors.js";
import { doc2, paintedEngine } from "./scene-engine.fixture";

const role = DYNAMIC_COLOR_ROLES[0];
const withPalettes = (modes = ["light", "dark"]) => doc2([], {
  variables: { modes: { palette: modes }, defaults: { palette: "light" }, values: { [role]: { light: "#123456", dark: "#abcdef" } } },
});
const prefersDark = (dark: boolean) =>
  vi.stubGlobal("matchMedia", vi.fn((q: string) => ({ matches: q.includes("dark") && dark, addEventListener() {}, removeEventListener() {} })));
afterEach(() => vi.unstubAllGlobals());
const paletteOf = (engine: any) => (engine._overlay.querySelector(".oim-scene") as HTMLElement).style.getPropertyValue(`--oim-palette-${role}`);

describe("the host's palette reaches the scene", () => {
  it("the palette attribute picks the file's palette", async () => {
    const { engine } = await paintedEngine(withPalettes(), { palette: "dark" });
    expect(paletteOf(engine)).toBe("#abcdef");
  });

  it('allow-dynamic-colors="false" keeps the file\'s own default', async () => {
    const { engine } = await paintedEngine(withPalettes(), { palette: "dark", "allow-dynamic-colors": "false" });
    expect(paletteOf(engine)).toBe("#123456");
  });

  it("a palette change repaints the scene with it", async () => {
    const { engine, host } = await paintedEngine(withPalettes());
    expect(paletteOf(engine)).toBe("#123456");
    host.setAttribute("palette", "dark");
    engine.applyPalette();
    await new Promise((r) => setTimeout(r, 0));
    expect(paletteOf(engine)).toBe("#abcdef");
  });

  it("without the attribute, a dark system picks the file's dark palette", async () => {
    prefersDark(true);
    const { engine } = await paintedEngine(withPalettes());
    expect(paletteOf(engine)).toBe("#abcdef");
  });

  it("without the attribute, a light system picks light", async () => {
    prefersDark(false);
    const { engine } = await paintedEngine(withPalettes());
    expect(paletteOf(engine)).toBe("#123456");
  });

  it("the system preference only chooses when the file has both a dark and a light palette", async () => {
    prefersDark(true);
    const { engine } = await paintedEngine(withPalettes(["light", "night"]));
    expect(paletteOf(engine)).toBe("#123456");
  });

  it("a change of system scheme repaints live", async () => {
    prefersDark(true);
    const { engine } = await paintedEngine(withPalettes());
    prefersDark(false);
    engine.applyPalette();
    await new Promise((r) => setTimeout(r, 0));
    expect(paletteOf(engine)).toBe("#123456");
  });
});
