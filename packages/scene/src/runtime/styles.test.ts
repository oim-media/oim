/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it } from "vitest";
import { injectStyles } from "./styles.js";

describe("injectStyles", () => {
  it("puts the loop and pattern keyframes inside the shadow root, where the layers can see them", () => {
    const shadow = document.createElement("div").attachShadow({ mode: "open" });
    injectStyles(shadow);
    const css = Array.from(shadow.querySelectorAll("style"), (s) => s.textContent).join("\n");
    expect(css).toContain("@keyframes oim-parallax-infinite");
    expect(css).toContain("@keyframes background-animation-right");
  });
});
