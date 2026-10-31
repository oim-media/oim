/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `oim:action`: el player DICE lo que hizo; no hace lo que le manden.
 *
 * Hay tres formas de que un clic salga del archivo:
 *
 *   1. el archivo declara una URL y el player navega  -> decide el ARCHIVO
 *   2. el archivo lleva codigo y el player lo ejecuta -> jamas
 *   3. el player anuncia lo que paso y la pagina decide -> decide la PAGINA
 *
 * Esto es la tercera, y es la unica que respeta el consentimiento de quien
 * embebe. El archivo no puede PROVOCAR nada: solo puede DECIR algo, y solo si
 * la pagina se molesta en escuchar. No hay handler declarado en el .oim, ni
 * `href`, ni destino.
 *
 * Y no es un adorno: es lo que hace INNECESARIO que el player navegue. Si una
 * pagina quiere que pulsar lleve a un producto, escucha y navega ella, con su
 * URL y sus reglas. Sin este evento la presion para implementar `link` en el
 * player no desaparece nunca, porque el integrador necesita algo.
 *
 * El detalle lleva SOLO identificadores que el autor puso en el archivo. Sin
 * URLs —la regla de las imagenes vale igual aqui— y sin datos libres: no es un
 * canal hacia fuera, es el mismo documento hablando de si mismo.
 */

import { describe, it, expect, vi } from "vitest";
import ImageEngine from "./ImageEngine";

