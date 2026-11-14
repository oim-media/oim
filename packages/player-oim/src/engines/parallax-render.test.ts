/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// @vitest-environment happy-dom
import { v2LayersOf } from "../../../scene/src/legacy/v2-layers.js";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TRACK_CLASS, CSS_PARALLAX, ensureParallaxKeyframes } from "../../../core/src/parallaxCss.js";
import { ImageEngine } from "./ImageEngine";

describe("Parallax Render & Controller Engine (Tarea 2)", () => {
  let hostEl: HTMLElement;
  let shadowRoot: ShadowRoot;

  beforeEach(() => {
    hostEl = document.createElement("div");
    document.body.appendChild(hostEl);
    shadowRoot = hostEl.attachShadow({ mode: "open" });
  });

  afterEach(() => {
    if (hostEl.parentNode) {
      document.body.removeChild(hostEl);
    }
  });

  it("ensureParallaxKeyframes injects CSS_PARALLAX once per shadow root", () => {
    expect(shadowRoot.querySelectorAll("style")).toHaveLength(0);
    ensureParallaxKeyframes(shadowRoot);
    expect(shadowRoot.querySelectorAll("style")).toHaveLength(1);
    const styleEl = shadowRoot.querySelector("style");
    expect(styleEl?.textContent).toContain(CSS_PARALLAX);

    // Second call is idempotent
    ensureParallaxKeyframes(shadowRoot);
    expect(shadowRoot.querySelectorAll("style")).toHaveLength(1);
  });

  it("normalizes style.parallax on entering the engine and mounts an infinite track with 2 copies", async () => {
    const engine = new ImageEngine(hostEl);
    engine._overlay = document.createElement("div");
    shadowRoot.appendChild(engine._overlay);

    engine.metadata = {
      canvas_width: 800,
      canvas_height: 600,
      slots: [
        {
          id: "sky",
          type: "text",
          content: { es: "Cielo en movimiento" },
          style: {
            parallax: {
              enabled: true,
              mode: "infinite_horizontal",
              speedPxSec: 40,
              direction: "right_to_left",
              mirror: true,
              pauseOnHover: true,
            },
          },
        },
      ],
    };

    await engine.renderSlots();

    // Check that s.parallax was normalized
    expect(engine.metadata.slots[0].parallax).toBeDefined();
    expect(engine.metadata.slots[0].parallax.enabled).toBe(true);

    // Check that the slot contains the track
    const slotEl = engine._overlay.querySelector('[data-slot-id="sky"]') as HTMLElement;
    expect(slotEl).not.toBeNull();

    const trackItem = slotEl.querySelector(`.${TRACK_CLASS}`) as HTMLElement;
    expect(trackItem).not.toBeNull();
    expect(trackItem.style.getPropertyValue("--oim-parallax-hover")).toBe("paused");
    // With a mirror the return trip covers TWO pieces, so at 40 px/s over 800 px
    // it takes 40s, not 20. If it took 20, the mirror would double the speed without
    // anyone having touched the setting.
    expect(trackItem.style.animationDuration).toBe("40s");

    // With a mirror there are FOUR pieces: with two, the reset jumps.
    const copies = trackItem.children;
    expect(copies).toHaveLength(4);

    // Check that the second copy has the mirror scaleX(-1)
    const copia2 = copies[1] as HTMLElement;
    expect(copia2.style.transform).toContain("scaleX(-1)");

    // Check that the shadowRoot has the parallax style injected
    const styleEl = shadowRoot.querySelector("#oim-parallax-styles");
    expect(styleEl).not.toBeNull();
  });

  it("a layer with speed 0 is NOT duplicated and does NOT mount a track (the mountain and cabin case)", async () => {
    const engine = new ImageEngine(hostEl);
    engine._overlay = document.createElement("div");
    shadowRoot.appendChild(engine._overlay);

    engine.metadata = {
      canvas_width: 800,
      canvas_height: 600,
      slots: [
        {
          id: "cabana",
          type: "text",
          content: { es: "Cabana quieta" },
          style: {
            parallax: {
              enabled: true,
              mode: "infinite_horizontal",
              speedPxSec: 0,
              mirror: true,
            },
          },
        },
      ],
    };

    await engine.renderSlots();

    const slotEl = engine._overlay.querySelector('[data-slot-id="cabana"]') as HTMLElement;
    expect(slotEl).not.toBeNull();

    // There must NOT be a track
    const trackItem = slotEl.querySelector(`.${TRACK_CLASS}`);
    expect(trackItem).toBeNull();

    // It must have only the original wrapper
    expect(slotEl.children).toHaveLength(1);
    expect(slotEl.classList.contains(TRACK_CLASS)).toBe(false);
  });

  // Ruling (13 Nov): the isParallaxGroup flag is retired; a group clips when a child loops (below).
  it("a group with children that have parallax has overflow: hidden", async () => {
    const engine = new ImageEngine(hostEl);
    engine._overlay = document.createElement("div");
    shadowRoot.appendChild(engine._overlay);

    engine.metadata = {
      canvas_width: 800,
      canvas_height: 600,
      slots: [
        {
          id: "g-hijos-parallax",
          type: "group",
          style: {
            width: "800px",
            height: "600px",
          },
        },
        {
          id: "hijo-parallax",
          type: "text",
          content: { es: "Capa con parallax" },
          style: {
            groupId: "g-hijos-parallax",
            parallax: {
              enabled: true,
              mode: "infinite_horizontal",
              speedPxSec: 30,
            },
          },
        },
      ],
    };

    await engine.renderSlots();

    const slotEl = engine._overlay.querySelector('[data-slot-id="g-hijos-parallax"]') as HTMLElement;
    expect(slotEl).not.toBeNull();
    expect(slotEl.style.overflow).toBe("hidden");
  });

  it("an .oim with old fields (damping, combined, gyroscope) opens without throwing", async () => {
    const engine = new ImageEngine(hostEl);
    engine._overlay = document.createElement("div");
    shadowRoot.appendChild(engine._overlay);

    engine.metadata = {
      canvas_width: 800,
      canvas_height: 600,
      slots: [
        {
          id: "slot-legado-1",
          type: "text",
          content: { es: "Capa con gyroscope y damping" },
          style: {
            parallax: {
              enabled: true,
              depth: 0.8,
              mode: "gyroscope",
              axis: "both",
              damping: 0.35,
              autoDepthDistribution: true,
            },
          },
        },
        {
          id: "slot-legado-2",
          type: "image",
          content: { es: "https://example.com/img.png" },
          style: {
            parallax: {
              enabled: true,
              depth: 0.4,
              mode: "combined",
              damping: 0.1,
            },
          },
        },
      ],
    };

    // It must not throw any exception when opening
    await expect(engine.renderSlots()).resolves.not.toThrow();

    const slotEl1 = engine._overlay.querySelector('[data-slot-id="slot-legado-1"]');
    expect(slotEl1).not.toBeNull();
    const slotEl2 = engine._overlay.querySelector('[data-slot-id="slot-legado-2"]');
    expect(slotEl2).not.toBeNull();
  });
});

