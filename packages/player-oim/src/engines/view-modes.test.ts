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
describe("the mode reaches the slot", () => {
  function setupItem(slots: any[], attrs: Record<string, string> = {}) {
    const host = document.createElement("div");
    for (const [k, v] of Object.entries(attrs)) host.setAttribute(k, v);
    const shadow = (host as any).attachShadow({ mode: "open" });
    document.body.appendChild(host);
    const motor: any = new ImageEngine(host as any);
    motor._viewport = document.createElement("div");
    shadow.appendChild(motor._viewport);
    motor._overlay = document.createElement("div");
    motor._viewport.appendChild(motor._overlay);
    motor.metadata = { slots, width: 800, height: 600 };
    return { host, motor };
  }

  const button = (extra: any = {}) => ({
    id: "b", type: "text", align: "center", position: [10, 10],
    content: { es: "PULSAME" },
    style: {
      width: "32.5cqw", height: "8.75cqw", fontSize: "2.75cqw",
      fillColor: "#b91c1c", color: "#b91c1c", isInteractive: true,
      states: { active: { actions: [{ target: "otra", type: "toggle" }] } },
      ...extra,
    },
  });

  async function slotIn(attrs: Record<string, string>, slot: any = button()) {
    const { host, motor } = setupItem([slot], attrs);
    await motor.renderSlots();
    return host.shadowRoot!.querySelector('[data-slot-id="b"]') as HTMLElement;
  }

  it('in image mode it is not flagged as clickable', async () => {
    expect((await slotIn({ mode: "image" })).style.cursor).not.toBe("pointer");
  });

  it("and a click does nothing", async () => {
    const el = await slotIn({ mode: "image" });
    const otra = document.createElement("div");
    // If something were hooked up, the click would fire the action and touch the DOM.
    const before = el.outerHTML;
    el.dispatchEvent(new Event("click", { bubbles: true }));
    expect(el.outerHTML).toBe(before);
    otra.remove();
  });

  it("nor does it reserve the minimum contact area: nothing is clickable", async () => {
    expect((await slotIn({ mode: "image" })).style.minWidth).toBe("");
  });

  it("in full mode it IS flagged and does reserve area", async () => {
    const el = await slotIn({ mode: "full" });
    expect(el.style.cursor).toBe("pointer");
    expect(el.style.minWidth).toBe("24px");
  });

  /**
   * The old click path (`interaction.toggle_elements`) is another door to the
   * same place. Gating one and leaving the other open would be worse than not
   * gating: it would deem something safe that is not.
   */
  it("the old click path is closed too", async () => {
    const conInteraction = {
      id: "b", type: "geo", align: "center", position: [10, 10],
      content: { es: "" },
      style: { width: "32.5cqw", height: "8.75cqw", fillColor: "#b91c1c" },
      interaction: { action_type: "toggle_elements", target: { show_slots: ["otra"] } },
    };
    expect((await slotIn({ mode: "image" }, conInteraction)).style.cursor).not.toBe("pointer");
  });

  /**
   * The console's actionEvent exists for the case "the file asks for it and the
   * player does not know". In image mode the player DOES know and has decided
   * not to do it: warning would send someone looking for a failure that does
   * not exist, and in a gallery of twenty, twenty times.
   */
  it("and does not warn in the console about something that was turned off on purpose", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await slotIn({ mode: "image" }, button({ states: undefined }));
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
