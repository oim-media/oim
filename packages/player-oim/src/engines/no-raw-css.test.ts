/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A .oim no longer carries raw CSS. Contract 1.9.0.
 *
 * `custom_keyframes` went into a whole `<style>` sheet, filtered only for
 * `url(...)`: `@import "https://x"`, `image-set("https://x" 1x)` and an
 * escaped `\75rl(...)` all passed. `custom_hover_css` was not filtered at all
 * and was pasted inside `{ ... }`, so a `}` escaped the rule and could restyle
 * the whole player -ping a third party on load, or hide its own warnings-.
 *
 * The editor never wrote any of the three and no file on disk used them, so
 * the player stops reading them instead of patching a blacklist.
 */

import { describe, it, expect } from "vitest";
import ImageEngine from "./ImageEngine";

function mount(animation: any) {
  const host = document.createElement("div");
  // Animations are OFF unless the host asks for the full mode.
  host.setAttribute("mode", "full");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const motor: any = new ImageEngine(host as any);
  motor._viewport = document.createElement("div");
  shadow.appendChild(motor._viewport);
  motor._overlay = document.createElement("div");
  motor._viewport.appendChild(motor._overlay);
  motor.metadata = {
    slots: [{
      id: "a", type: "text", align: "left",
      position: [50, 50], width_px: 300, height_px: 80,
      content: { es: "hola" },
      style: { fontSize: "48px", animation },
    }],
    width: 800, height: 600,
  };
  return { host, motor };
}

const HOSTIL = {
  loop: "custom",
  hover: "custom",
  custom_loop_css: "k 1s infinite",
  custom_keyframes:
    '@import "https://tercero.example/a.css"; @keyframes k { to { background-image: image-set("https://tercero.example/b.png" 1x) } }',
  custom_hover_css: "} :host { background: url(https://tercero.example/c) } .x {",
};

describe("the player does not apply raw CSS from a .oim", () => {
  it("control: a catalogue animation IS applied", async () => {
    // Without this, the test below could pass because the animation block
    // never ran at all.
    const { host, motor } = mount({ loop: "pulse", hover: "grow" });
    await motor.renderSlots();
    const shadow = host.shadowRoot!;
    expect(shadow.querySelector(".oim-loop-pulse")).not.toBeNull();
    expect(shadow.querySelector(".oim-hover-grow")).not.toBeNull();
  });

  it("custom_keyframes and custom_hover_css do not reach any stylesheet", async () => {
    const { host, motor } = mount(HOSTIL);
    await motor.renderSlots();
    const hojas = [...host.shadowRoot!.querySelectorAll("style")].map((s) => s.textContent || "");
    expect(hojas.join("\n")).not.toContain("tercero.example");
    expect(host.shadowRoot!.getElementById("oim-dynamic-keyframes-a")).toBeNull();
    expect(host.shadowRoot!.getElementById("oim-dynamic-hover-a")).toBeNull();
  });

  it("custom_loop_css does not reach the layer's style", async () => {
    const { host, motor } = mount(HOSTIL);
    await motor.renderSlots();
    const conAnimacion = [...host.shadowRoot!.querySelectorAll<HTMLElement>("*")]
      .filter((el) => el.style && el.style.animation.includes("k 1s"));
    expect(conAnimacion).toEqual([]);
  });
});
