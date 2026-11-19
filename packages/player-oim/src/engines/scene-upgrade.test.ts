/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from "vitest";

const calls = vi.hoisted(() => ({ ensure: 0, gate: null as null | Promise<void> }));
vi.mock("../../../scene/src/runtime/upgrade-entry.js", async (real) => ({
  ...(await real<object>()),
  ensureUpgrade: async () => { calls.ensure++; if (calls.gate) await calls.gate; },
}));
import ImageEngine from "./ImageEngine";
import { doc2, paintedEngine } from "./scene-engine.fixture";

const v1 = { slots: [{ id: "a", type: "text", position: [0, 0], content: { es: "x" }, style: {} }], canvas: { width: 100, height: 100 } };
/** An engine with its shell, the 1.x file set, not yet painted. */
function bareEngine(file: object) {
  const host = document.createElement("div");
  host.attachShadow({ mode: "open" });
  const engine: any = new ImageEngine(host as any);
  engine._viewport = document.createElement("div");
  engine._overlay = document.createElement("div");
  engine._viewport.appendChild(engine._overlay);
  engine.fileMetadata = engine.metadata = file;
  return { host, engine };
}

describe("the upgrade script is fetched only for 1.x files", () => {
  it("a 2.0 file paints without asking for it", async () => {
    await paintedEngine(doc2([]));
    expect(calls.ensure).toBe(0);
  });

  it("a 1.x file asks for it", async () => {
    await paintedEngine(v1);
    expect(calls.ensure).toBe(1);
  });

  it("an unsigned file (nothing to paint) does not fetch it", async () => {
    calls.ensure = 0;
    await paintedEngine({ slots: [], elements: [], layers: [] });
    expect(calls.ensure).toBe(0);
  });

  it("if it fails to load, the player reports it and resolves with no scene", async () => {
    calls.gate = Promise.reject(new Error("blocked"));
    calls.gate.catch(() => {});
    const { host, engine } = bareEngine(v1);
    const errors: string[] = [];
    host.addEventListener("oim:error", (e: any) => errors.push(e.detail.code));
    await expect(engine.renderSlots()).resolves.toBeUndefined();
    expect(errors).toEqual(["chunk"]);
    expect(engine._scene).toBeNull();
    calls.gate = null;
  });

  it("destroyed while it loads, the player mounts nothing afterwards", async () => {
    let open!: () => void;
    calls.gate = new Promise<void>((r) => (open = r));
    const { engine } = bareEngine(v1);
    const pending = engine.renderSlots();
    engine.destroy();
    open();
    await pending;
    expect(engine._scene).toBeNull();
    expect(engine._overlay.querySelector("[data-oim-id]")).toBeNull();
    calls.gate = null;
  });

  it("of two renders in flight, only the latest mounts", async () => {
    let open!: () => void;
    calls.gate = new Promise<void>((r) => (open = r));
    const { engine } = bareEngine(v1);
    const first = engine.renderSlots();
    const second = engine.renderSlots();
    open();
    await Promise.all([first, second]);
    expect(engine._overlay.querySelectorAll(".oim-scene")).toHaveLength(1);
    calls.gate = null;
  });
});
