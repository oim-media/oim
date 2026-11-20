/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// @vitest-environment happy-dom

// A part of the player that does not load (a self-hosted copy without vendor/)
// must say so: an `oim:error` with code "chunk" and the URL, and the rest of
// the work still drawn. It used to fail in silence.
import { describe, it, expect, vi } from "vitest";

vi.mock("../../../scene/src/runtime/features-entry.js", () => ({
  ensureFeatures: () => Promise.reject(new Error("Could not load https://example.test/vendor/oim-patterns-x.js")),
}));

import { ImageEngine } from "./ImageEngine";
import { upgradeFixture } from '../test-utils/upgrade-fixture.js';

describe("a part that does not load", () => {
  it("is reported and does not stop the render", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    const engine = new ImageEngine(host);
    engine._overlay = document.createElement("div");
    shadow.appendChild(engine._overlay);
    engine.metadata = upgradeFixture({
      canvas_width: 800,
      canvas_height: 600,
      slots: [{ id: "a", type: "geo", content: { es: "" }, position: [0.1, 0.1], width_px: 100, height_px: 100, style: { fillColor: "#ff0000" } }],
    }) as any;

    const errors: any[] = [];
    host.addEventListener("oim:error", (e) => errors.push((e as CustomEvent).detail));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});

    await engine.renderSlots();

    expect(errors).toEqual([{ code: "chunk", message: expect.stringContaining("vendor/oim-patterns") }]);
    expect(quiet).toHaveBeenCalledWith(expect.any(String), expect.stringContaining("vendor/oim-patterns"));
    expect(engine._overlay!.querySelector('[data-oim-id="a"]')).not.toBeNull();
    quiet.mockRestore();
  });
});