describe("the width of the copies comes from the plan, not from the engine", () => {
  // When the editor fixed the width on its own and the player did not, we went back
  // to two behaviors: a correct preview and a broken published file.
  // The track is `width: max-content`: without a pixel width the two copies
  // collapse on top of each other.
  it("BOTH copies carry the plan's flex basis", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    const engine = new ImageEngine(host as never);
    (engine as never as { _overlay: HTMLElement })._overlay = document.createElement("div");
    shadow.appendChild((engine as never as { _overlay: HTMLElement })._overlay);

    (engine as never as { metadata: unknown }).metadata = {
      canvas_width: 800,
      canvas_height: 600,
      slots: [
        {
          id: "sky",
          type: "text",
          width_px: 640,
          content: { es: "Cielo" },
          style: {
            parallax: {
              enabled: true,
              mode: "infinite_horizontal",
              speedPxSec: 40,
              direction: "right_to_left",
              mirror: true,
              pauseOnHover: false,
            },
          },
        },
      ],
    };

    await (engine as never as { renderSlots: () => Promise<void> }).renderSlots();

    const trackItem = shadow.querySelector(`.${TRACK_CLASS}`) as HTMLElement;
    expect(trackItem, "the track was not mounted").toBeTruthy();
    const copies = Array.from(trackItem.children) as HTMLElement[];
    expect(copies.length, "with a mirror the track has four pieces").toBe(4);
    for (const c of copies) {
      expect(c.style.flex, "a piece without a flex basis collapses inside max-content").toContain("640px");
    }
  });
});

