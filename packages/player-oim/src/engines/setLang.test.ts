/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from "vitest";
import ImageEngine from "./ImageEngine";

function montar(slots: any[]) {
  const host = document.createElement("div");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const motor = new ImageEngine(host as any);
  motor._viewport = document.createElement("div");
  motor._viewport.className = "oim-viewport";
  shadow.appendChild(motor._viewport);
  motor._overlay = document.createElement("div");
  motor._overlay.className = "oim-layer-overlay";
  motor._viewport.appendChild(motor._overlay);
  motor.metadata = { slots, width: 800, height: 600 } as any;
  return { host, motor };
}

const proyecto = () => ([
  { id: "titulo", type: "text", content: { es: "Hola", en: "Hello" }, position: [50, 20], style: { fontSize: "16px" } },
  { id: "quieto", type: "text", content: { es: "OIM", en: "OIM" }, position: [50, 50], style: {} },
  { id: "grande", type: "text", content: { es: "Precio", en: "Precio" }, position: [50, 80], style: { fontSize: "16px", fontSizes: { en: "13px" } } },
]);

describe("setLang quirurgico", () => {
  let host: HTMLElement, motor: any;
  beforeEach(async () => {
    ({ host, motor } = montar(proyecto()));
    motor.lang = "es";
    await motor.renderSlots();
  });

  const nodo = (id: string) => host.shadowRoot!.querySelector('[data-slot-id="' + id + '"]');

  it("una capa con el mismo text en los dos idiomas conserva su nodo", async () => {
    const antes = nodo("quieto");
    motor.setLang("en");
    await new Promise((r) => setTimeout(r, 250));
    expect(nodo("quieto")).toBe(antes);
  });

  it("la capa cuyo text cambia si se reconstruye", async () => {
    const antes = nodo("titulo");
    motor.setLang("en");
    await new Promise((r) => setTimeout(r, 250));
    expect(nodo("titulo")).not.toBe(antes);
    expect(nodo("titulo")!.textContent).toContain("Hello");
  });

  it("un cambio de SOLO size escribe la propiedad sin reconstruir", async () => {
    // El caso del editor: ajustar el size del aleman no debe reiniciar la
    // animacion de la capa que estas mirando.
    const antes = nodo("grande");
    motor.setLang("en");
    await new Promise((r) => setTimeout(r, 250));
    expect(nodo("grande")).toBe(antes);
    expect((nodo("grande") as HTMLElement).style.fontSize).toBe("13px");
  });

  it("volver al idioma original devuelve el size heredado", async () => {
    motor.setLang("en");
    await new Promise((r) => setTimeout(r, 250));
    motor.setLang("es");
    await new Promise((r) => setTimeout(r, 250));
    expect((nodo("grande") as HTMLElement).style.fontSize).toBe("16px");
  });

  it("emite oim:langchange una sola vez", async () => {
    let veces = 0;
    host.addEventListener("oim:langchange", () => { veces++; });
    motor.setLang("en");
    await new Promise((r) => setTimeout(r, 250));
    expect(veces).toBe(1);
  });
});

describe("el bucle de parallax infinito sobrevive al cambio de idioma", () => {
  it("la pista de una capa que no cambia sigue siendo el MISMO nodo", async () => {
    // Es el motivo de toda esta tarea: antes, cambiar de idioma reconstruia el
    // lienzo entero y devolvia todas las pistas a la posicion 0. El salto que
    // se cerro el 19 de agosto tenia aqui una puerta trasera.
    const { host, motor } = montar([
      { id: "titulo", type: "text", content: { es: "Hola", en: "Hello" }, position: [50, 20], style: {} },
      {
        id: "cielo", type: "image",
        content: { es: "data:image/png;base64,AAA", en: "data:image/png;base64,AAA" },
        position: [50, 50], width_px: 400,
        style: { parallax: { enabled: true, mode: "infinite_horizontal", infinite: { enabled: true, speedPxSec: 20 } } },
      },
    ]);
    motor.lang = "es";
    await motor.renderSlots();

    const pistaAntes = host.shadowRoot!.querySelector(".oim-parallax-pista");
    expect(pistaAntes).toBeTruthy();

    motor.setLang("en");
    await new Promise((r) => setTimeout(r, 250));

    // El mismo nodo, no uno equivalente: un nodo nuevo es una animacion CSS
    // que vuelve a empezar, que es exactamente lo que se veia como un salto.
    expect(host.shadowRoot!.querySelector(".oim-parallax-pista")).toBe(pistaAntes);
    // Y el titulo si cambio, para que la prueba no pase por no hacer nada.
    expect(host.shadowRoot!.querySelector('[data-slot-id="titulo"]')!.textContent).toContain("Hello");
  });
});

