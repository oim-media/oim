/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Entrance text effects in the player: one span per unit, a CSS animation
// sampled from @oim-media/core, paused by the host class like any CSS animation.
// Spec: docs/superpowers/specs/2026-10-10-text-effects-design.md

import { describe, it, expect } from "vitest";
import { applyEntranceText, ensureEntranceKeyframes } from "./ImageEngine";
import { entranceKeyframes } from "../../../core/src/text-effects.js";

describe("entrance text effects (player)", () => {
  it("one span per letter, each starting after the previous by the stagger", () => {
    const el = document.createElement("div");
    applyEntranceText(el, "ab c", "fade-chars", 0.1, 0.5);
    const spans = [...el.querySelectorAll("span.oim-entrance")] as HTMLElement[];
    expect(spans.map((s) => s.textContent)).toEqual(["a", "b", "c"]);
    expect(spans[0].style.animation).toContain("oim-entrance-fade-chars");
    expect(spans[0].style.animation).toContain("0.5s both");
    expect(spans[2].style.animation).toContain("0.8s both");
    expect(el.textContent).toBe("ab c");
  });

  it("slide-up moves words, not letters", () => {
    const el = document.createElement("div");
    applyEntranceText(el, "hola mundo", "slide-up");
    expect([...el.querySelectorAll("span.oim-entrance")].map((s) => s.textContent)).toEqual(["hola", "mundo"]);
  });

  it("the keyframes come from the core's sampling, once per shadow root, and stop with reduced motion", () => {
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    ensureEntranceKeyframes(root, "slide-up");
    ensureEntranceKeyframes(root, "slide-up");
    const styles = root.querySelectorAll("style#oim-entrance-slide-up");
    expect(styles).toHaveLength(1);
    const css = styles[0].textContent!;
    const first = entranceKeyframes("slide-up")[0];
    expect(css).toContain(`0%{opacity:${first.opacity};transform:translateY(${first.translateYEm}em) scale(${first.scale})}`);
    expect(css).toContain("100%{opacity:1;transform:translateY(0em) scale(1)}");
    expect(css).toContain("prefers-reduced-motion");
  });
});

describe("entrance text effects, delivery B (player)", () => {
  it("reveal-mask puts each word in its own clip box", () => {
    const el = document.createElement("div");
    applyEntranceText(el, "hola mundo", "reveal-mask");
    const clips = [...el.querySelectorAll("span.oim-entrance-clip")] as HTMLElement[];
    expect(clips.map((c) => c.textContent)).toEqual(["hola", "mundo"]);
    expect(clips[0].style.overflow).toBe("hidden");
    expect(clips[0].firstElementChild!.className).toBe("oim-entrance");
    expect(el.textContent).toBe("hola mundo");
  });

  it("the other effects have no clip", () => {
    const el = document.createElement("div");
    applyEntranceText(el, "hola mundo", "rise-words");
    expect(el.querySelector("span.oim-entrance-clip")).toBeNull();
  });

  it("rise-words keyframes carry the core's rotation; scale-in's do not rotate", () => {
    const root = document.createElement("div").attachShadow({ mode: "open" });
    ensureEntranceKeyframes(root, "rise-words");
    ensureEntranceKeyframes(root, "scale-in");
    expect(root.getElementById("oim-entrance-rise-words")!.textContent).toContain("0%{opacity:0;transform:translateY(0.8em) scale(1) rotate(8deg)}");
    expect(root.getElementById("oim-entrance-scale-in")!.textContent).toContain("0%{opacity:0;transform:translateY(0em) scale(0.6)}");
  });
});

import ImageEngine from "./ImageEngine";

function mount(style: any, disable = false) {
  const host = document.createElement("div");
  host.setAttribute("mode", "full");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const motor: any = new ImageEngine(host as any, disable ? { disableAnimations: true } : undefined);
  motor._viewport = document.createElement("div");
  shadow.appendChild(motor._viewport);
  motor._overlay = document.createElement("div");
  motor._viewport.appendChild(motor._overlay);
  motor.lang = "es";
  motor.metadata = { width: 800, height: 600, slots: [{ id: "t", type: "text", align: "center", position: [10, 10], content: { es: "hola {hl}mundo{/hl}" }, style: { marks: { hl: { bold: true } }, ...style } }] };
  return { motor, shadow };
}

describe("ImageEngine with entrance effects", () => {
  it.each(["fade-chars", "slide-up", "bounce-chars", "reveal-mask", "scale-in", "rise-words"])("%s animates the plain text with the core keyframes", async (type) => {
    const { motor, shadow } = mount({ textAnimationType: type });
    await motor.renderSlots();
    expect(shadow.querySelectorAll("span.oim-entrance").length).toBeGreaterThan(0);
    expect(shadow.getElementById(`oim-entrance-${type}`)).not.toBeNull();
    expect(shadow.textContent).not.toContain("{hl}");
  });

  it("blur-chars is retired: plain text, no animation", async () => {
    const { motor, shadow } = mount({ textAnimationType: "blur-chars" });
    await motor.renderSlots();
    expect(shadow.querySelector("span.oim-entrance")).toBeNull();
  });

  it("with animations disabled, the text is drawn still", async () => {
    const { motor, shadow } = mount({ textAnimationType: "fade-chars" }, true);
    await motor.renderSlots();
    expect(shadow.querySelector("span.oim-entrance")).toBeNull();
  });
});
