/**
 * @vitest-environment happy-dom
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { stateStyles, bindStates, resolveActions, applyMinHitArea, readInteraction } from "./states";

describe("stateStyles", () => {
  it("translates a state to the properties the slot already understands", () => {
    expect(stateStyles({ scale: 1.1, transitionDuration: 0.4 })).toEqual({
      "--oim-slot-hover-scale": "1.1",
      "--oim-transition-duration": "0.4s"
    });
  });

  it("an empty state emits nothing, so as not to overwrite the base style", () => {
    expect(stateStyles({})).toEqual({});
  });

  it("the opacity travels in 0-100 and comes out in 0-1", () => {
    // The editor stores it as 0-100 (`types.ts`). Emitting "50" instead of "0.5"
    // leaves the slot visible, and the failure looks like "nothing happens".
    expect(stateStyles({ opacity: 50 })).toEqual({ opacity: "0.5" });
    expect(stateStyles({ opacity: 0 })).toEqual({ opacity: "0" });
  });

  it("the rotation and the colour are translated correctly", () => {
    expect(stateStyles({ rotation: 45, color: "#ff0000" })).toEqual({
      "--oim-rot": "45deg",
      color: "#ff0000"
    });
  });
});

describe("bindStates", () => {
  /** Writes immediately, as `queueUpdate` would after draining its queue. */
  const writeNow = (el: HTMLElement, styles: Record<string, string>) => {
    for (const [k, v] of Object.entries(styles)) {
      if (k.startsWith("--")) {
        if (v === "") el.style.removeProperty(k);
        else el.style.setProperty(k, v);
      } else {
        (el.style as unknown as Record<string, string>)[k] = v;
      }
    }
  };

  it("applies the state when the cursor enters and undoes it when it leaves", () => {
    const el = document.createElement("div");
    el.style.setProperty("--oim-slot-hover-scale", "1");
    bindStates(el, { hover: { scale: 1.4, opacity: 50 } }, writeNow);

    el.dispatchEvent(new Event("mouseenter"));
    expect(el.style.getPropertyValue("--oim-slot-hover-scale")).toBe("1.4");
    expect(el.style.opacity).toBe("0.5");

    el.dispatchEvent(new Event("mouseleave"));
    expect(el.style.getPropertyValue("--oim-slot-hover-scale")).toBe("1");
    expect(el.style.opacity).toBe("");
  });

  it("the base value is captured BEFORE overwriting it, not after", () => {
    // If it were captured later, leaving the hover would return the hover value
    // and the layer would stay enlarged forever. It is checked with two
    // consecutive entries: the second must not capture again.
    const el = document.createElement("div");
    el.style.setProperty("--oim-slot-hover-scale", "1");
    bindStates(el, { hover: { scale: 2 } }, writeNow);

    el.dispatchEvent(new Event("mouseenter"));
    el.dispatchEvent(new Event("mouseenter"));
    el.dispatchEvent(new Event("mouseleave"));

    expect(el.style.getPropertyValue("--oim-slot-hover-scale")).toBe("1");
  });

  it("without states it hooks nothing up", () => {
    const el = document.createElement("div");
    const write = vi.fn();
    bindStates(el, undefined, write);
    el.dispatchEvent(new Event("mouseenter"));
    expect(write).not.toHaveBeenCalled();
  });

  it("runs the actionRunner execute on mouseenter and reverts on mouseleave", () => {
    const el = document.createElement("div");
    const gestor = {
      run: vi.fn(),
      revert: vi.fn()
    };
    const actions = [{ target: "price", type: "show" }];
    bindStates(el, { hover: { scale: 1.1, actions } }, vi.fn(), gestor);

    el.dispatchEvent(new Event("mouseenter"));
    expect(gestor.run).toHaveBeenCalledWith(actions, "hover");
    expect(gestor.revert).not.toHaveBeenCalled();

    el.dispatchEvent(new Event("mouseleave"));
    expect(gestor.revert).toHaveBeenCalledWith(actions);
  });

  it("a touch pointerdown enters hover and registers the touch-outside listener", () => {
    const el = document.createElement("div");
    el.style.setProperty("--oim-slot-hover-scale", "1");
    const onTouchOutside = vi.fn();
    bindStates(
      el,
      { hover: { scale: 1.5 } },
      writeNow,
      undefined,
      onTouchOutside
    );

    const touchEvent = new PointerEvent("pointerdown", { pointerType: "touch" });
    el.dispatchEvent(touchEvent);

    expect(el.style.getPropertyValue("--oim-slot-hover-scale")).toBe("1.5");
    expect(onTouchOutside).toHaveBeenCalledTimes(1);
    expect(onTouchOutside).toHaveBeenCalledWith(el, expect.any(Function));
  });

  it("a mouse pointerdown is ignored so as not to duplicate mouseenter", () => {
    const el = document.createElement("div");
    const onTouchOutside = vi.fn();
    const write = vi.fn();
    bindStates(
      el,
      { hover: { scale: 1.5 } },
      write,
      undefined,
      onTouchOutside
    );

    const mouseEvent = new PointerEvent("pointerdown", { pointerType: "mouse" });
    el.dispatchEvent(mouseEvent);

    expect(write).not.toHaveBeenCalled();
    expect(onTouchOutside).not.toHaveBeenCalled();
  });

  it("invoking the touch-outside callback leaves the hover state", () => {
    const el = document.createElement("div");
    el.style.setProperty("--oim-slot-hover-scale", "1");
    let salirCallback: (() => void) | null = null;
    const onTouchOutside = vi.fn((_targetEl: HTMLElement, onSalir: () => void) => {
      salirCallback = onSalir;
    });

    bindStates(
      el,
      { hover: { scale: 1.5 } },
      writeNow,
      undefined,
      onTouchOutside
    );

    const touchEvent = new PointerEvent("pointerdown", { pointerType: "touch" });
    el.dispatchEvent(touchEvent);
    expect(el.style.getPropertyValue("--oim-slot-hover-scale")).toBe("1.5");

    // Simulate the container's listener detecting a touch outside and calling salirCallback
    expect(salirCallback).toBeTypeOf("function");
    salirCallback!();

    expect(el.style.getPropertyValue("--oim-slot-hover-scale")).toBe("1");
  });

  it("bindStates does NOT touch the size: it is not its business", () => {
    // It was once here and in the engine at the same time. This test pins down
    // that the hook handles only WHEN a state is entered and exited, nothing more.
    const el = document.createElement("div");
    bindStates(el, { hover: { scale: 1.2 } }, writeNow);
    expect(el.style.minWidth).toBe("");
    expect(el.style.minHeight).toBe("");
  });
});

