/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from "vitest";
import { bindInteractions, MIN_HIT_AREA_PX } from "./interactions.js";

describe("bindInteractions", () => {
  it("a press runs its chain in order and never reverts it; the click goes on to the page", () => {
    const el = document.createElement("div");
    const page = vi.fn();
    const host = document.createElement("div");
    host.addEventListener("click", page);
    host.appendChild(el);
    const run = vi.fn();
    const actions = [{ type: "toggle" as const, target: "panel" }, { type: "hide" as const, target: "alert" }];
    bindInteractions(el, [{ on: "press", actions }], run);
    el.click();
    expect(run).toHaveBeenCalledWith(actions, false, "press");
    expect(run).toHaveBeenCalledTimes(1);
    expect(page).toHaveBeenCalledTimes(1);
  });

  it("a hover runs on entering and reverts on leaving", () => {
    const el = document.createElement("div");
    const run = vi.fn();
    bindInteractions(el, [{ on: "hover", actions: [{ type: "show", target: "tip" }] }], run);
    el.dispatchEvent(new Event("pointerenter"));
    el.dispatchEvent(new Event("pointerleave"));
    expect(run.mock.calls.map((c) => c[1])).toEqual([false, true]);
  });

  it("an interactive layer has a surface to touch and says it can be pressed", () => {
    const el = document.createElement("div");
    bindInteractions(el, [{ on: "press", actions: [{ type: "show", target: "x" }] }], () => {});
    expect(el.style.minWidth).toBe(`${MIN_HIT_AREA_PX}px`);
    expect(el.style.cursor).toBe("pointer");
  });

  it("a layer without interactions is left alone", () => {
    const el = document.createElement("div");
    bindInteractions(el, undefined, () => {});
    expect(el.style.cursor).toBe("");
  });
});
