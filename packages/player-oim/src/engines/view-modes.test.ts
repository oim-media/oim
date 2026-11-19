/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * View modes: what a .oim does depending on where it is placed.
 *
 * The same file serves two very different places —a grid with twenty
 * thumbnails, and an enlarged view where only it is— and it must not behave
 * the same in both. The one who knows is the PAGE, not the player: the player
 * cannot see beyond itself, so it cannot deduce that there are more files in view.
 *
 * Before this, the landing already built the modes by hand and halfway:
 * `ShowcasePage.tsx` passed `disable-animations="true"` in the gallery and
 * `BlogPage.tsx` passed nothing. One axis of the two, copied by hand, without a name.
 *
 * **The factory default changes.** Before, a bare `<oim-player src>` moved
 * -and it also ran clicks-. Now it inherits the minimum: a still image with
 * its language. A default is not a preference, it is what whoever reads nothing
 * carries away, and it is the only part of an API that cannot be changed later
 * without breaking someone. It changes today because today it is free.
 *
 * `mode` is a preset of the TWO flags, and an explicit attribute overrides it.
 * That is why a third "custom" mode is not needed: it is simply not setting `mode`.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import ImageEngine from "./ImageEngine";
import { doc2, paintedEngine, shape2 } from "./scene-engine.fixture";

function engineWith(attrs: Record<string, string> = {}, options: any = {}) {
  const host = document.createElement("div");
  for (const [k, v] of Object.entries(attrs)) host.setAttribute(k, v);
  (host as any).attachShadow({ mode: "open" });
  return new ImageEngine(host as any, options) as any;
}

afterEach(() => vi.unstubAllGlobals());

/** `prefers-reduced-motion: reduce` active. */
function conMovimientoReducido() {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: q.indexOf("prefers-reduced-motion") >= 0,
    media: q, addEventListener() {}, removeEventListener() {},
  }));
}

describe("the factory default: a still image", () => {
  it("without attributes, it neither moves nor responds", () => {
    const m = engineWith();
    expect(m.disableAnimations).toBe(true);
    expect(m.disableActions).toBe(true);
  });
});

describe('mode="full"', () => {
  it("turns both things on", () => {
    const m = engineWith({ mode: "full" });
    expect(m.disableAnimations).toBe(false);
    expect(m.disableActions).toBe(false);
  });

  it('and "image" leaves them off, as the default does', () => {
    const m = engineWith({ mode: "image" });
    expect(m.disableAnimations).toBe(true);
    expect(m.disableActions).toBe(true);
  });

  /** A mode that does not exist cannot turn anything on: it falls back to the default. */
  it("an unknown mode turns nothing on", () => {
    const m = engineWith({ mode: "galeria-turbo" });
    expect(m.disableAnimations).toBe(true);
    expect(m.disableActions).toBe(true);
  });
});

describe("an explicit attribute overrides the mode", () => {
  it("full + disable-actions turns off ONLY the actions", () => {
    const m = engineWith({ mode: "full", "disable-actions": "true" });
    expect(m.disableActions).toBe(true);
    expect(m.disableAnimations).toBe(false);
  });

  it("image + disable-animations=false turns on ONLY the movement", () => {
    const m = engineWith({ mode: "image", "disable-animations": "false" });
    expect(m.disableAnimations).toBe(false);
    expect(m.disableActions).toBe(true);
  });

  /** Without `mode`: the loose attributes still apply. That is the 'custom' one. */
  it("and without any mode, the attributes alone suffice", () => {
    const m = engineWith({ "disable-actions": "false" });
    expect(m.disableActions).toBe(false);
    expect(m.disableAnimations).toBe(true);
  });
});

describe("prefers-reduced-motion", () => {
  /**
   * It is a VESTIBULAR preference: it protects against motion sickness. Whoever
   * turns it on still wants to click. Switching off its actions takes away
   * FUNCTION, not motion — that would be an accessibility regression disguised
   * as deference.
   */
  it("turns off the movement even if the mode is full", () => {
    conMovimientoReducido();
    expect(engineWith({ mode: "full" }).disableAnimations).toBe(true);
  });

  it("but does NOT touch the actions", () => {
    conMovimientoReducido();
    expect(engineWith({ mode: "full" }).disableActions).toBe(false);
  });
});

describe("the mount options win over everything", () => {
  // `OimPlayer.mount()` is the viewer's route, which brings its own controls.
  it("an explicit option overrides the mode", () => {
    const m = engineWith({ mode: "image" }, { disableAnimations: false, disableActions: false });
    expect(m.disableAnimations).toBe(false);
    expect(m.disableActions).toBe(false);
  });
});

/**
 * That the mode is NOTICED in the DOM, not only in the flag.
 *
 * A flag that nobody checks is worse than not having it: the integrator declares
 * `mode="image"`, feels reassured, and the file keeps responding.
 */
describe("the mode reaches the layer", () => {
  const file = () => doc2([
    shape2("b", { interactions: [{ on: "press", actions: [{ type: "toggle", target: "other" }] }] }),
    shape2("other"),
  ]);
  const layerIn = async (attrs: Record<string, string>) => (await paintedEngine(file(), attrs)).el;

  it("in image mode it is not clickable: no pointer, no contact area, and a click does nothing", async () => {
    const el = await layerIn({ mode: "image" });
    expect(el("b")!.style.cursor).not.toBe("pointer");
    expect(el("b")!.style.minWidth).toBe("");
    el("b")!.click();
    expect(el("other")!.style.display).not.toBe("none");
  });

  it("in full mode it IS clickable and does reserve area", async () => {
    const el = await layerIn({ mode: "full" });
    expect(el("b")!.style.cursor).toBe("pointer");
    expect(el("b")!.style.minWidth).toBe("24px");
  });

  it("the 1.x click path, upgraded, is closed too", async () => {
    const { el } = await paintedEngine({
      slots: [
        { id: "b", type: "geo", align: "center", position: [10, 10], content: { es: "" }, style: { width: "32.5cqw", height: "8.75cqw", fillColor: "#b91c1c" },
          interaction: { action_type: "toggle_elements", target: { show_slots: ["other"] } } },
      ],
      width: 800, height: 600,
    } as any, { mode: "image" });
    expect(el("b")?.style.cursor ?? "").not.toBe("pointer");
  });

  it("and does not warn in the console about something that was turned off on purpose", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await layerIn({ mode: "image" });
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
