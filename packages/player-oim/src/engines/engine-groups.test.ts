/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// @vitest-environment happy-dom

/**
 * El grupo, dentro del motor de verdad.
 *
 * `core/grupos.test.ts` comprueba las reglas; esto comprueba que el motor las
 * APLICA. La diferencia no es teórica: la mitad de los fallos de estos días
 * eran una regla correcta que la path real no llegaba a usar, y una regla
 * comprobada que nadie aplica se comporta igual que una que no existe.
 *
 * Fase 3 de `docs/superpowers/specs/2026-08-23-el-grupo-como-nodo-design.md`.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ImageEngine } from "./ImageEngine";

const LIENZO = { canvas_width: 800, canvas_height: 600 };

const capa = (id: string, extra: any = {}) => ({
  id,
  type: "geo",
  content: { es: "" },
  position: [0.1, 0.1],
  width_px: 100,
  height_px: 100,
  ...extra,
  // Una capa real siempre trae fill: `buildSlotStyle` escribe `fillColor`
  // en todas. Sin el, el motor la descarta antes de construir nada, asi que se
  // fusiona con lo que traiga `extra` en vez de dejar que lo machaque.
  style: { fillColor: "#ff0000", ...(extra.style || {}) },
});

describe("el grupo en el motor", () => {
  let hostEl: HTMLElement;
  let shadowRoot: ShadowRoot;

  const motorCon = (slots: any[]) => {
    const engine = new ImageEngine(hostEl);
    engine._overlay = document.createElement("div");
    shadowRoot.appendChild(engine._overlay);
    engine.metadata = { ...LIENZO, slots };
    return engine;
  };

  const el = (engine: any, id: string) =>
    engine._overlay!.querySelector('[data-slot-id="' + id + '"]') as HTMLElement;

  beforeEach(() => {
    hostEl = document.createElement("div");
    document.body.appendChild(hostEl);
    shadowRoot = hostEl.attachShadow({ mode: "open" });
  });

  afterEach(() => {
    if (hostEl.parentNode) document.body.removeChild(hostEl);
  });

  it("mete a los hijos DENTRO del elemento del grupo", async () => {
    const engine = motorCon([
      capa("g1", { type: "group", position: [0.1, 0.1], width_px: 200, height_px: 100 }),
      capa("a", { style: { groupId: "g1" } }),
      capa("b", { style: { groupId: "g1" } }),
    ]);
    await engine.renderSlots();

    expect(el(engine, "g1").contains(el(engine, "a"))).toBe(true);
    expect(el(engine, "g1").contains(el(engine, "b"))).toBe(true);
  });

  it("y van dentro del container que ANIMA, no colgando del slot", async () => {
    // La animacion de un slot corre sobre `.oim-slot-loop-wrap` y nunca sobre
    // el propio slot, porque el transform de `.oim-slot` es su anclaje de
    // posicion. Colgar los hijos del slot los dejaria como HERMANOS de la
    // animacion: animar el grupo moveria un wrapper vacio y los hijos se
    // quedarian quietos.
    const engine = motorCon([
      capa("g1", { type: "group" }),
      capa("a", { style: { groupId: "g1" } }),
    ]);
    await engine.renderSlots();

    const container = el(engine, "a").parentElement!;
    expect(container.dataset.oimGrupo).toBe("g1");
    expect(container.className).toContain("oim-slot-loop-wrap");
  });

  it("y ese container gira sobre el centro del GRUPO", async () => {
    const engine = motorCon([
      capa("g1", { type: "group", position: [0.25, 0.5], width_px: 200, height_px: 100 }),
      capa("a", { style: { groupId: "g1" } }),
    ]);
    await engine.renderSlots();

    // `.oim-slot-loop-wrap` trae `center center`, que en un wrapper del
    // size del lienzo es el centro del LIENZO.
    expect(el(engine, "a").parentElement!.style.transformOrigin).toBe("300px 350px");
  });

  it("el grupo deja de ser una caja de su size y pasa a cubrir el lienzo", async () => {
    // Era el peso muerto: un elemento vacio de 200x100 encima de sus hijos.
    // Ahora envuelve, y por eso tiene que estar en el origen: los hijos traen
    // coordenadas de LIENZO y se irian de sitio dentro de una caja desplazada.
    const engine = motorCon([
      capa("g1", { type: "group", position: [0.25, 0.5], width_px: 200, height_px: 100 }),
      capa("a", { style: { groupId: "g1" } }),
      capa("b", { style: { groupId: "g1" } }),
    ]);
    await engine.renderSlots();

    const groupEl = el(engine, "g1");
    expect(groupEl.style.left).toBe("0px");
    expect(groupEl.style.top).toBe("0px");
    expect(groupEl.style.width).toBe("800px");
    expect(groupEl.style.height).toBe("600px");
    // El origen de la transformada sigue en el centro del GRUPO: rotarlo tiene
    // que girarlo sobre si mismo, no sobre el centro del lienzo.
    expect(groupEl.style.transformOrigin).toBe("300px 350px");
  });

  it("no se traga los clics del resto del lienzo", async () => {
    const engine = motorCon([
      capa("g1", { type: "group", width_px: 20, height_px: 20 }),
      capa("a", { style: { groupId: "g1" } }),
      capa("b", { style: { groupId: "g1" } }),
    ]);
    await engine.renderSlots();
    expect(el(engine, "g1").style.pointerEvents).toBe("none");
    // Y no recorta: cubre el lienzo entero, asi que `overflow: hidden`
    // cortaria la sombra o el desplazamiento de animacion de cualquier hijo.
    expect(el(engine, "g1").style.overflow).toBe("visible");
  });

  it("ocultar el grupo oculta a sus hijos, sin propagar nada a mano", async () => {
    // La prueba de que el arbol funciona: `display: none` en el padre y los
    // hijos, que no llevan NADA propio, dejan de verse porque estan dentro.
    const engine = motorCon([
      capa("g1", { type: "group", style: { isVisible: false } }),
      capa("a", { style: { groupId: "g1" } }),
      capa("b", { style: { groupId: "g1" } }),
    ]);
    await engine.renderSlots();

    expect(el(engine, "g1").style.display).toBe("none");
    expect(el(engine, "a").style.display).not.toBe("none");
    expect(el(engine, "g1").contains(el(engine, "a"))).toBe(true);
  });

  it("la opacidad del grupo la heredan los hijos por CSS", async () => {
    const engine = motorCon([
      capa("g1", { type: "group", style: { opacity: 40 } }),
      capa("a", { style: { groupId: "g1" } }),
      capa("b", { style: { groupId: "g1" } }),
    ]);
    await engine.renderSlots();

    expect(el(engine, "g1").dataset.oimOpacity).toBe("0.4");
    // El hijo NO lleva la opacidad escrita: la hereda por estar dentro.
    expect(el(engine, "a").dataset.oimOpacity).toBe("1");
  });
});

describe("degradar sin perder nada", () => {
  let hostEl: HTMLElement;
  let shadowRoot: ShadowRoot;

  const motorCon = (slots: any[]) => {
    const engine = new ImageEngine(hostEl);
    engine._overlay = document.createElement("div");
    shadowRoot.appendChild(engine._overlay);
    engine.metadata = { ...LIENZO, slots };
    return engine;
  };

  beforeEach(() => {
    hostEl = document.createElement("div");
    document.body.appendChild(hostEl);
    shadowRoot = hostEl.attachShadow({ mode: "open" });
  });

  afterEach(() => {
    if (hostEl.parentNode) document.body.removeChild(hostEl);
  });

  it("un archivo ANTERIOR a la fase 3 se pinta plano, como siempre", async () => {
    // Ningun slot trae `style.groupId`. Es el caso de todos los .oim ya
    // publicados, y tiene que verse exactamente igual que antes: las dos capas
    // sueltas, y el grupo SIN elemento.
    //
    // Que el grupo no aparezca no es un descarte nuevo: `group` no esta en
    // `isGeoLike`, asi que un slot de grupo sin text se descartaba ya antes
    // de la fase 3. Medido, y contra lo que decia el diagnostico del diseno:
    // el peso muerto del grupo estaba en el archivo firmado, no en el DOM.
    const engine = motorCon([
      capa("g1", { type: "group" }),
      capa("a"),
      capa("b"),
    ]);
    await engine.renderSlots();

    const sueltos = engine._overlay!.querySelectorAll(":scope > [data-slot-id]");
    expect(Array.from(sueltos).map((e: any) => e.dataset.slotId)).toEqual(["a", "b"]);
  });

  it("un hijo cuyo grupo no llego se queda suelto, no desaparece", async () => {
    const engine = motorCon([capa("a", { style: { groupId: "g_perdido" } }), capa("b")]);
    await engine.renderSlots();

    expect(engine._overlay!.querySelectorAll("[data-slot-id]")).toHaveLength(2);
  });

  it("ninguna capa se pierde del DOM en un archivo mezclado", async () => {
    const slots = [
      capa("g1", { type: "group" }),
      capa("a", { style: { groupId: "g1" } }),
      capa("b", { style: { groupId: "g1" } }),
      capa("huerfano", { style: { groupId: "g_perdido" } }),
      capa("suelta"),
    ];
    const engine = motorCon(slots);
    await engine.renderSlots();

    const enElArbol = Array.from(engine._overlay!.querySelectorAll("[data-slot-id]"))
      .map((e: any) => e.dataset.slotId).sort();
    expect(enElArbol).toEqual(slots.map((s) => s.id).sort());
  });
});

describe("un repintado parcial no rompe el grupo", () => {
  // `renderSlots({onlyIds})` sustituye en su sitio los nodos que cambian —lo
  // usa el cambio de idioma— y conserva animaciones y parallax del resto.
  let hostEl: HTMLElement;
  let shadowRoot: ShadowRoot;

  const motorCon = (slots: any[]) => {
    const engine = new ImageEngine(hostEl);
    engine._overlay = document.createElement("div");
    shadowRoot.appendChild(engine._overlay);
    engine.metadata = { ...LIENZO, slots };
    return engine;
  };

  const el = (engine: any, id: string) =>
    engine._overlay!.querySelector('[data-slot-id="' + id + '"]') as HTMLElement;

  const escena = () => [
    capa("g1", { type: "group" }),
    capa("a", { style: { groupId: "g1" } }),
    capa("b", { style: { groupId: "g1" } }),
  ];

  beforeEach(() => {
    hostEl = document.createElement("div");
    document.body.appendChild(hostEl);
    shadowRoot = hostEl.attachShadow({ mode: "open" });
  });

  afterEach(() => {
    if (hostEl.parentNode) document.body.removeChild(hostEl);
  });

  it("repintar SOLO un hijo lo deja dentro del grupo", async () => {
    const engine = motorCon(escena());
    await engine.renderSlots();
    await engine.renderSlots({ onlyIds: new Set(["a"]) });

    expect(el(engine, "a")).not.toBeNull();
    expect(el(engine, "g1").contains(el(engine, "a"))).toBe(true);
  });

  it("repintar el grupo Y un hijo a la vez no pierde al hijo", async () => {
    // Es el caso que se me escapo al escribir la fase 3: anidando ANTES de la
    // sustitucion, `replaceChild` metia el hijo nuevo dentro del elemento
    // VIEJO del grupo y acto seguido sustituia ese grupo entero. El hijo se
    // iba con el y la capa desaparecia del lienzo.
    const engine = motorCon(escena());
    await engine.renderSlots();
    await engine.renderSlots({ onlyIds: new Set(["g1", "a"]) });

    const enElArbol = Array.from(engine._overlay!.querySelectorAll("[data-slot-id]"))
      .map((e: any) => e.dataset.slotId).sort();
    expect(enElArbol).toEqual(["a", "b", "g1"]);
    expect(el(engine, "g1").contains(el(engine, "a"))).toBe(true);
    expect(el(engine, "g1").contains(el(engine, "b"))).toBe(true);
  });

  it("repintar el grupo entero conserva a los dos hijos y su orden", async () => {
    const engine = motorCon(escena());
    await engine.renderSlots();
    await engine.renderSlots({ onlyIds: new Set(["g1", "a", "b"]) });

    expect(Array.from(el(engine, "g1").querySelectorAll("[data-slot-id]"))
      .map((e: any) => e.dataset.slotId)).toEqual(["a", "b"]);
  });
});

describe("animar una capa que esta en un grupo", () => {
  // Does grouping an animated layer replace its animation? No. A group never
  // touches its children's animations: they COMPOSE, because they live on
  // nested elements and transforms multiply on the way down.
  let hostEl: HTMLElement;
  let shadowRoot: ShadowRoot;

  const conAnimacion = (extra: any = {}) => ({
    duration: 2,
    keyframes: [
      { t: 0, o: 0 },
      { t: 1, o: 100 },
    ],
    ...extra,
  });

  beforeEach(() => {
    hostEl = document.createElement("div");
    document.body.appendChild(hostEl);
    shadowRoot = hostEl.attachShadow({ mode: "open" });
  });

  afterEach(() => {
    if (hostEl.parentNode) document.body.removeChild(hostEl);
  });

  it("el hijo conserva SU animacion y el grupo la SUYA: son dos elementos", async () => {
    const engine = new ImageEngine(hostEl);
    engine._overlay = document.createElement("div");
    shadowRoot.appendChild(engine._overlay);
    engine.metadata = { ...LIENZO, slots: [
      capa("g1", { type: "group", style: { animation: conAnimacion() } }),
      capa("a", { style: { groupId: "g1", animation: conAnimacion() } }),
      capa("b", { style: { groupId: "g1" } }),
    ]};
    await engine.renderSlots();

    const groupEl = engine._overlay!.querySelector('[data-slot-id="g1"]') as HTMLElement;
    const childEl = engine._overlay!.querySelector('[data-slot-id="a"]') as HTMLElement;

    // El hijo sigue estando dentro, y sigue siendo un elemento propio: nadie
    // ha fundido su animacion con la del padre ni se la ha quitado. Las dos
    // corren, en elementos anidados, y se COMPONEN.
    expect(groupEl.contains(childEl)).toBe(true);
    expect(childEl).not.toBe(groupEl);
  });
});

describe("lo que el wrapper desbloquea (fase 4)", () => {
  // El diseno prometia tres cosas para la fase 4 —animar un grupo entero, una
  // accion que lo muestre u oculte, y parallax sobre el conjunto— y decia que
  // ninguna necesitaria codigo nuevo de jerarquia. Esto lo comprueba: las tres
  // salen del wrapper, sin una sola linea que hable de `childIds`.
  let hostEl: HTMLElement;
  let shadowRoot: ShadowRoot;

  const motorCon = (slots: any[]) => {
    const engine = new ImageEngine(hostEl);
    engine._overlay = document.createElement("div");
    shadowRoot.appendChild(engine._overlay);
    engine.metadata = { ...LIENZO, slots };
    return engine;
  };

  const el = (engine: any, id: string) =>
    engine._overlay!.querySelector('[data-slot-id="' + id + '"]') as HTMLElement;

  /** `queueUpdate` agrupa las escrituras al DOM; esto espera a que salgan. */
  const alSiguienteCuadro = () =>
    new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

  beforeEach(() => {
    hostEl = document.createElement("div");
    document.body.appendChild(hostEl);
    shadowRoot = hostEl.attachShadow({ mode: "open" });
  });

  afterEach(() => {
    if (hostEl.parentNode) document.body.removeChild(hostEl);
  });

  it("una accion que oculta el grupo oculta todo lo que hay dentro", async () => {
    const engine = motorCon([
      capa("g1", { type: "group" }),
      capa("a", { style: { groupId: "g1" } }),
      capa("b", { style: { groupId: "g1" } }),
      capa("fuera"),
    ]);
    await engine.renderSlots();

    engine.disableAnimations = true;
    engine.executeToggleState({ hide_slots: ["g1"] });
    await alSiguienteCuadro();

    // `executeToggleState` sigue buscando UN elemento por `data-slot-id` y no
    // sabe nada de grupos. Los hijos desaparecen porque estan dentro, y sin
    // que nadie recorra `childIds`.
    expect(el(engine, "g1").style.display).toBe("none");
    expect(el(engine, "fuera").style.display).not.toBe("none");
    expect(el(engine, "g1").contains(el(engine, "a"))).toBe(true);
  });

  it("y volver a mostrarlo devuelve el grupo entero", async () => {
    const engine = motorCon([
      capa("g1", { type: "group" }),
      capa("a", { style: { groupId: "g1" } }),
      capa("b", { style: { groupId: "g1" } }),
    ]);
    await engine.renderSlots();

    engine.disableAnimations = true;
    engine.executeToggleState({ hide_slots: ["g1"] });
    await alSiguienteCuadro();
    engine.executeToggleState({ show_slots: ["g1"] });
    await alSiguienteCuadro();

    expect(el(engine, "g1").style.display).not.toBe("none");
    expect(el(engine, "g1").contains(el(engine, "a"))).toBe(true);
  });

  it("el parallax de un grupo mueve el wrapper, no una caja vacia", async () => {
    const engine = motorCon([
      capa("g1", { type: "group", style: { parallax: { enabled: true, depth: 0.5, axis: "both" } } }),
      capa("a", { style: { groupId: "g1" } }),
      capa("b", { style: { groupId: "g1" } }),
    ]);
    await engine.renderSlots();

    // El controlador registra el elemento del slot, que en un grupo ES el
    // wrapper: al desplazarlo se va con el todo lo que contiene.
    expect(engine._parallaxController).not.toBeNull();
    expect(el(engine, "g1").contains(el(engine, "a"))).toBe(true);
    expect(el(engine, "g1").contains(el(engine, "b"))).toBe(true);
  });
});