function montar(slots: any[]) {
  const host = document.createElement("div");
  host.setAttribute("mode", "full");
  // Sin animaciones el mostrar/ocultar es INSTANTANEO y se puede observar. Con
  // ellas, un slot nace en `opacity: 0` esperando un `requestAnimationFrame`
  // que en happy-dom no llega, asi que ya valia "0" antes del clic y comparar
  // opacidades no distinguia nada: las dos pruebas del veto pasaban en vacio.
  //
  // De paso comprueba que los dos ejes son independientes: acciones encendidas
  // por el mode, movimiento apagado por el atributo.
  host.setAttribute("disable-animations", "true");
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

const caja = (id: string, extra: any = {}) => ({
  id, type: "text", align: "center", position: [10, 10],
  content: { es: id.toUpperCase() },
  style: { width: "32.5cqw", height: "8.75cqw", fontSize: "2.75cqw", ...extra },
});

// `hide` y no `toggle`: ocultar deja `display: none`, que la pintura normal no
// produce nunca. Con `toggle` el resultado dependia del estado de partida y
// coincidia con lo que el propio render deja encolado — comparar ahi no
// distingue el efecto de la accion del efecto de pintar.
const ACCIONES = [{ target: "ficha", type: "hide" }];

async function escenario(states: any, extra: any = {}) {
  const { host, motor } = montar([
    { ...caja("boton", { isInteractive: true, states: states }), ...extra },
    caja("ficha"),
  ]);
  await motor.renderSlots();
  const sr = host.shadowRoot!;
  const avisos: any[] = [];
  host.addEventListener("oim:action", (e: any) => avisos.push(e));
  return {
    host, avisos,
    // `queueUpdate` encola y aplica en el siguiente fotograma. happy-dom no da
    // fotogramas, asi que sin esto la cola no se vacia nunca y el DOM se queda
    // como estaba: comparar styles ahi no distingue nada.
    vaciar: () => motor._flushDOMUpdates(),
    boton: sr.querySelector('[data-slot-id="boton"]') as HTMLElement,
    ficha: sr.querySelector('[data-slot-id="ficha"]') as HTMLElement,
  };
}

describe("el player anuncia lo que hizo", () => {
  it("un clic emite oim:action", async () => {
    const e = await escenario({ active: { actions: ACCIONES } });
    e.boton.dispatchEvent(new Event("click"));
    expect(e.avisos.length).toBe(1);
    expect(e.avisos[0].detail.slot).toBe("boton");
    expect(e.avisos[0].detail.trigger).toBe("click");
  });

  it("y dice a que capas afecta", async () => {
    const e = await escenario({ active: { actions: ACCIONES } });
    e.boton.dispatchEvent(new Event("click"));
    expect(e.avisos[0].detail.targets).toEqual(["ficha"]);
  });

  it("el hover tambien avisa, y se distingue del clic", async () => {
    const e = await escenario({ hover: { actions: ACCIONES } });
    e.boton.dispatchEvent(new Event("mouseenter"));
    expect(e.avisos.length).toBe(1);
    expect(e.avisos[0].detail.trigger).toBe("hover");
  });

  /**
   * El guardian del detalle. Sin esto, cualquiera puede colar mañana un campo
   * con una URL o con content del archivo, y el evento deja de ser «el
   * documento hablando de si mismo» para volverse un canal.
   */
  it("y NO lleva nada mas que identificadores del propio archivo", async () => {
    const e = await escenario({ active: { actions: ACCIONES } });
    e.boton.dispatchEvent(new Event("click"));
    expect(Object.keys(e.avisos[0].detail).sort()).toEqual(["name", "slot", "targets", "trigger", "types"]);
  });
});

/**
 * Escuchar por NOMBRE, que es lo unico que un humano puede escribir.
 *
 * El id lo inventa el editor al azar —`shape_text_k3j9x2m1p`, de
 * `Math.random().toString(36)`—, asi que ni el propio autor puede escribir
 * `if (e.detail.slot === "Boton1")`. Tendria que abrir el archivo a copiar una
 * cadena aleatoria, que es justo el trabajo que este evento viene a evitar.
 *
 * `name` es lo que el autor teclea y ve en su lista de capas, y viaja al
 * archivo desde el 22 de agosto. El `id` se queda como clave estable —los
 * `targets` de las acciones lo usan— y el nombre como el legible.
 *
 * Los nombres NO son unicos: dos capas pueden llamarse igual y las dos
 * emitiran. Es responsabilidad de quien escucha, y por eso el id sigue yendo.
 */
describe("el aviso se puede escuchar por nombre", () => {
  it("lleva el nombre que puso el autor", async () => {
    const e = await escenario({ active: { actions: ACCIONES } }, { name: "Boton1" });
    e.boton.dispatchEvent(new Event("click"));
    expect(e.avisos[0].detail.name).toBe("Boton1");
  });

  it("y sigue llevando el id, que es la clave estable", async () => {
    const e = await escenario({ active: { actions: ACCIONES } }, { name: "Boton1" });
    e.boton.dispatchEvent(new Event("click"));
    expect(e.avisos[0].detail.slot).toBe("boton");
  });

  /** Una capa sin nombre no inventa uno: se omite y queda el id. */
  it("una capa sin nombre no se lo inventa", async () => {
    const e = await escenario({ active: { actions: ACCIONES } });
    e.boton.dispatchEvent(new Event("click"));
    expect(e.avisos[0].detail.name).toBeUndefined();
  });
});

/**
 * Una capa interactiva SIN acciones tambien avisa.
 *
 * El caso que lo pide: un boton que el autor pone en su propia web para que la
 * PAGINA navegue. No quiere ningun efecto local — quiere que se lo cuenten—. Sin
 * esto tendria que declarar una accion falsa, un mostrar/ocultar de mentira,
 * solo para que el evento exista.
 *
 * Y no hace falta comprobar nada nuevo: `bindStates` solo se llama cuando el
 * slot YA es interactivo (`ImageEngine.ts:2096`), asi que la condicion de las
 * acciones sobraba. El aviso sale con `targets` y `types` vacios.
 */
describe("una capa interactiva sin acciones", () => {
  it("avisa igual, con destinos vacios", async () => {
    const e = await escenario({ hover: { scale: 1.1 } }, { name: "Comprar" });
    e.boton.dispatchEvent(new Event("click"));
    expect(e.avisos.length).toBe(1);
    expect(e.avisos[0].detail.name).toBe("Comprar");
    expect(e.avisos[0].detail.targets).toEqual([]);
    expect(e.avisos[0].detail.types).toEqual([]);
  });

  it("y no toca ninguna capa, que es lo que se esperaba", async () => {
    const e = await escenario({ hover: { scale: 1.1 } });
    e.boton.dispatchEvent(new Event("click"));
    e.vaciar();
    expect(e.ficha.style.display).not.toBe("none");
  });
});

describe("la pagina puede vetar el efecto local", () => {
  /**
   * `cancelable`. Con esto una galeria puede decidir clic a clic sin necesitar
   * siquiera `mode="image"`: escucha, veta, y hace lo suyo.
   */
  it("preventDefault deja la capa como estaba", async () => {
    const e = await escenario({ active: { actions: ACCIONES } });
    e.host.addEventListener("oim:action", (ev: any) => ev.preventDefault());
    e.boton.dispatchEvent(new Event("click"));
    e.vaciar();
    expect(e.ficha.style.display).not.toBe("none");
  });

  it("y sin vetarlo, la capa si cambia", async () => {
    const e = await escenario({ active: { actions: ACCIONES } });
    e.boton.dispatchEvent(new Event("click"));
    e.vaciar();
    expect(e.ficha.style.display).toBe("none");
  });

  it("el evento es cancelable de verdad", async () => {
    const e = await escenario({ active: { actions: ACCIONES } });
    e.boton.dispatchEvent(new Event("click"));
    expect(e.avisos[0].cancelable).toBe(true);
  });
});

describe("no molesta a quien no escucha", () => {
  it("sin oyentes, el clic sigue funcionando", async () => {
    const { host, motor } = montar([
      caja("boton", { isInteractive: true, states: { active: { actions: ACCIONES } } }),
      caja("ficha"),
    ]);
    await motor.renderSlots();
    const sr = host.shadowRoot!;
    const boton = sr.querySelector('[data-slot-id="boton"]') as HTMLElement;
    expect(() => boton.dispatchEvent(new Event("click"))).not.toThrow();
    motor._flushDOMUpdates();
    expect((sr.querySelector('[data-slot-id="ficha"]') as HTMLElement).style.display).toBe("none");
  });

  it("y en mode imagen no hay clic, luego no hay actionEvent", async () => {
    const host = document.createElement("div");
    host.setAttribute("mode", "image");
    const shadow = (host as any).attachShadow({ mode: "open" });
    document.body.appendChild(host);
    const motor: any = new ImageEngine(host as any);
    motor._viewport = document.createElement("div"); shadow.appendChild(motor._viewport);
    motor._overlay = document.createElement("div"); motor._viewport.appendChild(motor._overlay);
    motor.metadata = { slots: [caja("boton", { isInteractive: true, states: { active: { actions: ACCIONES } } })], width: 800, height: 600 };
    await motor.renderSlots();
    const avisos = vi.fn();
    host.addEventListener("oim:action", avisos);
    (shadow.querySelector('[data-slot-id="boton"]') as HTMLElement).dispatchEvent(new Event("click"));
    expect(avisos).not.toHaveBeenCalled();
  });
});
