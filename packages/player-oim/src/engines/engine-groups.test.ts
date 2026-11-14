/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// @vitest-environment happy-dom

/**
 * The group, inside the real engine.
 *
 * `core/groups.test.ts` checks the rules; this checks that the engine APPLIES
 * them. The difference is not theoretical: half of the failures of these days
 * were a correct rule that the real path never used, and a checked rule that
 * nobody applies behaves the same as one that does not exist.
 *
 * Phase 3 of the group-as-node design spec.
 */

import { v2LayersOf } from "../../../scene/src/legacy/v2-layers.js";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ImageEngine } from "./ImageEngine";

const CANVAS = { canvas_width: 800, canvas_height: 600 };

const layer = (id: string, extra: any = {}) => ({
  id,
  type: "geo",
  content: { es: "" },
  position: [0.1, 0.1],
  width_px: 100,
  height_px: 100,
  ...extra,
  // A real layer always carries fill: `buildSlotStyle` writes `fillColor` in
  // all of them. Without it, the engine discards it before building anything,
  // so it is merged with whatever `extra` brings instead of letting it overwrite it.
  style: { fillColor: "#ff0000", ...(extra.style || {}) },
});

describe("the group in the engine", () => {
  let hostEl: HTMLElement;
  let shadowRoot: ShadowRoot;

  const engineWith = (slots: any[]) => {
    const engine = new ImageEngine(hostEl);
    engine._overlay = document.createElement("div");
    shadowRoot.appendChild(engine._overlay);
    engine.metadata = { ...CANVAS, slots };
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

  it("puts the children INSIDE the group element", async () => {
    const engine = engineWith([
      layer("g1", { type: "group", position: [0.1, 0.1], width_px: 200, height_px: 100 }),
      layer("a", { style: { groupId: "g1" } }),
      layer("b", { style: { groupId: "g1" } }),
    ]);
    await engine.renderSlots();

    expect(el(engine, "g1").contains(el(engine, "a"))).toBe(true);
    expect(el(engine, "g1").contains(el(engine, "b"))).toBe(true);
  });

  it("and they go inside the container that ANIMATES, not hanging off the slot", async () => {
    // The animation of a slot runs on `.oim-slot-loop-wrap` and never on the
    // slot itself, because the transform of `.oim-slot` is its position anchor.
    // Hanging the children off the slot would leave them as SIBLINGS of the
    // animation: animating the group would move an empty wrapper and the
    // children would stay still.
    const engine = engineWith([
      layer("g1", { type: "group" }),
      layer("a", { style: { groupId: "g1" } }),
    ]);
    await engine.renderSlots();

    const container = el(engine, "a").parentElement!;
    expect(container.dataset.oimGrupo).toBe("g1");
    expect(container.className).toContain("oim-slot-loop-wrap");
  });

  it("and that container rotates around the center of the GROUP", async () => {
    const engine = engineWith([
      layer("g1", { type: "group", position: [0.25, 0.5], width_px: 200, height_px: 100 }),
      layer("a", { style: { groupId: "g1" } }),
    ]);
    await engine.renderSlots();

    // `.oim-slot-loop-wrap` carries `center center`, which on a wrapper the
    // size of the canvas is the CANVAS center.
    expect(el(engine, "a").parentElement!.style.transformOrigin).toBe("300px 350px");
  });

  it("the group stops being a box of its size and covers the canvas", async () => {
    // It used to be dead weight: an empty 200x100 element on top of its
    // children. Now it wraps, and so it has to sit at the origin: the children
    // carry CANVAS coordinates and would end up misplaced inside an offset box.
    const engine = engineWith([
      layer("g1", { type: "group", position: [0.25, 0.5], width_px: 200, height_px: 100 }),
      layer("a", { style: { groupId: "g1" } }),
      layer("b", { style: { groupId: "g1" } }),
    ]);
    await engine.renderSlots();

    const groupEl = el(engine, "g1");
    expect(groupEl.style.left).toBe("0px");
    expect(groupEl.style.top).toBe("0px");
    expect(groupEl.style.width).toBe("800px");
    expect(groupEl.style.height).toBe("600px");
    // The transform origin stays at the center of the GROUP: rotating it has to
    // spin it around itself, not around the canvas center.
    expect(groupEl.style.transformOrigin).toBe("300px 350px");
  });

  it("does not swallow the clicks of the rest of the canvas", async () => {
    const engine = engineWith([
      layer("g1", { type: "group", width_px: 20, height_px: 20 }),
      layer("a", { style: { groupId: "g1" } }),
      layer("b", { style: { groupId: "g1" } }),
    ]);
    await engine.renderSlots();
    expect(el(engine, "g1").style.pointerEvents).toBe("none");
    // And it does not clip: it covers the whole canvas, so `overflow: hidden`
    // would cut off the shadow or the animation displacement of any child.
    expect(el(engine, "g1").style.overflow).toBe("visible");
  });

  it("hiding the group hides its children, without propagating anything by hand", async () => {
    // The proof that the tree works: `display: none` on the parent hides the
    // children, which carry NOTHING of their own, because they are inside it.
    const engine = engineWith([
      layer("g1", { type: "group", style: { isVisible: false } }),
      layer("a", { style: { groupId: "g1" } }),
      layer("b", { style: { groupId: "g1" } }),
    ]);
    await engine.renderSlots();

    expect(el(engine, "g1").style.display).toBe("none");
    expect(el(engine, "a").style.display).not.toBe("none");
    expect(el(engine, "g1").contains(el(engine, "a"))).toBe(true);
  });

  it("the children inherit the group's opacity through CSS", async () => {
    const engine = engineWith([
      layer("g1", { type: "group", style: { opacity: 40 } }),
      layer("a", { style: { groupId: "g1" } }),
      layer("b", { style: { groupId: "g1" } }),
    ]);
    await engine.renderSlots();

    expect(el(engine, "g1").dataset.oimOpacity).toBe("0.4");
    // The child does NOT carry the written opacity: it inherits it by being inside.
    expect(el(engine, "a").dataset.oimOpacity).toBe("1");
  });
});

describe("degrade without losing anything", () => {
  let hostEl: HTMLElement;
  let shadowRoot: ShadowRoot;

  const engineWith = (slots: any[]) => {
    const engine = new ImageEngine(hostEl);
    engine._overlay = document.createElement("div");
    shadowRoot.appendChild(engine._overlay);
    engine.metadata = { ...CANVAS, slots };
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

  it("a file BEFORE phase 3 is painted flat, as always", async () => {
    // No slot carries `style.groupId`. That is the case for all the .oim files
    // already published, and it has to look exactly as before: the two loose
    // layers, and the group WITHOUT an element.
    //
    // The group not appearing is not a new discard: `group` is not in
    // `isGeoLike`, so a group slot without text was already being discarded
    // before phase 3. Measured, and contrary to what the design's diagnosis
    // said: the group's dead weight was in the signed file, not in the DOM.
    const engine = engineWith([
      layer("g1", { type: "group" }),
      layer("a"),
      layer("b"),
    ]);
    await engine.renderSlots();

    const sueltos = engine._overlay!.querySelectorAll(":scope > [data-slot-id]");
    expect(Array.from(sueltos).map((e: any) => e.dataset.slotId)).toEqual(["a", "b"]);
  });

  it("a child whose group never arrived is left loose, it does not disappear", async () => {
    const engine = engineWith([layer("a", { style: { groupId: "g_perdido" } }), layer("b")]);
    await engine.renderSlots();

    expect(engine._overlay!.querySelectorAll("[data-slot-id]")).toHaveLength(2);
  });

  it("no layer is lost from the DOM in a mixed file", async () => {
    const slots = [
      layer("g1", { type: "group" }),
      layer("a", { style: { groupId: "g1" } }),
      layer("b", { style: { groupId: "g1" } }),
      layer("huerfano", { style: { groupId: "g_perdido" } }),
      layer("suelta"),
    ];
    const engine = engineWith(slots);
    await engine.renderSlots();

    const enElArbol = Array.from(engine._overlay!.querySelectorAll("[data-slot-id]"))
      .map((e: any) => e.dataset.slotId).sort();
    expect(enElArbol).toEqual(slots.map((s) => s.id).sort());
  });
});

describe("a partial repaint does not break the group", () => {
  // `renderSlots({onlyIds})` replaces in place the nodes that change —it is
  // used by the language switch— and keeps the animations and parallax of the rest.
  let hostEl: HTMLElement;
  let shadowRoot: ShadowRoot;

  const engineWith = (slots: any[]) => {
    const engine = new ImageEngine(hostEl);
    engine._overlay = document.createElement("div");
    shadowRoot.appendChild(engine._overlay);
    engine.metadata = { ...CANVAS, slots };
    return engine;
  };

  const el = (engine: any, id: string) =>
    engine._overlay!.querySelector('[data-slot-id="' + id + '"]') as HTMLElement;

  const escena = () => [
    layer("g1", { type: "group" }),
    layer("a", { style: { groupId: "g1" } }),
    layer("b", { style: { groupId: "g1" } }),
  ];

  beforeEach(() => {
    hostEl = document.createElement("div");
    document.body.appendChild(hostEl);
    shadowRoot = hostEl.attachShadow({ mode: "open" });
  });

  afterEach(() => {
    if (hostEl.parentNode) document.body.removeChild(hostEl);
  });

  it("repainting ONLY one child leaves it inside the group", async () => {
    const engine = engineWith(escena());
    await engine.renderSlots();
    await engine.renderSlots({ onlyIds: new Set(["a"]) });

    expect(el(engine, "a")).not.toBeNull();
    expect(el(engine, "g1").contains(el(engine, "a"))).toBe(true);
  });

  it("repainting the group AND a child at once does not lose the child", async () => {
    // It is the case that slipped past me when writing phase 3: nesting BEFORE
    // the substitution, `replaceChild` put the new child inside the group's OLD
    // element and then replaced that whole group. The child left with it, and
    // the layer disappeared from the canvas.
    const engine = engineWith(escena());
    await engine.renderSlots();
    await engine.renderSlots({ onlyIds: new Set(["g1", "a"]) });

    const enElArbol = Array.from(engine._overlay!.querySelectorAll("[data-slot-id]"))
      .map((e: any) => e.dataset.slotId).sort();
    expect(enElArbol).toEqual(["a", "b", "g1"]);
    expect(el(engine, "g1").contains(el(engine, "a"))).toBe(true);
    expect(el(engine, "g1").contains(el(engine, "b"))).toBe(true);
  });

  it("repainting the whole group keeps both children and their order", async () => {
    const engine = engineWith(escena());
    await engine.renderSlots();
    await engine.renderSlots({ onlyIds: new Set(["g1", "a", "b"]) });

    expect(Array.from(el(engine, "g1").querySelectorAll("[data-slot-id]"))
      .map((e: any) => e.dataset.slotId)).toEqual(["a", "b"]);
  });
});

describe("animating a layer that is inside a group", () => {
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

  it("the child keeps ITS animation and the group keeps ITS OWN: they are two elements", async () => {
    const engine = new ImageEngine(hostEl);
    engine._overlay = document.createElement("div");
    shadowRoot.appendChild(engine._overlay);
    engine.metadata = { ...CANVAS, slots: [
      layer("g1", { type: "group", style: { animation: conAnimacion() } }),
      layer("a", { style: { groupId: "g1", animation: conAnimacion() } }),
      layer("b", { style: { groupId: "g1" } }),
    ]};
    await engine.renderSlots();

    const groupEl = engine._overlay!.querySelector('[data-slot-id="g1"]') as HTMLElement;
    const childEl = engine._overlay!.querySelector('[data-slot-id="a"]') as HTMLElement;

    // The child is still inside, and it is still its own element: nobody has
    // merged its animation with the parent's or removed it. Both run, on nested
    // elements, and they COMPOSE.
    expect(groupEl.contains(childEl)).toBe(true);
    expect(childEl).not.toBe(groupEl);
  });
});

describe("what the wrapper unlocks (phase 4)", () => {
  // The design promised three things for phase 4 —animating a whole group, an
  // action that shows or hides it, and parallax over the set— and said that
  // none of them would need new hierarchy code. This checks it: all three come
  // out of the wrapper, without a single line that mentions `childIds`.
  let hostEl: HTMLElement;
  let shadowRoot: ShadowRoot;

  const engineWith = (slots: any[]) => {
    const engine = new ImageEngine(hostEl);
    engine._overlay = document.createElement("div");
    shadowRoot.appendChild(engine._overlay);
    engine.metadata = { ...CANVAS, slots };
    return engine;
  };

  const el = (engine: any, id: string) =>
    engine._overlay!.querySelector('[data-slot-id="' + id + '"]') as HTMLElement;

  /** `queueUpdate` batches DOM writes; this waits for them to be flushed. */
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

  it("an action that hides the group hides everything inside it", async () => {
    const engine = engineWith([
      layer("g1", { type: "group" }),
      layer("a", { style: { groupId: "g1" } }),
      layer("b", { style: { groupId: "g1" } }),
      layer("fuera"),
    ]);
    await engine.renderSlots();

    engine.disableAnimations = true;
    engine.executeToggleState({ hide_slots: ["g1"] });
    await alSiguienteCuadro();

    // `executeToggleState` still looks for ONE element by `data-slot-id` and
    // knows nothing about groups. The children disappear because they are
    // inside, without anyone walking `childIds`.
    expect(el(engine, "g1").style.display).toBe("none");
    expect(el(engine, "fuera").style.display).not.toBe("none");
    expect(el(engine, "g1").contains(el(engine, "a"))).toBe(true);
  });

  it("and showing it again brings back the whole group", async () => {
    const engine = engineWith([
      layer("g1", { type: "group" }),
      layer("a", { style: { groupId: "g1" } }),
      layer("b", { style: { groupId: "g1" } }),
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

  it("a group's parallax moves the wrapper, not an empty box", async () => {
    const engine = engineWith([
      layer("g1", { type: "group", style: { parallax: { enabled: true, depth: 0.5, axis: "both" } } }),
      layer("a", { style: { groupId: "g1" } }),
      layer("b", { style: { groupId: "g1" } }),
    ]);
    // Ruling (13 Nov): the pointer parallax is retired in 2.0; this pins the 1.x road.
    v2LayersOf((engine as any).metadata).clear();
    await engine.renderSlots();

    // The controller registers the slot's element, which in a group IS the
    // wrapper: moving it takes everything it contains along with it.
    expect(engine._parallaxController).not.toBeNull();
    expect(el(engine, "g1").contains(el(engine, "a"))).toBe(true);
    expect(el(engine, "g1").contains(el(engine, "b"))).toBe(true);
  });
});

describe("with a slot like the one the backend REALLY emits", () => {
  // This is the test that was missing, and its absence cost a whole failure.
  //
  // The backend ALWAYS emits `style.width` and `style.height` in cqw, and the
  // engine has a loop that dumps `style` onto the element. That loop ran AFTER
  // the wrapper block and overwrote its size: the wrapper kept the group's box
  // instead of the canvas, and its children came out at half size and out of
  // place.
  //
  // No test saw it, because all of them built the slot in the shape the code
  // expects —without `style.width`—, so the loop had nothing to overwrite.
  // It showed up when opening a .oim signed by production.
  let hostEl: HTMLElement;
  let shadowRoot: ShadowRoot;

  const engineWith = (slots: any[]) => {
    const engine = new ImageEngine(hostEl);
    engine._overlay = document.createElement("div");
    shadowRoot.appendChild(engine._overlay);
    engine.metadata = { ...CANVAS, slots };
    return engine;
  };

  const el = (engine: any, id: string) =>
    engine._overlay!.querySelector('[data-slot-id="' + id + '"]') as HTMLElement;

  /** A slot with the exact shape that comes out of `/v1/oim/compile`. */
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
      // The two fields that the backend adds to ALL slots.
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

  it("the file's `style.width` does NOT override the wrapper's size", async () => {
    const engine = engineWith([
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

  it("neutralizes the viewer's scale, which would otherwise be applied twice", async () => {
    // `--oim-scale` is set by the overlay and cascades to everything inside;
    // `.oim-slot` applies it on its own transform. The wrapper is an
    // `.oim-slot` that CONTAINS others, so its children received it twice and
    // came out at half size.
    //
    // This test checks the variable and not the measured width on purpose:
    // happy-dom does not compose transforms. The real size was checked in a
    // browser, opening the .oim with the CDN player.
    const engine = engineWith([
      comoDelBackend("g1", { type: "group" }),
      comoDelBackend("a", { style: { groupId: "g1" } }),
    ]);
    await engine.renderSlots();
    expect(el(engine, "g1").style.getPropertyValue("--oim-scale")).toBe("1");
  });

  it("and a loose layer DOES keep its own", async () => {
    // The wrapper is the exception, not the new rule.
    const engine = engineWith([comoDelBackend("suelta")]);
    await engine.renderSlots();
    expect(el(engine, "suelta").style.width).not.toBe("800px");
  });
});