describe("the paused loop has zero speed", () => {
  // The real case that motivated the redesign: sky and trees in motion, and a
  // mountain and a cabin STILL in front, in the same group. Duplicating the cabin
  // would give two cabins.
  //
  // `parallax.enabled` says the layer has parallax; `infinite.enabled` says
  // whether it scrolls in a loop. Looking only at the first left the still layer
  // duplicated and scrolling past at its saved speed.
  it("a layer with parallax and the loop disabled is NOT duplicated", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    const engine = new ImageEngine(host as never);
    (engine as never as { _overlay: HTMLElement })._overlay = document.createElement("div");
    shadow.appendChild((engine as never as { _overlay: HTMLElement })._overlay);

    (engine as never as { metadata: unknown }).metadata = {
      canvas_width: 800,
      canvas_height: 600,
      slots: [
        {
          id: "cabana",
          type: "text",
          width_px: 400,
          content: { es: "Cabana quieta" },
          style: {
            parallax: {
              enabled: true,                 // the layer HAS parallax
              mode: "infinite_horizontal",
              infinite: { enabled: false, speedPxSec: 20, direction: "right_to_left" },
            },
          },
        },
      ],
    };

    await (engine as never as { renderSlots: () => Promise<void> }).renderSlots();
    expect(shadow.querySelector(`.${TRACK_CLASS}`), "the still layer was duplicated").toBeNull();
  });
});

describe("cuantas pieces monta la track", () => {
  const setupItem = async (mirror: boolean) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    const engine = new ImageEngine(host as never);
    (engine as never as { _overlay: HTMLElement })._overlay = document.createElement("div");
    shadow.appendChild((engine as never as { _overlay: HTMLElement })._overlay);
    (engine as never as { metadata: unknown }).metadata = {
      canvas_width: 800, canvas_height: 600,
      slots: [{
        id: "sky", type: "text", width_px: 400, content: { es: "Cielo" },
        style: { parallax: { enabled: true, mode: "infinite_horizontal",
          infinite: { enabled: true, speedPxSec: 40, direction: "right_to_left", seamlessTile: mirror } } },
      }],
    };
    await (engine as never as { renderSlots: () => Promise<void> }).renderSlots();
    return shadow.querySelector(`.${TRACK_CLASS}`) as HTMLElement;
  };

  // The layer in these tests measures 400 and the canvas 800: pieces are needed
  // to cover `canvas + unit`, not a fixed number.

  it("with a mirror it mounts an EVEN and sufficient number", async () => {
    // With a mirror the unit is the pair (800), so the track must measure at
    // least 1600: four pieces of 400.
    const trackItem = await setupItem(true);
    expect(trackItem.children.length % 2, "media pair rompe la simetria").toBe(0);
    expect(trackItem.children.length * 400).toBeGreaterThanOrEqual(800 + 800);
  });

  it("without a mirror, just enough to cover the canvas plus one", async () => {
    // 800/400 = 2, plus one so the loop has somewhere to go = 3.
    const trackItem = await setupItem(false);
    expect(trackItem.children).toHaveLength(3);
  });

  it("only the odd pieces are reflected", async () => {
    const trackItem = await setupItem(true);
    const hijos = Array.from(trackItem.children) as HTMLElement[];
    hijos.forEach((h, i) => {
      const reflejada = (h.style.transform || "").includes("scaleX(-1)");
      expect(reflejada, `la piece ${i} deberia ${i % 2 ? "" : "NO "}estar reflejada`).toBe(i % 2 === 1);
    });
  });
});

