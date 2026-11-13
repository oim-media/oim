/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { setFlag } from "./attrs";

describe("setFlag", () => {
  it("writes the English name and the legacy name with the same value", () => {
    const el = document.createElement("div");
    setFlag(el, "data-oim-unsigned", "data-oim-sin-firma");
    expect(el.hasAttribute("data-oim-unsigned")).toBe(true);
    expect(el.hasAttribute("data-oim-sin-firma")).toBe(true);

    setFlag(el, "data-oim-group", "data-oim-grupo", "slot-7");
    expect(el.getAttribute("data-oim-group")).toBe("slot-7");
    expect(el.getAttribute("data-oim-grupo")).toBe("slot-7");
  });
});