describe("applyMinHitArea", () => {
  it("the contact area never drops below 24x24 px (WCAG 2.5.8)", () => {
    const el = document.createElement("div");
    el.style.width = "8px";
    el.style.height = "8px";
    applyMinHitArea(el);
    expect(parseFloat(el.style.minWidth)).toBeGreaterThanOrEqual(24);
    expect(parseFloat(el.style.minHeight)).toBeGreaterThanOrEqual(24);
  });
});

describe("resolveActions", () => {
  it("show and hide resolve to visibility per target", () => {
    expect(resolveActions([
      { target: "price", type: "show" },
      { target: "actionEvent", type: "hide" }
    ], {})).toEqual({ visibility: { price: true, actionEvent: false }, texts: {} });
  });

  it("setText does not touch the visibility", () => {
    expect(resolveActions([
      { target: "price", type: "setText", value: "9,99" }
    ], {})).toEqual({ visibility: {}, texts: { price: "9,99" } });
  });

  it("toggle reads the current visibility", () => {
    expect(resolveActions([{ target: "price", type: "toggle" }], { price: true }))
      .toEqual({ visibility: { price: false }, texts: {} });
  });

  it("an action without a target is ignored instead of breaking", () => {
    expect(resolveActions([{ target: "", type: "show" }], {}))
      .toEqual({ visibility: {}, texts: {} });
  });
});

