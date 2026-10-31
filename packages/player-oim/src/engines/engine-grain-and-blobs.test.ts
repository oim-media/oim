/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from "vitest";
import ImageEngine from "./ImageEngine";

describe("ImageEngine Grain and Generative Support", () => {
  let host: HTMLElement;
  let shadow: ShadowRoot;

  beforeEach(() => {
    host = document.createElement("div");
    shadow = host.attachShadow({ mode: "open" });
    document.body.appendChild(host);
  });

  it("injects non-blocking global noise overlay when grain.enabled is true", async () => {
    const motor = new ImageEngine(host as any);
    motor._viewport = document.createElement("div");
    motor._viewport.className = "oim-viewport";
    shadow.appendChild(motor._viewport);
    motor._overlay = document.createElement("div");
    motor._overlay.className = "oim-layer-overlay";
    motor._viewport.appendChild(motor._overlay);

    motor.metadata = {
      width: 800,
      height: 600,
      grain: { enabled: true, intensity: 15, blendMode: "overlay" },
      slots: [],
    } as any;

    await motor.renderSlots();

    const grainOverlay = motor._viewport.querySelector(".oim-noise-overlay") as HTMLElement;
    expect(grainOverlay).not.toBeNull();
    expect(grainOverlay.style.pointerEvents).toBe("none");
    expect(grainOverlay.style.mixBlendMode).toBe("overlay");
  });

  it("does not inject noise overlay when grain is omitted or disabled", async () => {
    const motor = new ImageEngine(host as any);
    motor._viewport = document.createElement("div");
    motor._viewport.className = "oim-viewport";
    shadow.appendChild(motor._viewport);
    motor._overlay = document.createElement("div");
    motor._overlay.className = "oim-layer-overlay";
    motor._viewport.appendChild(motor._overlay);

    motor.metadata = {
      width: 800,
      height: 600,
      grain: { enabled: false },
      slots: [],
    } as any;

    await motor.renderSlots();

    const grainOverlay = motor._viewport.querySelector(".oim-noise-overlay");
    expect(grainOverlay).toBeNull();
  });

  it("renders generative blob shape via geoShape='blob'", async () => {
    const motor = new ImageEngine(host as any);
    motor._viewport = document.createElement("div");
    motor._viewport.className = "oim-viewport";
    shadow.appendChild(motor._viewport);
    motor._overlay = document.createElement("div");
    motor._overlay.className = "oim-layer-overlay";
    motor._viewport.appendChild(motor._overlay);

    motor.metadata = {
      width: 800,
      height: 600,
      slots: [
        {
          id: "blob-shape-1",
          type: "shape",
          position: [10, 10],
          style: { geoShape: "blob", fillColor: "#38bdf8" },
        },
      ],
    } as any;

    await motor.renderSlots();

    const blobNode = host.shadowRoot!.querySelector('[data-slot-id="blob-shape-1"] path');
    expect(blobNode).not.toBeNull();
    expect(blobNode?.getAttribute("d")).toContain("M");
  });
});
