/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Contract 1.12.0 (audit, 10 Oct 2026): the player reads one name per concept
// (no short slot aliases) and no longer applies the retired layer blend mode.
import { describe, it, expect } from "vitest";
import ImageEngine from "./ImageEngine";

function mount(slot: any) {
  const host = document.createElement("div");
  host.setAttribute("mode", "full");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const motor: any = new ImageEngine(host as any);
  motor._viewport = document.createElement("div");
  shadow.appendChild(motor._viewport);
  motor._overlay = document.createElement("div");
  motor._viewport.appendChild(motor._overlay);
  motor.lang = "es";
  motor.metadata = { width: 800, height: 600, slots: [{ id: "t", type: "text", align: "center", position: [10, 10], ...slot }] };
  return { motor, shadow };
}

describe("contract 1.12.0 in the player", () => {
  it("the short alias `st` is not read as the style", async () => {
    const { motor, shadow } = mount({ content: { es: "hola" }, st: { fillColor: "#ff0000", fontFamily: "Lora" } });
    await motor.renderSlots();
    const all = [...shadow.querySelectorAll("*")] as HTMLElement[];
    expect(all.some((e) => (e.style.fontFamily || "").includes("Lora"))).toBe(false);
  });

  it("the retired blend mode is not applied", async () => {
    const { motor, shadow } = mount({ content: { es: "hola" }, style: { blendMode: "multiply" } });
    await motor.renderSlots();
    const all = [...shadow.querySelectorAll("*")] as HTMLElement[];
    expect(all.some((e) => e.style.getPropertyValue("mix-blend-mode") === "multiply")).toBe(false);
  });
});
