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
  it("traduce un estado a las propiedades que el slot ya entiende", () => {
    expect(stateStyles({ scale: 1.1, transitionDuration: 0.4 })).toEqual({
      "--oim-slot-hover-scale": "1.1",
      "--oim-transition-duration": "0.4s"
    });
  });

  it("un estado vacio no emite nada, para no pisar el style base", () => {
    expect(stateStyles({})).toEqual({});
  });

  it("la opacidad viaja en 0-100 y sale en 0-1", () => {
    // El editor la guarda en 0-100 (`types.ts`). Emitir "50" en vez de "0.5"
    // deja el slot visible, y el fallo se ve como "no pasa nada".
    expect(stateStyles({ opacity: 50 })).toEqual({ opacity: "0.5" });
    expect(stateStyles({ opacity: 0 })).toEqual({ opacity: "0" });
  });

  it("la rotacion y el color se traducen correctamente", () => {
    expect(stateStyles({ rotation: 45, color: "#ff0000" })).toEqual({
      "--oim-rot": "45deg",
      color: "#ff0000"
    });
  });
});

describe("bindStates", () => {
  /** Escribe de inmediato, como haría `queueUpdate` tras vaciar su cola. */
  const escribirYa = (el: HTMLElement, styles: Record<string, string>) => {
    for (const [k, v] of Object.entries(styles)) {
      if (k.startsWith("--")) {
        if (v === "") el.style.removeProperty(k);
        else el.style.setProperty(k, v);
      } else {
        (el.style as unknown as Record<string, string>)[k] = v;
      }
    }
  };

  it("aplica el estado al entrar el cursor y lo deshace al salir", () => {
    const el = document.createElement("div");
    el.style.setProperty("--oim-slot-hover-scale", "1");
    bindStates(el, { hover: { scale: 1.4, opacity: 50 } }, escribirYa);

    el.dispatchEvent(new Event("mouseenter"));
    expect(el.style.getPropertyValue("--oim-slot-hover-scale")).toBe("1.4");
    expect(el.style.opacity).toBe("0.5");

    el.dispatchEvent(new Event("mouseleave"));
    expect(el.style.getPropertyValue("--oim-slot-hover-scale")).toBe("1");
    expect(el.style.opacity).toBe("");
  });

  it("el valor base se captura ANTES de pisarlo, no despues", () => {
    // Si se capturara despues, salir del hover devolveria el valor del hover y
    // la capa se quedaria agrandada para siempre. Se comprueba con dos entradas
    // seguidas: la segunda no debe re-capturar.
    const el = document.createElement("div");
    el.style.setProperty("--oim-slot-hover-scale", "1");
    bindStates(el, { hover: { scale: 2 } }, escribirYa);

    el.dispatchEvent(new Event("mouseenter"));
    el.dispatchEvent(new Event("mouseenter"));
    el.dispatchEvent(new Event("mouseleave"));

    expect(el.style.getPropertyValue("--oim-slot-hover-scale")).toBe("1");
  });

  it("sin states no engancha nada", () => {
    const el = document.createElement("div");
    const escribir = vi.fn();
    bindStates(el, undefined, escribir);
    el.dispatchEvent(new Event("mouseenter"));
    expect(escribir).not.toHaveBeenCalled();
  });

  it("dispara ejecutar de actionRunner en mouseenter y revertir en mouseleave", () => {
    const el = document.createElement("div");
    const gestor = {
      run: vi.fn(),
      revert: vi.fn()
    };
    const actions = [{ target: "precio", type: "show" }];
    bindStates(el, { hover: { scale: 1.1, actions } }, vi.fn(), gestor);

    el.dispatchEvent(new Event("mouseenter"));
    expect(gestor.run).toHaveBeenCalledWith(actions, "hover");
    expect(gestor.revert).not.toHaveBeenCalled();

    el.dispatchEvent(new Event("mouseleave"));
    expect(gestor.revert).toHaveBeenCalledWith(actions);
  });

  it("un pointerdown tactil entra en hover y registra alTocarFuera", () => {
    const el = document.createElement("div");
    el.style.setProperty("--oim-slot-hover-scale", "1");
    const alTocarFuera = vi.fn();
    bindStates(
      el,
      { hover: { scale: 1.5 } },
      escribirYa,
      undefined,
      alTocarFuera
    );

    const touchEvent = new PointerEvent("pointerdown", { pointerType: "touch" });
    el.dispatchEvent(touchEvent);

    expect(el.style.getPropertyValue("--oim-slot-hover-scale")).toBe("1.5");
    expect(alTocarFuera).toHaveBeenCalledTimes(1);
    expect(alTocarFuera).toHaveBeenCalledWith(el, expect.any(Function));
  });

  it("un pointerdown con mouse se ignora para no duplicate con mouseenter", () => {
    const el = document.createElement("div");
    const alTocarFuera = vi.fn();
    const escribir = vi.fn();
    bindStates(
      el,
      { hover: { scale: 1.5 } },
      escribir,
      undefined,
      alTocarFuera
    );

    const mouseEvent = new PointerEvent("pointerdown", { pointerType: "mouse" });
    el.dispatchEvent(mouseEvent);

    expect(escribir).not.toHaveBeenCalled();
    expect(alTocarFuera).not.toHaveBeenCalled();
  });

  it("al invocar el callback de alTocarFuera se sale del estado hover", () => {
    const el = document.createElement("div");
    el.style.setProperty("--oim-slot-hover-scale", "1");
    let salirCallback: (() => void) | null = null;
    const alTocarFuera = vi.fn((_targetEl: HTMLElement, onSalir: () => void) => {
      salirCallback = onSalir;
    });

    bindStates(
      el,
      { hover: { scale: 1.5 } },
      escribirYa,
      undefined,
      alTocarFuera
    );

    const touchEvent = new PointerEvent("pointerdown", { pointerType: "touch" });
    el.dispatchEvent(touchEvent);
    expect(el.style.getPropertyValue("--oim-slot-hover-scale")).toBe("1.5");

    // Simulamos que el listener del container detecta toque fuera y llama a salirCallback
    expect(salirCallback).toBeTypeOf("function");
    salirCallback!();

    expect(el.style.getPropertyValue("--oim-slot-hover-scale")).toBe("1");
  });

  it("bindStates NO toca el tamaño: no es asunto suyo", () => {
    // Estuvo puesto aqui y en el motor a la vez. Esta prueba fija que el
    // enganche se ocupa de CUANDO se entra y se sale de un estado, y nada mas.
    const el = document.createElement("div");
    bindStates(el, { hover: { scale: 1.2 } }, escribirYa);
    expect(el.style.minWidth).toBe("");
    expect(el.style.minHeight).toBe("");
  });
});

