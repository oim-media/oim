/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TRACK_CLASS, CSS_PARALLAX, ensureParallaxKeyframes } from "../core/parallaxCss";
import { ParallaxController } from "../core/ParallaxController";
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

    // Segunda llamada idempotente
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

    // Comprobar que se normalizo s.parallax
    expect(engine.metadata.slots[0].parallax).toBeDefined();
    expect(engine.metadata.slots[0].parallax.enabled).toBe(true);

    // Comprobar que el slot contiene la pista
    const slotEl = engine._overlay.querySelector('[data-slot-id="cielo"]') as HTMLElement;
    expect(slotEl).not.toBeNull();

    const pista = slotEl.querySelector(`.${TRACK_CLASS}`) as HTMLElement;
    expect(pista).not.toBeNull();
    expect(pista.style.getPropertyValue("--oim-parallax-hover")).toBe("paused");
    // Con espejo la vuelta recorre DOS piezas, asi que a 40 px/s sobre 800 px
    // tarda 40s, no 20. Si tardara 20 el espejo doblaria la velocidad sin que
    // nadie hubiera tocado el ajuste.
    expect(pista.style.animationDuration).toBe("40s");

    // Con espejo son CUATRO piezas: con dos, el reinicio salta.
    const copies = pista.children;
    expect(copies).toHaveLength(4);

    // Comprobar que la segunda copy tiene el espejo scaleX(-1)
    const copia2 = copies[1] as HTMLElement;
    expect(copia2.style.transform).toContain("scaleX(-1)");

    // Comprobar que el shadowRoot tiene inyectado el style de parallax
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

    // NO debe existir pista
    const pista = slotEl.querySelector(`.${TRACK_CLASS}`);
    expect(pista).toBeNull();

    // Debe tener solo el wrapper original
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
            filter: "brightness(1)", // normalmente pondria overflow visible si no fuera grupo
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

    // No debe lanzar ninguna excepcion al abrir
    await expect(engine.renderSlots()).resolves.not.toThrow();

    const slotEl1 = engine._overlay.querySelector('[data-slot-id="slot-legado-1"]');
    expect(slotEl1).not.toBeNull();
    const slotEl2 = engine._overlay.querySelector('[data-slot-id="slot-legado-2"]');
    expect(slotEl2).not.toBeNull();
  });
});

describe("el ancho de las copies sale del plan, no del motor", () => {
  // Cuando el editor fijo el ancho por su cuenta y el player no, volvimos a
  // tener dos comportamientos: vista previa correcta y archivo publicado roto.
  // La pista es `width: max-content`: sin un ancho en pixeles las dos copies
  // colapsan una sobre otra.
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
  // El caso real que motivo el rediseno: cielo y arboles en movimiento, y una
  // montana y una cabana QUIETAS delante, en el mismo grupo. Duplicar la cabana
  // daria dos cabanas.
  //
  // `parallax.enabled` dice que la capa tiene parallax; `infinite.enabled` dice
  // si se desplaza en bucle. Mirar solo el primero dejaba la capa quieta
  // duplicada y desfilando a su velocidad guardada.
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
              enabled: true,                 // la capa TIENE parallax
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

  // La capa de estas pruebas mide 400 y el lienzo 800: hacen falta piezas para
  // cubrir `lienzo + unidad`, no un numero fijo.

  it("con espejo monta un numero PAR y suficiente", async () => {
    // Con espejo la unidad es la pareja (800), asi que la pista debe medir al
    // menos 1600: cuatro piezas de 400.
    const pista = await montar(true);
    expect(pista.children.length % 2, "media pareja rompe la simetria").toBe(0);
    expect(pista.children.length * 400).toBeGreaterThanOrEqual(800 + 800);
  });

  it("sin espejo, las justas para cubrir el lienzo mas una", async () => {
    // 800/400 = 2, mas una para que el bucle tenga a donde ir = 3.
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
  // El exportador escribe SIEMPRE `border_radius_px: 0`, que llega como
  // `style.borderRadius = '0px'`, y el bucle generico de styles corre DESPUES
  // de aplicar la forma: el circulo acababa cuadrado. Llevaba asi desde
  // siempre; se destapo poniendo un sol en una escena de prueba.
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
        // Un `borderRadius: 0px` dentro de `style` es lo que acaba llegando a
        // partir del `border_radius_px: 0` que el exportador escribe SIEMPRE.
        // Es la condicion exacta que dejaba el circulo cuadrado: el bucle
        // generico de styles corre DESPUES de aplicar la forma y lo pisaba.
        style: { geoShape: "circle", fillColor: "#fb923c", borderRadius: "0px" },
      }],
    };

    await (engine as never as { renderSlots: () => Promise<void> }).renderSlots();
    const sol = shadow.querySelector("[data-slot-id]") as HTMLElement;
    expect(sol, "no se monto el slot").toBeTruthy();
    // Desde el 21 de agosto el circulo NO va con `border-radius`: se dibuja con
    // un <path> igual que en el editor, y por eso el `borderRadius: 0px` del
    // exportador ya no puede cuadrarlo. La condicion original de la prueba se
    // conserva -ese style sigue en el slot- y lo que se comprueba es que la
    // figura redonda sigue ahi.
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
      // `canvasWidth`/`canvasHeight` y no `width`/`height`: el motor NO lee
      // esas ultimas y caeria a 1080x1920 por defecto, con lo que la capa
      // dejaria de tocar el borde y la prueba mediria otra cosa.
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
    // La luna esta suelta: agrandarla seria cambiar el diseño sin motivo.
    expect(luna.style.getPropertyValue("--oim-scale")).toBe("");
  });
});

describe("una capa con bucle infinito no se sobredimensiona", () => {
  it("la pista ya cubre el lienzo; agrandarla la deformaria", async () => {
    // Josue lo vio antes que las pruebas: el player monta la pista si la
    // velocidad no es cero -sin mirar el mode-, asi que una capa con
    // `mode: mouse` E `infinite.enabled` recibia LAS DOS COSAS. El editor solo
    // le monta la pista. Divergencia introducida el mismo 21 de agosto.
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
  // La linea de 1 px en la union se vio en el visor publicado. El plan ya
  // trae el solape; esto comprueba que el motor lo aplica a CADA pieza, el
  // origen incluido: sin `transform-origin: 0 0` el estiramiento se reparte a
  // los dos lados y la copy reflejada se sale de su hueco.
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