describe("con un slot como el que emite el backend DE VERDAD", () => {
  // Esta es la prueba que faltaba, y su ausencia costo un fallo entero.
  //
  // El backend emite SIEMPRE `style.width` y `style.height` en cqw, y el motor
  // tiene un bucle que vuelca `style` sobre el elemento. Ese bucle corria
  // DESPUES del bloque del wrapper y le pisaba el size: el wrapper se
  // quedaba con la caja del grupo en vez del lienzo, y sus hijos salian a la
  // mitad de size y fuera de sitio.
  //
  // Ninguna prueba lo vio porque todas construian el slot con la forma que el
  // codigo espera —sin `style.width`—, asi que el bucle no tenia nada que
  // pisar. Aparecio al abrir un .oim firmado por produccion.
  let hostEl: HTMLElement;
  let shadowRoot: ShadowRoot;

  const motorCon = (slots: any[]) => {
    const engine = new ImageEngine(hostEl);
    engine._overlay = document.createElement("div");
    shadowRoot.appendChild(engine._overlay);
    engine.metadata = { ...LIENZO, slots };
    return engine;
  };

  const el = (engine: any, id: string) =>
    engine._overlay!.querySelector('[data-slot-id="' + id + '"]') as HTMLElement;

  /** Un slot con la forma exacta que sale de `/v1/oim/compile`. */
  const comoDelBackend = (id: string, extra: any = {}) => ({
    id,
    type: "geo",
    content: { es: "" },
    position: [12.5, 25.0],
    width_px: 300,
    height_px: 160,
    ...extra,
    style: {
      fillColor: "#ef4444",
      // Los dos campos que el backend anade a TODOS los slots.
      width: "37.5cqw",
      height: "20.0cqw",
      ...(extra.style || {}),
    },
  });

  beforeEach(() => {
    hostEl = document.createElement("div");
    document.body.appendChild(hostEl);
    shadowRoot = hostEl.attachShadow({ mode: "open" });
  });

  afterEach(() => {
    if (hostEl.parentNode) document.body.removeChild(hostEl);
  });

  it("el `style.width` del archivo NO pisa el size del wrapper", async () => {
    const engine = motorCon([
      comoDelBackend("g1", { type: "group" }),
      comoDelBackend("a", { style: { groupId: "g1" } }),
      comoDelBackend("b", { style: { groupId: "g1" } }),
    ]);
    await engine.renderSlots();

    const groupEl = el(engine, "g1");
    expect(groupEl.style.width).toBe("800px");
    expect(groupEl.style.height).toBe("600px");
    expect(groupEl.style.left).toBe("0px");
    expect(groupEl.style.top).toBe("0px");
  });

  it("neutraliza la scale del visor, que si no se aplicaria dos veces", async () => {
    // `--oim-scale` la fija el overlay y cascada a todo lo de dentro;
    // `.oim-slot` la aplica en su propia transformada. El wrapper es un
    // `.oim-slot` que CONTIENE a otros, asi que sus hijos la recibian dos
    // veces y salian a la mitad de size.
    //
    // Esta prueba mira la variable y no el ancho medido a proposito: happy-dom
    // no compone transformadas. El size de verdad se comprobo en un
    // navegador, abriendo el .oim con el player del CDN.
    const engine = motorCon([
      comoDelBackend("g1", { type: "group" }),
      comoDelBackend("a", { style: { groupId: "g1" } }),
    ]);
    await engine.renderSlots();
    expect(el(engine, "g1").style.getPropertyValue("--oim-scale")).toBe("1");
  });

  it("y una capa suelta SI conserva el suyo", async () => {
    // El wrapper es la excepcion, no la regla nueva.
    const engine = motorCon([comoDelBackend("suelta")]);
    await engine.renderSlots();
    expect(el(engine, "suelta").style.width).not.toBe("800px");
  });
});
