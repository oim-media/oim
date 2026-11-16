/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Effect } from "@oim-media/core/v2";
import { describe, expect, it } from "vitest";
import { effectsToStyle, type EffectContext } from "./effects.js";

const ctx = (o: Partial<EffectContext> = {}): EffectContext => ({ isText: false, grainable: false, layerId: "a", colorCss: (c) => (typeof c === "string" ? c : undefined), ...o });

describe("effectsToStyle", () => {
  it("no effects, no style and no defs", () => {
    expect(effectsToStyle(undefined, ctx())).toEqual({ filter: "", textShadow: "", backdropFilter: undefined, defs: [] });
  });

  it("a grain is a filter on the layer only where the layer type takes one", () => {
    const grain: Effect[] = [{ kind: "grain", intensity: 20 }];
    expect(effectsToStyle(grain, ctx({ grainable: true, layerId: "a b" })).filter).toBe("url(#oim-grain-a_b)");
    expect(effectsToStyle(grain, ctx({ grainable: true, layerId: "a b" })).defs).toEqual([{ kind: "grain", id: "oim-grain-a_b", effect: grain[0] }]);
    expect(effectsToStyle(grain, ctx({ grainable: false }))).toEqual({ filter: "", textShadow: "", backdropFilter: undefined, defs: [] });
  });

  it("a texture is a def for the renderer: it paints an overlay or the text's background, not a filter", () => {
    const texture: Effect = { kind: "texture", preset: "paper" };
    expect(effectsToStyle([texture], ctx())).toEqual({ filter: "", textShadow: "", backdropFilter: undefined, defs: [{ kind: "texture", effect: texture }] });
  });

  it("a duotone backdrop is a def, and no backdrop-filter of its own", () => {
    const style = effectsToStyle([{ kind: "backdrop", preset: "duotone" }], ctx());
    expect(style.backdropFilter).toBeUndefined();
    expect(style.defs).toEqual([{ kind: "duotone" }]);
  });
});
