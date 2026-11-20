/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import ImageEngine from "./ImageEngine";
import { doc2, paintedEngine } from "./scene-engine.fixture";

const v1 = { slots: [{ id: "a", type: "text", position: [0, 0], content: { es: "x" }, style: {} }], canvas: { width: 100, height: 100 } };

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

describe("the player paints 2.0 only", () => {
  it("a 1.x file mounts no scene and reports unsupported-version", async () => {
    const { host, engine } = bareEngine(v1);
    const errors: string[] = [];
    host.addEventListener("oim:error", (e: any) => errors.push(e.detail.code));
    await expect(engine.renderSlots()).resolves.toBeUndefined();
    expect(errors).toEqual(["unsupported-version"]);
    expect(engine._scene).toBeNull();
  });

  it("a 2.0 file paints and reports nothing", async () => {
    const { engine } = await paintedEngine(doc2([]));
    expect((engine as any)._scene).not.toBeNull();
  });

  it("an empty 1.x file (nothing to paint) reports nothing", async () => {
    const { host, engine } = bareEngine({ slots: [], elements: [], layers: [] });
    const errors: string[] = [];
    host.addEventListener("oim:error", (e: any) => errors.push(e.detail.code));
    await engine.renderSlots();
    expect(errors).toEqual([]);
  });
});