describe("a geo circular shape is drawn round", () => {
  // The exporter ALWAYS writes `border_radius_px: 0`, which arrives as
  // `style.borderRadius = '0px'`, and the generic styles loop runs AFTER
  // applying the shape: the circle ended up square. It had been like this
  // always; it surfaced when a sun was placed in a test scene.
  it("the circle's round border is not overwritten by the styles loop", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    const engine = new ImageEngine(host as never);
    (engine as never as { _overlay: HTMLElement })._overlay = document.createElement("div");
    shadow.appendChild((engine as never as { _overlay: HTMLElement })._overlay);

    (engine as never as { metadata: unknown }).metadata = {
      canvas_width: 800, canvas_height: 600,
      slots: [{
        id: "sol", type: "geo", width_px: 180, height_px: 180,
        content: {},
        // A `borderRadius: 0px` inside `style` is what ends up arriving from
        // the `border_radius_px: 0` that the exporter ALWAYS writes.
        // It is the exact condition that left the circle square: the generic
        // styles loop runs AFTER applying the shape and overwrote it.
        style: { geoShape: "circle", fillColor: "#fb923c", borderRadius: "0px" },
      }],
    };

    await (engine as never as { renderSlots: () => Promise<void> }).renderSlots();
    const sunItem = shadow.querySelector("[data-slot-id]") as HTMLElement;
    expect(sunItem, "the slot was not mounted").toBeTruthy();
    // The circle is NOT drawn with `border-radius` any more: it is drawn with
    // a <path>, as in the editor, which is why the exporter's `borderRadius: 0px`
    // can no longer square it. The original test condition is kept (that style
    // is still on the slot), and what is checked is that the round figure is
    // still there.
    const arc = sunItem.querySelector("path");
    expect(arc, "the circle was not drawn").toBeTruthy();
    expect(arc!.getAttribute("d"), "not an arc of radius 45").toContain("A 45,45");
    expect(sunItem.style.borderRadius, "the circle no longer uses border-radius").not.toBe("50%");
  });
});

describe("the copies overlap in the player, not only in the plan", () => {
  // The 1 px line at the join was seen in the published viewer. The plan already
  // carries the overlap; this checks that the engine applies it to EACH piece, the
  // origin included: without `transform-origin: 0 0` the stretch is split between
  // both sides and the mirrored copy spills out of its gap.
  it("each piece carries the origin and the stretch; the odd ones also the mirror", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    const engine = new ImageEngine(host as never);
    (engine as never as { _overlay: HTMLElement })._overlay = document.createElement("div");
    shadow.appendChild((engine as never as { _overlay: HTMLElement })._overlay);
    (engine as never as { metadata: unknown }).metadata = {
      canvas_width: 800,
      canvas_height: 600,
      slots: [
        {
          id: "nubes",
          type: "text",
          width_px: 640,
          content: { es: "Nubes" },
          style: { parallax: { enabled: true, mode: "infinite_horizontal", speedPxSec: 40, direction: "right_to_left", mirror: true, pauseOnHover: false } },
        },
      ],
    };

    await (engine as never as { renderSlots: () => Promise<void> }).renderSlots();

    const trackItem = shadow.querySelector(`.${TRACK_CLASS}`) as HTMLElement;
    const pieces = Array.from(trackItem.children) as HTMLElement[];
    expect(pieces.length).toBe(4);
    pieces.forEach((p, i) => {
      expect(p.style.transformOrigin, `piece ${i}`).toBe("0 0");
      expect(p.style.transform, `piece ${i}`).toContain(`scaleX(${641 / 640})`);
      expect(p.style.transform.includes("scaleX(-1)"), `piece ${i}`).toBe(i % 2 === 1);
    });
  });
});
