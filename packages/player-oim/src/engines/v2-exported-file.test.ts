/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// @vitest-environment happy-dom

// The first file the editor exported as 2.0 (an e-commerce card, 15 Nov 2026) painted
// without its canvas colour and with its scissors drawing as a white box: the conformance
// vectors were all upgraded 1.x files, which never had a canvas fill or a filled drawing.
import { describe, it, expect, vi } from "vitest";

vi.mock("../../../scene/src/legacy/features-entry.js", () => ({ ensureFeatures: () => Promise.resolve() }));

import { legacyView } from "../../../scene/src/legacy/legacy-view.js";
import { ImageEngine } from "./ImageEngine";

const scissors = "M8 14L10 12L8 9a4 4 0 1 1 1-1L12 10l8-8a1 1 0 1 1 1 1L9 15a4 4 0 1 1-1-1";

const exported = {
  oim: "2.0.0-draft.1",
  canvas: { width: 400, height: 200, fills: [{ kind: "color", value: "#D88C9A" }] },
  languages: ["es", "en"],
  layers: [
    {
      id: "scissors",
      type: "shape",
      box: { x: 92, y: 161, width: 49, height: 32 },
      fills: [{ kind: "color", value: "#FFFFFF" }],
      geometry: { kind: "paths", viewBox: [0, 0, 24, 24], paths: [{ d: scissors, fill: "currentColor" }] },
    },
  ],
};

async function render() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  const engine = new ImageEngine(host);
  engine._overlay = document.createElement("div");
  shadow.appendChild(engine._overlay);
  engine.metadata = legacyView(structuredClone(exported) as never) as never;
  await engine.renderSlots();
  return engine._overlay as HTMLElement;
}

describe("a file exported as 2.0", () => {
  it("paints its canvas colour behind the layers", async () => {
    const overlay = await render();
    expect(["#d88c9a", "rgb(216, 140, 154)"]).toContain(overlay.style.backgroundColor.toLowerCase());
  });

  it("paints a filled drawing as its paths, not as a filled box", async () => {
    const overlay = await render();
    const slot = overlay.querySelector('[data-slot-id="scissors"]') as HTMLElement;
    expect(slot.querySelector("svg path")).not.toBeNull();
    expect(["", "transparent", "rgba(0, 0, 0, 0)"]).toContain(slot.style.backgroundColor);
  });
});
