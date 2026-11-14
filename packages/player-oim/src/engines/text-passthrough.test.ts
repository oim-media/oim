/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// The hover or click of a card usually lives on the shape behind its text.
// The text above swallowed the pointer, so the effect only fired on the edges.
// A text with no interaction of its own is marked to let the pointer through.

import { describe, it, expect } from "vitest";
import ImageEngine from "./ImageEngine";

async function render(slots: any[]) {
  const host = document.createElement("div");
  host.setAttribute("mode", "full");
  host.setAttribute("disable-animations", "true");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const motor: any = new ImageEngine(host as any);
  motor._viewport = document.createElement("div");
  shadow.appendChild(motor._viewport);
  motor._overlay = document.createElement("div");
  motor._viewport.appendChild(motor._overlay);
  motor.metadata = { slots, width: 800, height: 600 };
  await motor.renderSlots();
  return (id: string) => shadow.querySelector(`[data-slot-id="${id}"]`) as HTMLElement;
}

const text = (id: string, style: any = {}) => ({
  id, type: "text", align: "center", position: [10, 10], content: { es: id },
  style: { width: "30cqw", height: "8cqw", fontSize: "2cqw", ...style },
});

describe("pointer passes through plain text", () => {
  it("a plain text lets the pointer through to the shape behind", async () => {
    const get = await render([
      { id: "card", type: "geo", position: [10, 10], style: { width: "40cqw", height: "20cqw", fillColor: "#000", isInteractive: true, states: { hover: { scale: 1.05 } } } },
      text("label"),
    ]);
    expect(get("label").hasAttribute("data-oim-passthrough")).toBe(true);
    expect(get("card").hasAttribute("data-oim-passthrough")).toBe(false);
  });

  it("an interactive text keeps the pointer", async () => {
    const get = await render([text("button", { isInteractive: true, states: { hover: { scale: 1.1 } } })]);
    expect(get("button").hasAttribute("data-oim-passthrough")).toBe(false);
  });
  // A layer revealed by a click covered the button that hides it again: the
  // "broken" panel of the signature post, a full-canvas group.
  it("a shape or group with no interaction lets the pointer through", async () => {
    const get = await render([
      { id: "panel", type: "group", position: [0, 0], style: { width: "100cqw", height: "75cqw" } },
      { id: "cover", type: "geo", position: [0, 0], style: { width: "50cqw", height: "20cqw", fillColor: "#000", groupId: "panel" } },
      { id: "back", type: "geo", position: [0, 0], style: { width: "20cqw", height: "10cqw", fillColor: "#fff", groupId: "panel", isInteractive: true, states: { hover: { scale: 1.05 } } } },
    ]);
    expect(get("panel").hasAttribute("data-oim-passthrough")).toBe(true);
    expect(get("cover").hasAttribute("data-oim-passthrough")).toBe(true);
    expect(get("back").hasAttribute("data-oim-passthrough")).toBe(false);
  });

  it("a layer with a legacy click interaction keeps the pointer", async () => {
    const get = await render([
      { id: "old", type: "geo", position: [0, 0], style: { width: "20cqw", height: "10cqw", fillColor: "#000" },
        // The toggle's own keys: one that hides nothing does nothing, and 2.0 does not carry it.
        interaction: { action_type: "toggle_elements", target: { hide_slots: ["x"] } } },
    ]);
    expect(get("old").hasAttribute("data-oim-passthrough")).toBe(false);
  });
});
