/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Phase 3 closed: the renderer paints only from 2.0; a slot with no 2.0 layer is not painted.
import { describe, expect, it, vi } from "vitest";
import ImageEngine from "./ImageEngine";
import { v2LayersOf } from "../../../scene/src/legacy/v2-layers.js";

describe("the renderer reads only 2.0", () => {
  it("a slot upgrade could not read is not painted, and says so", async () => {
    const host = document.createElement("div");
    const shadow = (host as any).attachShadow({ mode: "open" });
    document.body.appendChild(host);
    const engine: any = new ImageEngine(host as any);
    engine._overlay = document.createElement("div");
    shadow.appendChild(engine._overlay);
    const geo = (id: string) => ({ id, type: "geo", position: [0, 0], content: { es: "" }, style: { width: 50, height: 50, fillColor: "#f00", fillType: "color" } });
    engine.metadata = { canvas: { natural_width: 800, natural_height: 600 }, slots: [geo("a"), geo("b")] };
    v2LayersOf(engine.metadata).delete("b");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await engine.renderSlots();
    expect(shadow.querySelector('[data-slot-id="a"]')).not.toBeNull();
    expect(shadow.querySelector('[data-slot-id="b"]')).toBeNull();
    expect(warn.mock.calls.some((c) => String(c[0]).includes('"b" has no 2.0 layer'))).toBe(true);
    warn.mockRestore();
  });
});
