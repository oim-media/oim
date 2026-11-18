/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { DYNAMIC_COLOR_ROLES } from "../../../core/src/dynamic-colors.js";
import { doc2, paintedEngine } from "./scene-engine.fixture";

const role = DYNAMIC_COLOR_ROLES[0];
const withPalettes = () => doc2([], {
  variables: { modes: { palette: ["light", "dark"] }, defaults: { palette: "light" }, values: { [role]: { light: "#123456", dark: "#abcdef" } } },
});
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
});
