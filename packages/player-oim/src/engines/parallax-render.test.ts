/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TRACK_CLASS, CSS_PARALLAX, ensureParallaxKeyframes } from "../../../core/src/parallaxCss.js";
import { ParallaxController } from "../render/ParallaxController";
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

  it("ensureParallaxKeyframes inyecta CSS_PARALLAX una sola vez por shadow root", () => {
    expect(shadowRoot.querySelectorAll("style")).toHaveLength(0);
    ensureParallaxKeyframes(shadowRoot);
    expect(shadowRoot.querySelectorAll("style")).toHaveLength(1);
    const styleEl = shadowRoot.querySelector("style");
    expect(styleEl?.textContent).toContain(CSS_PARALLAX);

    // Second call is idempotent
    ensureParallaxKeyframes(shadowRoot);
    expect(shadowRoot.querySelectorAll("style")).toHaveLength(1);
  });

  it("ParallaxController no usa ni referencia dataset.parallaxOffset en su bucle", () => {
    const container = document.createElement("div");
    const slotEl = document.createElement("div");
    container.appendChild(slotEl);
    document.body.appendChild(container);

    const controller = new ParallaxController(container);
    controller.registerSlot({
      id: "slot-1",
      element: slotEl,
      depth: 0.5,
      mode: "mouse",
      axis: "both",
    });

    expect(slotEl.dataset.parallaxOffset).toBeUndefined();
    controller.destroy();
    document.body.removeChild(container);
  });

  it("normaliza style.parallax al entrar en el motor y monta pista infinita con 2 copies", async () => {
    const engine = new ImageEngine(hostEl);
    engine._overlay = document.createElement("div");
    shadowRoot.appendChild(engine._overlay);

    engine.metadata = {
      canvas_width: 800,
      canvas_height: 600,
      slots: [
        {
          id: "cielo",
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
    const slotEl = engine._overlay.querySelector('[data-slot-id="cielo"]') as HTMLElement;
    expect(slotEl).not.toBeNull();

    const pista = slotEl.querySelector(`.${TRACK_CLASS}`) as HTMLElement;
    expect(pista).not.toBeNull();
    expect(pista.style.getPropertyValue("--oim-parallax-hover")).toBe("paused");
    // With a mirror the return trip covers TWO pieces, so at 40 px/s over 800 px
    // it takes 40s, not 20. If it took 20, the mirror would double the speed without
    // anyone having touched the setting.
    expect(pista.style.animationDuration).toBe("40s");

    // With a mirror there are FOUR pieces: with two, the reset jumps.
    const copies = pista.children;
    expect(copies).toHaveLength(4);

    // Check that the second copy has the mirror scaleX(-1)
    const copia2 = copies[1] as HTMLElement;
    expect(copia2.style.transform).toContain("scaleX(-1)");

    // Check that the shadowRoot has the parallax style injected
    const styleEl = shadowRoot.querySelector("#oim-parallax-styles");
    expect(styleEl).not.toBeNull();
  });

  it("una capa con velocidad 0 NO se duplica y NO monta pista (caso montana y cabana)", async () => {
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
    const pista = slotEl.querySelector(`.${TRACK_CLASS}`);
    expect(pista).toBeNull();

    // It must have only the original wrapper
    expect(slotEl.children).toHaveLength(1);
    expect(slotEl.classList.contains(TRACK_CLASS)).toBe(false);
  });

  it("un slot con isParallaxGroup tiene overflow: hidden para recortar el bucle", async () => {
    const engine = new ImageEngine(hostEl);
    engine._overlay = document.createElement("div");
    shadowRoot.appendChild(engine._overlay);

    engine.metadata = {
      canvas_width: 800,
      canvas_height: 600,
      slots: [
        {
          id: "grupo-parallax",
          type: "container",
          isParallaxGroup: true,
          style: {
            width: "800px",
            height: "600px",
            filter: "brightness(1)", // would normally set overflow visible if this were not a group
          },
        },
      ],
    };

    await engine.renderSlots();

    const slotEl = engine._overlay.querySelector('[data-slot-id="grupo-parallax"]') as HTMLElement;
    expect(slotEl).not.toBeNull();
    expect(slotEl.style.overflow).toBe("hidden");
  });

  it("un grupo con hijos que tienen parallax tiene overflow: hidden", async () => {
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

  it("un .oim con campos viejos (damping, combined, gyroscope) se abre sin lanzar", async () => {
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

describe("el ancho de las copies sale del plan, no del motor", () => {
  // When the editor fixed the width on its own and the player did not, we went back
  // to two behaviors: a correct preview and a broken published file.
  // The track is `width: max-content`: without a pixel width the two copies
  // collapse on top of each other.
  it("LAS DOS copies llevan la base de flex del plan", async () => {
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
          id: "cielo",
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

    const pista = shadow.querySelector(`.${TRACK_CLASS}`) as HTMLElement;
    expect(pista, "no se monto la pista").toBeTruthy();
    const copies = Array.from(pista.children) as HTMLElement[];
    expect(copies.length, "con espejo la pista lleva cuatro piezas").toBe(4);
    for (const c of copies) {
      expect(c.style.flex, "una pieza sin base de flex colapsa dentro de max-content").toContain("640px");
    }
  });
});

describe("el bucle apagado es velocidad cero", () => {
  // The real case that motivated the redesign: sky and trees in motion, and a
  // mountain and a cabin STILL in front, in the same group. Duplicating the cabin
  // would give two cabins.
  //
  // `parallax.enabled` says the layer has parallax; `infinite.enabled` says
  // whether it scrolls in a loop. Looking only at the first left the still layer
  // duplicated and scrolling past at its saved speed.
  it("una capa con parallax y el bucle desactivado NO se duplica", async () => {
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
    expect(shadow.querySelector(`.${TRACK_CLASS}`), "la capa quieta se duplico").toBeNull();
  });
});

describe("cuantas piezas monta la pista", () => {
  const montar = async (mirror: boolean) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    const engine = new ImageEngine(host as never);
    (engine as never as { _overlay: HTMLElement })._overlay = document.createElement("div");
    shadow.appendChild((engine as never as { _overlay: HTMLElement })._overlay);
    (engine as never as { metadata: unknown }).metadata = {
      canvas_width: 800, canvas_height: 600,
      slots: [{
        id: "cielo", type: "text", width_px: 400, content: { es: "Cielo" },
        style: { parallax: { enabled: true, mode: "infinite_horizontal",
          infinite: { enabled: true, speedPxSec: 40, direction: "right_to_left", seamlessTile: mirror } } },
      }],
    };
    await (engine as never as { renderSlots: () => Promise<void> }).renderSlots();
    return shadow.querySelector(`.${TRACK_CLASS}`) as HTMLElement;
  };

  // The layer in these tests measures 400 and the canvas 800: pieces are needed
  // to cover `canvas + unit`, not a fixed number.

  it("con espejo monta un numero PAR y suficiente", async () => {
    // With a mirror the unit is the pair (800), so the track must measure at
    // least 1600: four pieces of 400.
    const pista = await montar(true);
    expect(pista.children.length % 2, "media pareja rompe la simetria").toBe(0);
    expect(pista.children.length * 400).toBeGreaterThanOrEqual(800 + 800);
  });

  it("sin espejo, las justas para cubrir el lienzo mas una", async () => {
    // 800/400 = 2, plus one so the loop has somewhere to go = 3.
    const pista = await montar(false);
    expect(pista.children).toHaveLength(3);
  });

  it("solo se reflejan las piezas impares", async () => {
    const pista = await montar(true);
    const hijos = Array.from(pista.children) as HTMLElement[];
    hijos.forEach((h, i) => {
      const reflejada = (h.style.transform || "").includes("scaleX(-1)");
      expect(reflejada, `la pieza ${i} deberia ${i % 2 ? "" : "NO "}estar reflejada`).toBe(i % 2 === 1);
    });
  });
});

describe("una forma geo circular se dibuja redonda", () => {
  // The exporter ALWAYS writes `border_radius_px: 0`, which arrives as
  // `style.borderRadius = '0px'`, and the generic styles loop runs AFTER
  // applying the shape: the circle ended up square. It had been like this
  // always; it surfaced when a sun was placed in a test scene.
  it("el borde redondo del circulo no lo pisa el bucle de styles", async () => {
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
    const sol = shadow.querySelector("[data-slot-id]") as HTMLElement;
    expect(sol, "no se monto el slot").toBeTruthy();
    // The circle is NOT drawn with `border-radius` any more: it is drawn with
    // a <path>, as in the editor, which is why the exporter's `borderRadius: 0px`
    // can no longer square it. The original test condition is kept (that style
    // is still on the slot), and what is checked is that the round figure is
    // still there.
    const arco = sol.querySelector("path");
    expect(arco, "el circulo no se dibujo").toBeTruthy();
    expect(arco!.getAttribute("d"), "no es un arco de radio 45").toContain("A 45,45");
    expect(sol.style.borderRadius, "el circulo ya no usa border-radius").not.toBe("50%");
  });
});

describe("el sobredimensionado llega al nodo", () => {
  it("una capa pegada al borde recibe `--oim-scale`", async () => {
    const host = document.createElement("div");
    (host as any).attachShadow({ mode: "open" });
    document.body.appendChild(host);
    const motor: any = new ImageEngine(host as any);
    motor._viewport = document.createElement("div");
    host.shadowRoot!.appendChild(motor._viewport);
    motor._overlay = document.createElement("div");
    motor._viewport.appendChild(motor._overlay);
    motor.metadata = {
      // `canvasWidth`/`canvasHeight` and not `width`/`height`: the engine does NOT read
      // those last ones and would fall back to the 1080x1920 default, so the layer
      // would stop touching the edge and the test would measure something else.
      canvasWidth: 800, canvasHeight: 600,
      slots: [
        { id: "horizonte", type: "geo", align: "left",
          position: [0, 0.75], width_px: 800, height_px: 150,
          content: { es: "" },
          style: { geoShape: "rect", fillColor: "#333", fillType: "color" },
          parallax: { enabled: true, depth: 0.6, mode: "mouse", axis: "both" } },
        { id: "luna", type: "geo", align: "left",
          position: [0.75, 0.1], width_px: 100, height_px: 100,
          content: { es: "" },
          style: { geoShape: "circle", fillColor: "#eee", fillType: "color" },
          parallax: { enabled: true, depth: 0.2, mode: "mouse", axis: "both" } },
      ],
    };
    await motor.renderSlots();
    const horizonte = host.shadowRoot!.querySelector('[data-slot-id="horizonte"]') as HTMLElement;
    const luna = host.shadowRoot!.querySelector('[data-slot-id="luna"]') as HTMLElement;
    expect(horizonte.style.getPropertyValue("--oim-scale")).toBe("1.24");
    // The moon is loose: enlarging it would change the design for no reason.
    expect(luna.style.getPropertyValue("--oim-scale")).toBe("");
  });
});

describe("una capa con bucle infinito no se sobredimensiona", () => {
  it("la pista ya cubre el lienzo; agrandarla la deformaria", async () => {
    // Seen by eye before any test caught it: the player mounted the track
    // whenever speed was non-zero, ignoring the mode, so a layer with
    // `mode: mouse` AND `infinite.enabled` got BOTH. The editor mounts only
    // the track.
    const host = document.createElement("div");
    const shadow = (host as any).attachShadow({ mode: "open" });
    document.body.appendChild(host);
    const motor: any = new ImageEngine(host as any);
    motor._overlay = document.createElement("div");
    shadow.appendChild(motor._overlay);
    motor.metadata = {
      canvasWidth: 800, canvasHeight: 600,
      slots: [{
        id: "cielo", type: "geo", align: "left",
        position: [0, 0.75], width_px: 800, height_px: 150,
        content: { es: "" },
        style: { geoShape: "rect", fillColor: "#333", fillType: "color" },
        parallax: { enabled: true, depth: 0.6, mode: "mouse", axis: "both",
                    infinite: { enabled: true, speedPxSec: 20 } },
      }],
    };
    await motor.renderSlots();
    const el = shadow.querySelector('[data-slot-id="cielo"]') as HTMLElement;
    expect(el.querySelector(`.${TRACK_CLASS}`), "no monto la pista: la prueba no mide nada").toBeTruthy();
    expect(el.style.getPropertyValue("--oim-scale")).toBe("");
  });

  it("y la MISMA capa sin bucle si se sobredimensiona", async () => {
    const host = document.createElement("div");
    const shadow = (host as any).attachShadow({ mode: "open" });
    document.body.appendChild(host);
    const motor: any = new ImageEngine(host as any);
    motor._overlay = document.createElement("div");
    shadow.appendChild(motor._overlay);
    motor.metadata = {
      canvasWidth: 800, canvasHeight: 600,
      slots: [{
        id: "cielo", type: "geo", align: "left",
        position: [0, 0.75], width_px: 800, height_px: 150,
        content: { es: "" },
        style: { geoShape: "rect", fillColor: "#333", fillType: "color" },
        parallax: { enabled: true, depth: 0.6, mode: "mouse", axis: "both",
                    infinite: { enabled: false } },
      }],
    };
    await motor.renderSlots();
    const el = shadow.querySelector('[data-slot-id="cielo"]') as HTMLElement;
    expect(el.style.getPropertyValue("--oim-scale")).toBe("1.24");
  });
});

describe("las copies se solapan en el player, no solo en el plan", () => {
  // The 1 px line at the join was seen in the published viewer. The plan already
  // carries the overlap; this checks that the engine applies it to EACH piece, the
  // origin included: without `transform-origin: 0 0` the stretch is split between
  // both sides and the mirrored copy spills out of its gap.
  it("cada pieza lleva el origen y el estiramiento; las impares, ademas, el espejo", async () => {
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

    const pista = shadow.querySelector(`.${TRACK_CLASS}`) as HTMLElement;
    const piezas = Array.from(pista.children) as HTMLElement[];
    expect(piezas.length).toBe(4);
    piezas.forEach((p, i) => {
      expect(p.style.transformOrigin, `pieza ${i}`).toBe("0 0");
      expect(p.style.transform, `pieza ${i}`).toContain(`scaleX(${641 / 640})`);
      expect(p.style.transform.includes("scaleX(-1)"), `pieza ${i}`).toBe(i % 2 === 1);
    });
  });
});
