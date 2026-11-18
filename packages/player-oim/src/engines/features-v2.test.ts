/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// @vitest-environment happy-dom

// A 2.0 file keeps its layers apart from the 1.x view the renderer paints
// (v2LayersOf). The optional parts it needs must be read from those layers:
// reading only the view missed the pattern of `pattern-color-roles` and the CDN
// player painted it empty.
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const { ensureFeatures } = vi.hoisted(() => ({ ensureFeatures: vi.fn(() => Promise.resolve()) }));
vi.mock("../../../scene/src/runtime/features-entry.js", () => ({ ensureFeatures }));

import { extractOIM } from "../../../core/src/binary.js";
import { resolveRefs } from "../../../core/src/v2/resources.js";
import { legacyView } from "../../../scene/src/legacy/legacy-view.js";
import { ImageEngine } from "./ImageEngine";

describe("the optional parts of a 2.0 file", () => {
  it("are read from its layers, not only from the view", async () => {
    const file = join(__dirname, "..", "..", "..", "spec", "vectors-2", "pattern-color-roles.oim.png");
    const { metadata } = (await extractOIM({ arrayBuffer: async () => new Uint8Array(readFileSync(file)).buffer } as any)) as any;
    const host = document.createElement("div");
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    const engine = new ImageEngine(host);
    engine._overlay = document.createElement("div");
    shadow.appendChild(engine._overlay);
    engine.metadata = legacyView(resolveRefs(metadata).document) as any;

    await engine.renderSlots();

    expect(ensureFeatures).toHaveBeenCalledWith({ generative: false, patterns: true });
  });
});