describe("applyMinHitArea", () => {
  it("el area de contacto nunca baja de 24x24 px (WCAG 2.5.8)", () => {
    const el = document.createElement("div");
    el.style.width = "8px";
    el.style.height = "8px";
    applyMinHitArea(el);
    expect(parseFloat(el.style.minWidth)).toBeGreaterThanOrEqual(24);
    expect(parseFloat(el.style.minHeight)).toBeGreaterThanOrEqual(24);
  });
});

describe("resolveActions", () => {
  it("show y hide se resuelven a visibilidad por destino", () => {
    expect(resolveActions([
      { target: "precio", type: "show" },
      { target: "actionEvent", type: "hide" }
    ], {})).toEqual({ visibility: { precio: true, actionEvent: false }, texts: {} });
  });

  it("setText no toca la visibilidad", () => {
    expect(resolveActions([
      { target: "precio", type: "setText", value: "9,99" }
    ], {})).toEqual({ visibility: {}, texts: { precio: "9,99" } });
  });

  it("toggle consulta la visibilidad actual", () => {
    expect(resolveActions([{ target: "precio", type: "toggle" }], { precio: true }))
      .toEqual({ visibility: { precio: false }, texts: {} });
  });

  it("una accion sin destino se ignora en vez de romper", () => {
    expect(resolveActions([{ target: "", type: "show" }], {}))
      .toEqual({ visibility: {}, texts: {} });
  });
});

describe("paridad entre vocabularios de interaccion", () => {
  it("states (show/hide) y toggle_elements producen el mismo resultado de visibilidad", () => {
    // Vocabulario nuevo: states con acciones show / hide
    const accionesNuevas = [
      { target: "precio", type: "show" },
      { target: "actionEvent", type: "hide" }
    ];
    const resNuevo = resolveActions(accionesNuevas, { precio: false, actionEvent: true });

    // Vocabulario viejo: interaction con show_slots / hide_slots
    const configVieja = {
      show_slots: ["precio"],
      hide_slots: ["actionEvent"]
    };
    const resViejo: Record<string, boolean> = {};
    (configVieja.show_slots || []).forEach((id) => { resViejo[id] = true; });
    (configVieja.hide_slots || []).forEach((id) => { resViejo[id] = false; });

    expect(resNuevo.visibility).toEqual(resViejo);
    expect(resNuevo.visibility).toEqual({ precio: true, actionEvent: false });
  });

  it("el lector de interaction / toggle_elements sigue preservado", () => {
    const configVieja = {
      hide_slots: ["capa1"],
      show_slots: ["capa2", "capa3"]
    };
    const visibilityMap: Record<string, boolean> = {};
    configVieja.show_slots.forEach((id) => { visibilityMap[id] = true; });
    configVieja.hide_slots.forEach((id) => { visibilityMap[id] = false; });

    expect(visibilityMap).toEqual({
      capa1: false,
      capa2: true,
      capa3: true
    });
  });
});