describe("la transicion del cambio de idioma", () => {
  const visorDe = (m: any) => m._viewport as HTMLElement;

  it("si no cambia ninguna capa no hay transicion", () => {
    // Difuminar para mostrar la misma imagen es un parpadeo que miente.
    const { motor } = montar([
      { id: "solo", type: "text", content: { es: "OIM", en: "OIM" }, position: [50, 50], style: {} },
    ]);
    motor.lang = "es";
    motor.setLang("en");
    expect(visorDe(motor).style.filter).not.toContain("blur");
  });

  it("difumina TODO el lienzo a 14px, no la capa suelta", async () => {
    // Josue lo pidio asi: "se ve como otra imagen". Un desenfoque pequeno sobre
    // la capa que cambia produce lo contrario: se ve COMO se modifica.
    const { motor } = montar(proyecto());
    motor.lang = "es";
    await motor.renderSlots();
    motor.setLang("en");
    expect(visorDe(motor).style.filter).toBe("blur(14px)");
  });

  it("el cambio se aplica en el PICO, no durante la rampa", async () => {
    const { host, motor } = montar(proyecto());
    motor.lang = "es";
    await motor.renderSlots();
    const antes = host.shadowRoot!.querySelector('[data-slot-id="titulo"]');

    motor.setLang("en");
    await new Promise((r) => setTimeout(r, 60));
    // A los 60ms sigue difuminandose: el lienzo todavia no ha cambiado.
    expect(host.shadowRoot!.querySelector('[data-slot-id="titulo"]')).toBe(antes);

    await new Promise((r) => setTimeout(r, 400));
    expect(host.shadowRoot!.querySelector('[data-slot-id="titulo"]')).not.toBe(antes);
  });

  /**
   * OJO al medir opacidad: el motor monta TODAS las capas en `opacity: 0` y las
   * funde al entrar (ImageEngine:1331), y se asienta hacia los 100ms. Medir
   * antes de eso mide SU fundido, no el nuestro, y la prueba pasa aunque el
   * nuestro no exista. Aqui se espera siempre a que se asiente.
   */
  const conMenosMovimiento = async (fn: (h: HTMLElement, m: any) => Promise<void>) => {
    const previo = window.matchMedia;
    (window as any).matchMedia = (q: string) => ({
      matches: q.includes("reduce"), media: q,
      addEventListener() {}, removeEventListener() {},
    });
    try {
      const { host, motor } = montar([
        { id: "titulo", type: "text", content: { es: "Hola", en: "Hello" },
          position: [50, 20], style: { fontSize: "16px", opacity: 40 } },
        // Cambia SOLO el size: no se reconstruye, asi que la unica opacidad
        // que se ve al final es la que restaura el fundido. Si cambiara el
        // content, el nodo nuevo traeria su propia entrada y taparia el fallo.
        { id: "translucida", type: "text", content: { es: "Precio", en: "Precio" },
          position: [50, 65], style: { fontSize: "16px", fontSizes: { en: "13px" }, opacity: 40 } },
        { id: "pulsante", type: "text", content: { es: "Ya", en: "Yes" }, position: [50, 35], style: {} },
        { id: "quieto", type: "text", content: { es: "OIM", en: "OIM" }, position: [50, 50], style: {} },
      ]);
      motor.lang = "es";
      await motor.renderSlots();
      // La pasada de entrada del motor reescribe la opacidad de TODAS las capas
      // y tarda mas cuanto mas hay. Se espera a que la translucida llegue a su
      // valor real: medir antes mide su fundido, no el nuestro.
      const traslucida = () =>
        (host.shadowRoot!.querySelector('[data-slot-id="translucida"]') as HTMLElement).style.opacity;
      for (let i = 0; i < 40 && traslucida() !== "0.4"; i++) {
        await new Promise((r) => setTimeout(r, 25));
      }
      expect(traslucida()).toBe("0.4"); // la entrada ya termino
      await fn(host, motor);
    } finally {
      (window as any).matchMedia = previo;
    }
  };

  const op = (h: HTMLElement, id: string) =>
    (h.shadowRoot!.querySelector('[data-slot-id="' + id + '"]') as HTMLElement).style.opacity;

  it("con reduced-motion no difumina el lienzo, pero SI funde lo que cambia", async () => {
    // Quitar la transicion del todo dejaria un salto seco justo donde mira el
    // ojo. Un fundido de opacidad no desplaza nada: cumple la peticion.
    await conMenosMovimiento(async (host, motor) => {
      expect(op(host, "titulo")).toBe("0.4"); // asentada
      motor.setLang("en");
      expect((motor._viewport as HTMLElement).style.filter).not.toContain("blur");
      expect(op(host, "titulo")).toBe("0");   // se esta yendo
    });
  });

  it("el fundido devuelve la capa a SU opacidad, no a 1", async () => {
    await conMenosMovimiento(async (host, motor) => {
      motor.setLang("en");
      // A los 150ms: nuestro fundido ya restauro (120ms) y todavia no ha saltado
      // el `animationend` que la entrada del motor deja registrado, que tambien
      // reescribe la opacidad (ImageEngine:1994). Los dos acaban en el mismo
      // valor, asi que en produccion converge; medir mas tarde solo mide al otro.
      await new Promise((r) => setTimeout(r, 150));
      // Una capa al 40% no puede acabar opaca por cambiar de idioma.
      expect(op(host, "translucida")).toBe("0.4");
      expect(host.shadowRoot!.querySelector('[data-slot-id="titulo"]')!.textContent).toContain("Hello");
    });
  });

  it("una capa con animacion propia de opacidad cambia sin fundido", async () => {
    // Los dos fundidos pelearian y se veria un parpadeo que nadie sabria
    // explicar. Mas vale cambio seco que dos animaciones discutiendo.
    await conMenosMovimiento(async (host, motor) => {
      const el = host.shadowRoot!.querySelector('[data-slot-id="pulsante"]') as HTMLElement;
      el.style.animationName = "oim-latido-opacity";
      const antes = el.style.opacity;
      motor.setLang("en");
      expect(op(host, "pulsante")).toBe(antes);
    });
  });

  it("una capa que no cambia no se funde", async () => {
    await conMenosMovimiento(async (host, motor) => {
      motor.setLang("en");
      // "quieto" dice lo mismo en los dos idiomas: no tiene por que parpadear.
      expect(op(host, "quieto")).toBe("1");
    });
  });
});
