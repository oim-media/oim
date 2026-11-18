/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it } from "vitest";
import { colorAtAlpha, textureCss } from "./texture-css.js";

// The strings the editor writes for the same textures.
describe("textureCss", () => {
  it("dots: a hard-stop radial dot per tile", () => {
    expect(textureCss({ type: "puntos", size: 20, thickness: 2, color: "#ff0000" }, 0.5)).toEqual({
      backgroundImage: "radial-gradient(circle, rgba(255, 0, 0, 0.5) 2px, transparent 2px)",
      backgroundSize: "20px 20px",
    });
  });

  it("lines: 0° is written 180°, crossed adds the perpendicular pass", () => {
    expect(textureCss({ type: "lines", angle: 0, size: 10, thickness: 1, color: "#fff" }, 0.2)!.backgroundImage).toBe(
      "repeating-linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0px, rgba(255, 255, 255, 0.2) 1px, transparent 1px, transparent 10px)",
    );
    const crossed = textureCss({ type: "lineas", angle: 45, crossed: true, size: 10 }, 0.2)!;
    expect(crossed.backgroundImage).toMatch(/^repeating-linear-gradient\(45deg.*repeating-linear-gradient\(135deg/);
    expect(crossed.backgroundSize).toBe("100% 100%, 100% 100%");
  });

  it("rings and grain", () => {
    expect(textureCss({ type: "anillos", size: 20, thickness: 2, color: "#000000" }, 1)!.backgroundImage).toBe(
      "repeating-radial-gradient(circle, transparent 0, transparent 18px, rgba(0, 0, 0, 1) 18px, rgba(0, 0, 0, 1) 20px, transparent 21px)",
    );
    const grain = textureCss({ type: "grano" }, 0.3)!;
    expect(grain.backgroundSize).toBe("128px 128px");
    expect(decodeURIComponent(grain.backgroundImage)).toContain('opacity="0.3"');
  });

  it("lengths go through len, so a player scales them with the canvas", () => {
    const css = textureCss({ type: "dots", size: 40, thickness: 4 }, 0.2, (px) => `${px / 10}cqw`)!;
    expect(css.backgroundImage).toContain(" 0.4cqw, transparent 0.4cqw");
    expect(css.backgroundSize).toBe("4cqw 4cqw");
  });

  it("an unknown kind draws nothing, and a colour that is not hex or rgb is white", () => {
    expect(textureCss({ type: "stars" })).toBeUndefined();
    expect(colorAtAlpha('red;background:url(x)', 0.5)).toBe("rgba(255, 255, 255, 0.5)");
    expect(decodeURIComponent(textureCss({ type: "grain", color: '"/><script>' }, 0.2)!.backgroundImage)).toContain('flood-color="#ffffff"');
  });
});