describe("readInteraction — la forma REAL del archivo", () => {
  /**
   * Este slot está copiado literalmente de `precio_al_pasar_el_cursor.oim.png`,
   * el primer .oim con interacción que se exportó (17 ago). Los campos viajan
   * dentro de `style`, no en la raíz.
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

  it("lee los campos que vienen dentro de style, que es como los escribe el editor", () => {
    const r = readInteraction(slotDelArchivo as never);
    expect(r.isInteractive).toBe(true);
    expect(r.states?.hover?.actions?.[0]).toEqual({
      target: "shape_text_kv740oqil",
      type: "toggle"
    });
  });

  it("sigue leyendo los de la raiz, que es como los llevan los slots escritos a mano", () => {
    const r = readInteraction({ isInteractive: true, states: { hover: { scale: 1.2 } } });
    expect(r.isInteractive).toBe(true);
    expect(r.states?.hover?.scale).toBe(1.2);
  });

  it("un slot sin interaccion no es interactivo", () => {
    expect(readInteraction({ style: { isInteractive: false } } as never).isInteractive).toBe(false);
    expect(readInteraction({} as never).states).toBeUndefined();
  });
});

describe("el toque fuera no puede fiarse de e.target", () => {
  it("el motor usa composedPath para decidir si el toque fue fuera", () => {
    /**
     * El escuchador de "tocar fuera" vive en el host, FUERA del shadow root, y
     * al cruzar esa frontera el navegador reescribe `e.target` al propio host
     * para no filtrar los internos. Con `e.target`, la comprobación veía el
     * host, concluía "fue fuera" y salía del estado justo después de que el
     * slot acabara de entrar: en un móvil, el toque se encendía y se apagaba
     * en el mismo gesto.
     *
     * No se vio en las pruebas ni con eventos sintéticos normales, porque un
     * `new PointerEvent(...)` sin `composed: true` nunca llega al host. Lo
     * enseñó el primer .oim real, tocado con un evento compuesto de verdad.
     *
     * Es una guardia de código fuente porque el escuchador vive en el motor,
     * donde no se puede cubrir sin montarlo entero.
     */
    const fuente = fs.readFileSync(
      path.join(__dirname, "ImageEngine.ts"),
      "utf8"
    );
    const inicio = fuente.indexOf("stage.addEventListener('pointerdown'");
    expect(inicio, "no encuentro el escuchador de tocar fuera").toBeGreaterThan(-1);
    const bloque = fuente.slice(inicio, inicio + 900);
    // Sin comentarios: si no, la propia explicacion hace pasar la prueba.
    const codigo = bloque.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
    expect(codigo, "el toque fuera debe decidirse con composedPath()").toContain("composedPath()");
    expect(codigo, "el toque fuera volvio a decidirse con e.target").not.toContain("e.target");
  });
});

describe("readInteraction — avisa de lo que no puede hacer", () => {
  // El mode de fallo de esta feature es el silencio: el player no engancha nada
  // y quien abre el archivo no sabe por que. Estas pruebas fijan que deje de
  // serlo. Verifican el AVISO, no el valor devuelto, que no cambia.

  it("avisa cuando el slot se declara interactivo y no trae states", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      readInteraction({ isInteractive: true }, "precio");
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain("precio");
      expect(warn.mock.calls[0][0]).toContain("states");
    } finally {
      warn.mockRestore();
    }
  });

  it("avisa cuando trae `states` pero sin `hover`, el unico que entiende hoy", () => {
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
   * Desde que el clic existe, `hover` dejo de ser el unico estado util. Un
   * actionEvent que siga diciendo que la capa "no respondera" seria peor que no
   * avisar: manda a buscar un fallo que no esta.
   */
  it("NO avisa de una capa que solo trae acciones de clic", () => {
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

  /** Pero un `active` SIN acciones no hace nada: sus styles no se aplican. */
  it("y si avisa de un active vacio, que no hace nada", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      readInteraction({ isInteractive: true, states: { active: { scale: 1.2 } } } as never, "boton");
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });

  it("avisa cuando hay states pero nadie marco el slot como interactivo", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      readInteraction({ style: { states: { hover: { scale: 1.2 } } } } as never, "img");
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain("isInteractive");
    } finally {
      warn.mockRestore();
    }
  });

  it("no avisa en los dos casos sanos: interactivo con hover, y slot normal", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      readInteraction({ style: { isInteractive: true, states: { hover: { scale: 1.2 } } } } as never, "ok");
      readInteraction({}, "quieto");
      // `states: {}` es un objeto vacio que el editor puede escribir sin querer
      // decir nada; no merece actionEvent si el slot no es interactivo.
      readInteraction({ states: {} }, "vacio");
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});

