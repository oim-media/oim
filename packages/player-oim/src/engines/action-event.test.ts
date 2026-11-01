/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `oim:action`: the player REPORTS what it did; it does not do what it is told.
 *
 * There are three ways a click can leave the file:
 *
 *   1. the file declares a URL and the player navigates  -> the FILE decides
 *   2. the file carries code and the player runs it     -> never
 *   3. the player announces what happened and the page decides -> the PAGE decides
 *
 * This is the third, and the only one that respects the consent of whoever
 * embeds it. The file cannot TRIGGER anything: it can only SAY something, and
 * only if the page bothers to listen. There is no handler declared in the .oim,
 * no `href`, no destination.
 *
 * It is not decoration: it is what makes navigation by the player UNNECESSARY.
 * If a page wants a click to lead to a product, it listens and navigates itself,
 * with its own URL and rules. Without this event the pressure to implement `link`
 * in the player never goes away, because the integrator needs something.
 *
 * The detail carries ONLY identifiers that the author put in the file. No
 * URLs -the image rule applies here too- and no free-form data: it is not an
 * outward channel, it is the same document speaking about itself.
 */

import { describe, it, expect, vi } from "vitest";
import ImageEngine from "./ImageEngine";

function mount(slots: any[]) {
  const host = document.createElement("div");
  host.setAttribute("mode", "full");
  // Without animations, show/hide is INSTANT and can be observed. With them, a
  // slot is born at `opacity: 0` waiting for a `requestAnimationFrame` that
  // happy-dom never delivers, so "0" was already the value before the click and
  // comparing opacities distinguished nothing: the two veto tests passed
  // vacuously.
  //
  // It also checks that the two axes are independent: actions enabled by the
  // mode, motion disabled by the attribute.
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

const box = (id: string, extra: any = {}) => ({
  id, type: "text", align: "center", position: [10, 10],
  content: { es: id.toUpperCase() },
  style: { width: "32.5cqw", height: "8.75cqw", fontSize: "2.75cqw", ...extra },
});

// `hide` and not `toggle`: hiding leaves `display: none`, which normal painting
// never produces. With `toggle` the result depended on the starting state and
// matched what the render itself leaves queued -comparing there does not tell
// the effect of the action apart from the effect of painting.
const ACCIONES = [{ target: "ficha", type: "hide" }];

async function escenario(states: any, extra: any = {}) {
  const { host, motor } = mount([
    { ...box("boton", { isInteractive: true, states: states }), ...extra },
    box("ficha"),
  ]);
  await motor.renderSlots();
  const sr = host.shadowRoot!;
  const avisos: any[] = [];
  host.addEventListener("oim:action", (e: any) => avisos.push(e));
  return {
    host, avisos,
    // `queueUpdate` queues and applies on the next frame. happy-dom does not
    // produce frames, so without this the queue never drains and the DOM stays
    // as it was: comparing styles there distinguishes nothing.
    vaciar: () => motor._flushDOMUpdates(),
    buttonItem: sr.querySelector('[data-slot-id="boton"]') as HTMLElement,
    ficha: sr.querySelector('[data-slot-id="ficha"]') as HTMLElement,
  };
}

describe("the player announces what it did", () => {
  it("a click emits oim:action", async () => {
    const e = await escenario({ active: { actions: ACCIONES } });
    e.buttonItem.dispatchEvent(new Event("click"));
    expect(e.avisos.length).toBe(1);
    expect(e.avisos[0].detail.slot).toBe("boton");
    expect(e.avisos[0].detail.trigger).toBe("click");
  });

  it("and says which layers it affects", async () => {
    const e = await escenario({ active: { actions: ACCIONES } });
    e.buttonItem.dispatchEvent(new Event("click"));
    expect(e.avisos[0].detail.targets).toEqual(["ficha"]);
  });

  it("hover also announces, and is told apart from the click", async () => {
    const e = await escenario({ hover: { actions: ACCIONES } });
    e.buttonItem.dispatchEvent(new Event("mouseenter"));
    expect(e.avisos.length).toBe(1);
    expect(e.avisos[0].detail.trigger).toBe("hover");
  });

  /**
   * The guard on the detail. Without it, anyone could sneak in a field tomorrow
   * with a URL or with the file's content, and the event would stop being "the
   * document speaking about itself" and become a channel.
   */
  it("and carries nothing but the file's own identifiers", async () => {
    const e = await escenario({ active: { actions: ACCIONES } });
    e.buttonItem.dispatchEvent(new Event("click"));
    expect(Object.keys(e.avisos[0].detail).sort()).toEqual(["name", "slot", "targets", "trigger", "types"]);
  });
});

/**
 * Listen by NAME, the only thing a human can type.
 *
 * The id is invented by the editor at random -`shape_text_k3j9x2m1p`, from
 * `Math.random().toString(36)`-, so not even the author can write
 * `if (e.detail.slot === "Boton1")`. They would have to open the file to copy a
 * random string, which is exactly the chore this event is meant to avoid.
 *
 * `name` is what the author types and sees in their layer list, and it is carried
 * in the file. The `id` stays as the stable key -the actions' `targets` use it-
 * and the name is the readable one.
 *
 * Names are NOT unique: two layers can share a name and both will emit. It is the
 * listener's responsibility, and that is why the id is still sent.
 */
describe("the announcement can be listened to by name", () => {
  it("carries the name the author gave it", async () => {
    const e = await escenario({ active: { actions: ACCIONES } }, { name: "Boton1" });
    e.buttonItem.dispatchEvent(new Event("click"));
    expect(e.avisos[0].detail.name).toBe("Boton1");
  });

  it("and still carries the id, which is the stable key", async () => {
    const e = await escenario({ active: { actions: ACCIONES } }, { name: "Boton1" });
    e.buttonItem.dispatchEvent(new Event("click"));
    expect(e.avisos[0].detail.slot).toBe("boton");
  });

  /** A layer without a name does not invent one: it is omitted and the id remains. */
  it("a layer without a name does not invent one", async () => {
    const e = await escenario({ active: { actions: ACCIONES } });
    e.buttonItem.dispatchEvent(new Event("click"));
    expect(e.avisos[0].detail.name).toBeUndefined();
  });
});

/**
 * An interactive layer WITHOUT actions also announces itself.
 *
 * The case that calls for it: a button the author places on their own website so
 * that the PAGE navigates. It wants no local effect -it wants to be told about
 * the click. Without this it would have to declare a fake action, a show/hide
 * that does nothing, just so the event exists.
 *
 * No new check is needed: `bindStates` is only called when the slot is ALREADY
 * interactive (`ImageEngine.ts:2096`), so the actions condition was redundant.
 * The announcement goes out with empty `targets` and `types`.
 */
describe("an interactive layer without actions", () => {
  it("announces anyway, with empty targets", async () => {
    const e = await escenario({ hover: { scale: 1.1 } }, { name: "Comprar" });
    e.buttonItem.dispatchEvent(new Event("click"));
    expect(e.avisos.length).toBe(1);
    expect(e.avisos[0].detail.name).toBe("Comprar");
    expect(e.avisos[0].detail.targets).toEqual([]);
    expect(e.avisos[0].detail.types).toEqual([]);
  });

  it("and does not touch any layer, which is what was expected", async () => {
    const e = await escenario({ hover: { scale: 1.1 } });
    e.buttonItem.dispatchEvent(new Event("click"));
    e.vaciar();
    expect(e.ficha.style.display).not.toBe("none");
  });
});

describe("the page can veto the local effect", () => {
  /**
   * `cancelable`. With this a gallery can decide click by click without even
   * needing `mode="image"`: it listens, vetoes, and does its own thing.
   */
  it("preventDefault leaves the layer as it was", async () => {
    const e = await escenario({ active: { actions: ACCIONES } });
    e.host.addEventListener("oim:action", (ev: any) => ev.preventDefault());
    e.buttonItem.dispatchEvent(new Event("click"));
    e.vaciar();
    expect(e.ficha.style.display).not.toBe("none");
  });

  it("and without vetoing it, the layer does change", async () => {
    const e = await escenario({ active: { actions: ACCIONES } });
    e.buttonItem.dispatchEvent(new Event("click"));
    e.vaciar();
    expect(e.ficha.style.display).toBe("none");
  });

  it("el evento es cancelable de verdad", async () => {
    const e = await escenario({ active: { actions: ACCIONES } });
    e.buttonItem.dispatchEvent(new Event("click"));
    expect(e.avisos[0].cancelable).toBe(true);
  });
});

describe("no molesta a quien no escucha", () => {
  it("without listeners, the click still works", async () => {
    const { host, motor } = mount([
      box("boton", { isInteractive: true, states: { active: { actions: ACCIONES } } }),
      box("ficha"),
    ]);
    await motor.renderSlots();
    const sr = host.shadowRoot!;
    const buttonItem = sr.querySelector('[data-slot-id="boton"]') as HTMLElement;
    expect(() => buttonItem.dispatchEvent(new Event("click"))).not.toThrow();
    motor._flushDOMUpdates();
    expect((sr.querySelector('[data-slot-id="ficha"]') as HTMLElement).style.display).toBe("none");
  });

  it("and in image mode there is no click, so there is no actionEvent", async () => {
    const host = document.createElement("div");
    host.setAttribute("mode", "image");
    const shadow = (host as any).attachShadow({ mode: "open" });
    document.body.appendChild(host);
    const motor: any = new ImageEngine(host as any);
    motor._viewport = document.createElement("div"); shadow.appendChild(motor._viewport);
    motor._overlay = document.createElement("div"); motor._viewport.appendChild(motor._overlay);
    motor.metadata = { slots: [box("boton", { isInteractive: true, states: { active: { actions: ACCIONES } } })], width: 800, height: 600 };
    await motor.renderSlots();
    const avisos = vi.fn();
    host.addEventListener("oim:action", avisos);
    (shadow.querySelector('[data-slot-id="boton"]') as HTMLElement).dispatchEvent(new Event("click"));
    expect(avisos).not.toHaveBeenCalled();
  });
});
