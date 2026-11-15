/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Layer, OimDocument } from "@oim-media/core/v2";
import { describe, expect, it, vi } from "vitest";
import * as box from "./box.js";
import { mount } from "./index.js";

// Every write of a layer's box goes through applyBox: counting its calls counts the writes.
vi.mock("./box.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./box.js")>();
  return { ...actual, applyBox: vi.fn(actual.applyBox) };
});

const doc = (layers: Layer[]): OimDocument => ({ oim: "2.0.0-draft.1", canvas: { width: 1000, height: 500 }, languages: ["es"], layers }) as OimDocument;
const shape = (id: string, x = 100): Layer =>
  ({ id, type: "shape", box: { x, y: 100, width: 500, height: 100 }, geometry: { kind: "rect" }, fills: [{ kind: "color", value: "#ff0000" }] }) as Layer;

// The browser normalises a colour (#00ff00 becomes rgb()): compare with what the element keeps.
const kept = (color: string) => {
  const probe = document.createElement("div");
  probe.style.backgroundColor = color;
  return probe.style.backgroundColor;
};

describe("update", () => {
  it("changing a fill repaints the same element, and leaves the others alone", () => {
    const scene = mount(document.createElement("div"), doc([shape("a"), shape("b", 0)]));
    const el = scene.elementOf("a")!;
    const other = scene.elementOf("b")!.style.backgroundColor;
    scene.update("a", { fills: [{ kind: "color", value: "#00ff00" }] });
    expect(scene.elementOf("a")).toBe(el);
    expect(el.style.backgroundColor).toBe(kept("#00ff00"));
    expect(scene.elementOf("b")!.style.backgroundColor).toBe(other);
  });

  it("an id that does not exist, or a scene already destroyed, is a no-op", () => {
    const host = document.createElement("div");
    const scene = mount(host, doc([shape("a")]));
    expect(() => scene.update("nope", { fills: [] })).not.toThrow();
    const before = scene.elementOf("a")!.style.left;
    scene.destroy();
    expect(() => scene.update("a", { box: { x: 0, y: 0, width: 1, height: 1 } })).not.toThrow();
    expect(() => scene.setTransform("a", { x: 0, y: 0, width: 1, height: 1 })).not.toThrow();
    expect(before).not.toBe("");
  });

  it("300 moves in one frame write the style of the moved layer at most twice", async () => {
    const scene = mount(document.createElement("div"), doc([shape("a")]));
    const el = scene.elementOf("a")!;
    vi.mocked(box.applyBox).mockClear();
    for (let i = 0; i < 300; i++) scene.setTransform("a", { x: i, y: 100, width: 500, height: 100 });
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    const writes = vi.mocked(box.applyBox).mock.calls.filter(([target]) => target === el).length;
    expect(writes).toBeLessThanOrEqual(2);
    expect(el.style.left).toBe("29.9%");
  });
});