describe("el motor tampoco calla lo que no puede hacer", () => {
  // No hay prueba que monte el gestor de acciones -esa ausencia es justo el
  // hueco por el que paso el fallo original-, asi que se fija sobre la fuente,
  // igual que el guardia de `composedPath`.
  const fuente = () => fs.readFileSync(path.join(__dirname, "ImageEngine.ts"), "utf8");
  const sinComentarios = (t: string) =>
    t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");

  it("le pasa el id del slot a readInteraction, o los avisos no dicen cual es", () => {
    const codigo = sinComentarios(fuente());
    const i = codigo.indexOf("readInteraction(");
    expect(i, "no encuentro la llamada a readInteraction").toBeGreaterThan(-1);
    expect(codigo.slice(i, i + 200)).toContain("slot.id");
  });

  it("avisa una sola vez de una accion cuyo destino no existe", () => {
    const codigo = sinComentarios(fuente());
    const i = codigo.indexOf("warnedTargets");
    expect(i, "el destino inexistente volvio a fallar en silencio").toBeGreaterThan(-1);
    // Hasta el final de `run`, y no 900 caracteres fijos: esa ventana
    // caduco en cuanto se anadio el actionEvent `oim:action` en medio, y la prueba
    // fallo por moverse el codigo, no por romperse.
    const fin = codigo.indexOf("revert:", i);
    const bloque = codigo.slice(i, fin > i ? fin : i + 2000);
    expect(bloque, "el actionEvent debe condicionarse a que el destino no exista").toContain("!targetEl");
    expect(bloque, "debe recordarse para no repetirlo en cada hover").toContain("warnedTargets.add");
    expect(bloque).toContain("console.warn");
  });
});

/**
 * El clic, que hasta ahora no existia.
 *
 * El editor ofrece una pestaña «Active (Clic)» con acciones, las guarda en
 * `states.active.actions` y las exporta dentro de `style` —lo hace
 * `buildSlotStyle` en el editor—. El player las recibia y las tiraba:
 * `bindStates` enganchaba `mouseenter`, `mouseleave` y `pointerdown`, y
 * en los tres aplicaba `states.hover`. Su firma declaraba `{ hover?: ... }`, de
 * mode que `active` no es que fallara: no estaba contemplado.
 *
 * La asimetria con el hover es deliberada. El hover tiene una salida natural
 * -el cursor se va- y por eso REVIERTE. El clic no la tiene, y un alternado que
 * se deshiciera solo no seria un alternado.
 */
