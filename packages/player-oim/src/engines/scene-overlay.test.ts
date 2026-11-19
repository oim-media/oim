/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { doc2, paintedEngine } from "./scene-engine.fixture";

describe("the overlay is the size of the document's canvas", () => {
  it("a 1000×500 canvas sizes the overlay that the fit factor scales", async () => {
    const { engine } = await paintedEngine(doc2([]));
    const o = engine._overlay as HTMLElement;
    expect(o.style.getPropertyValue("--oim-overlay-w")).toBe("1000px");
    expect(o.style.getPropertyValue("--oim-overlay-h")).toBe("500px");
  });
});