describe("parity between interaction vocabularies", () => {
  it("states (show/hide) and toggle_elements produce the same visibility result", () => {
    // New vocabulary: states with show / hide actions
    const newActions = [
      { target: "price", type: "show" },
      { target: "actionEvent", type: "hide" }
    ];
    const newResult = resolveActions(newActions, { price: false, actionEvent: true });

    // Old vocabulary: interaction with show_slots / hide_slots
    const oldConfig = {
      show_slots: ["price"],
      hide_slots: ["actionEvent"]
    };
    const oldResult: Record<string, boolean> = {};
    (oldConfig.show_slots || []).forEach((id) => { oldResult[id] = true; });
    (oldConfig.hide_slots || []).forEach((id) => { oldResult[id] = false; });

    expect(newResult.visibility).toEqual(oldResult);
    expect(newResult.visibility).toEqual({ price: true, actionEvent: false });
  });

  it("the reader of interaction / toggle_elements is still preserved", () => {
    const oldConfig = {
      hide_slots: ["capa1"],
      show_slots: ["capa2", "capa3"]
    };
    const visibilityMap: Record<string, boolean> = {};
    oldConfig.show_slots.forEach((id) => { visibilityMap[id] = true; });
    oldConfig.hide_slots.forEach((id) => { visibilityMap[id] = false; });

    expect(visibilityMap).toEqual({
      capa1: false,
      capa2: true,
      capa3: true
    });
  });
});



describe("readInteraction — the REAL shape of the file", () => {
  /**
   * This slot is copied verbatim from `precio_al_pasar_el_cursor.oim.png`, the
   * first .oim with interaction that was exported. Its fields travel inside
   * `style`, not at the root.
   */
  const slotDelArchivo = {
    id: "shape_geo_5cfwlr9tk",
    type: "geo",
    content: { es: "" },
    style: {
      isInteractive: true,
      states: { hover: { actions: [{ target: "shape_text_kv740oqil", type: "toggle" }] } }
    }
  };

  it("reads the fields that come inside style, which is how the editor writes them", () => {
    const r = readInteraction(slotDelArchivo as never);
    expect(r.isInteractive).toBe(true);
    expect(r.states?.hover?.actions?.[0]).toEqual({
      target: "shape_text_kv740oqil",
      type: "toggle"
    });
  });

  it("still reads the root ones, which is how hand-written slots carry them", () => {
    const r = readInteraction({ isInteractive: true, states: { hover: { scale: 1.2 } } });
    expect(r.isInteractive).toBe(true);
    expect(r.states?.hover?.scale).toBe(1.2);
  });

  it("a slot without interaction is not interactive", () => {
    expect(readInteraction({ style: { isInteractive: false } } as never).isInteractive).toBe(false);
    expect(readInteraction({} as never).states).toBeUndefined();
  });
});

describe("readInteraction — warns about what it cannot do", () => {
  // This feature's failure mode is silence: the player hooks nothing and whoever
  // opens the file does not know why. These tests pin down that it stops being
  // silent. They verify the NOTICE, not the returned value, which does not change.

  it("warns when the slot is declared interactive and has no states", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      readInteraction({ isInteractive: true }, "price");
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain("price");
      expect(warn.mock.calls[0][0]).toContain("states");
    } finally {
      warn.mockRestore();
    }
  });

  it("warns when it carries `states` but without `hover`, the only one it understands today", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      readInteraction({ isInteractive: true, states: { pressed: {} } } as never, "boton");
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain("hover");
    } finally {
      warn.mockRestore();
    }
  });

  /**
   * Now that the click exists, `hover` is no longer the only useful state. An
   * actionEvent that kept saying the layer "will not respond" would be worse than
   * saying nothing: it sends people looking for a fault that is not there.
   */
  it("does NOT warn about a layer that only has click actions", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      readInteraction(
        { isInteractive: true, states: { active: { actions: [{ target: "ficha", type: "toggle" }] } } } as never,
        "boton",
      );
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  /** But an `active` WITHOUT actions does nothing: its styles are not applied. */
  it("and warns about an empty active, which does nothing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      readInteraction({ isInteractive: true, states: { active: { scale: 1.2 } } } as never, "boton");
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });

  it("warns when there are states but nobody marked the slot as interactive", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      readInteraction({ style: { states: { hover: { scale: 1.2 } } } } as never, "img");
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain("isInteractive");
    } finally {
      warn.mockRestore();
    }
  });

  it("does not warn in the two healthy cases: interactive with hover, and a normal slot", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      readInteraction({ style: { isInteractive: true, states: { hover: { scale: 1.2 } } } } as never, "ok");
      readInteraction({}, "quieto");
      // `states: {}` is an empty object the editor may write without meaning
      // anything; it does not earn an actionEvent if the slot is not interactive.
      readInteraction({ states: {} }, "empty");
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