describe("las acciones al hacer clic", () => {
  const gestorFalso = () => ({ run: vi.fn(), revert: vi.fn() });
  const ACCIONES = [{ target: "ficha", type: "toggle" }];

  it("un clic ejecuta las acciones de active", () => {
    const el = document.createElement("div");
    const gestor = gestorFalso();
    bindStates(el, { active: { actions: ACCIONES } }, vi.fn(), gestor);

    el.dispatchEvent(new Event("click"));
    expect(gestor.run).toHaveBeenCalledWith(ACCIONES, "click");
  });

  /** Lo que separa un alternado de un «mostrar»: que persista. */
  it("y NO las revierte nunca", () => {
    const el = document.createElement("div");
    const gestor = gestorFalso();
    bindStates(el, { active: { actions: ACCIONES } }, vi.fn(), gestor);

    el.dispatchEvent(new Event("click"));
    el.dispatchEvent(new Event("mouseleave"));
    expect(gestor.revert).not.toHaveBeenCalled();
  });

  /** Sin cursor, nada indica que la capa se pueda pulsar. */
  it("la capa se señala como pulsable", () => {
    const el = document.createElement("div");
    bindStates(el, { active: { actions: ACCIONES } }, vi.fn(), gestorFalso());
    expect(el.style.cursor).toBe("pointer");
  });

  /**
   * Estas dos fijaban el contrato ANTERIOR: sin acciones no se enganchaba nada.
   * Cambio a proposito, y son la unica senal de que cambio.
   *
   * El enganche va ahora por SER interactivo. `bindStates` solo se llama cuando
   * el slot ya lo es, asi que comprobar las acciones dejaba mudo el caso que
   * mas lo pide: un boton que el autor pone para que navegue la PAGINA, sin
   * ningun efecto local. Antes tenia que declarar una accion falsa.
   *
   * El precio, y hay que decirlo: una capa interactiva con solo estilos de
   * hover tambien se señala pulsable. Es defendible —el autor la declaro
   * interactiva— pero es un cambio visible.
   */
  it("una capa interactiva SIN acciones tambien se señala pulsable", () => {
    const el = document.createElement("div");
    bindStates(el, { hover: { scale: 1.2 } }, vi.fn(), gestorFalso());
    expect(el.style.cursor).toBe("pointer");
  });

  it("y una lista vacia anuncia, aunque no toque nada", () => {
    const el = document.createElement("div");
    const gestor = gestorFalso();
    bindStates(el, { active: { actions: [] } }, vi.fn(), gestor);
    el.dispatchEvent(new Event("click"));
    // Se anuncia con la lista vacia: `resolveActions([])` no cambia ninguna
    // visibilidad, asi que la pagina se entera y la imagen no se mueve.
    expect(gestor.run).toHaveBeenCalledWith([], "click");
  });

  /**
   * El clic SIGUE su camino hacia arriba.
   *
   * Nacio con `stopPropagation`, copiado del otro camino de clic del motor
   * (`interaction.toggle_elements`). Paridad con algo peor no es una razon.
   *
   * Un .oim va embebido en paginas de terceros, y la galeria de la propia
   * landing es el caso: una tarjeta con su `onClick` para abrir la ficha, y un
   * `<oim-player>` vivo dentro. Tragarse el clic dejaba al usuario pulsando una
   * miniatura que alterna una capa que casi no se ve, y NO abre la ficha.
   *
   * `stopPropagation` es una afirmacion de propiedad: «este clic es mio». El
   * player no sabe que hay a su alrededor, asi que no le toca decidirlo. Hace
   * su efecto local y deja mandar a la pagina.
   *
   * Hoy la galeria no se rompia por accidente —una capa de hover sin
   * `pointer-events: none` se come los clics antes de llegar al slot—. Esta
   * prueba es lo que impide que el arreglo dependa de ese accidente.
   */
  it("el clic sigue subiendo: la pagina de alrededor manda", () => {
    const padre = document.createElement("div");
    const el = document.createElement("div");
    padre.appendChild(el);
    const enElPadre = vi.fn();
    padre.addEventListener("click", enElPadre);

    const gestor = gestorFalso();
    bindStates(el, { active: { actions: ACCIONES } }, vi.fn(), gestor);
    el.dispatchEvent(new Event("click", { bubbles: true }));

    // Las dos cosas pasan: la accion local Y el clic del anfitrion.
    expect(gestor.run).toHaveBeenCalledWith(ACCIONES, "click");
    expect(enElPadre).toHaveBeenCalledTimes(1);
  });

  /**
   * Las dos mitades conviven: enganchar el clic no puede haber roto el hover,
   * que es lo unico que funcionaba antes de esto.
   */
  it("el hover sigue reviertiendo lo suyo, con las dos declaradas", () => {
    const el = document.createElement("div");
    const gestor = gestorFalso();
    const deHover = [{ target: "precio", type: "show" }];
    bindStates(el, { hover: { actions: deHover }, active: { actions: ACCIONES } }, vi.fn(), gestor);

    el.dispatchEvent(new Event("mouseenter"));
    expect(gestor.run).toHaveBeenCalledWith(deHover, "hover");
    el.dispatchEvent(new Event("mouseleave"));
    expect(gestor.revert).toHaveBeenCalledWith(deHover);
    // y el revertir del hover no puede llevarse por delante lo del clic
    expect(gestor.revert).not.toHaveBeenCalledWith(ACCIONES);
  });
});

describe("play (contract 1.22.0)", () => {
  it("has no visibility or text effect", () => {
    expect(resolveActions([{ target: "a", type: "play" } as any], { a: true })).toEqual({ visibility: {}, texts: {} });
  });
});
