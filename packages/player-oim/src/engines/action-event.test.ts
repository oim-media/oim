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

import { describe, it, expect } from "vitest";
import { doc2, paintedEngine, shape2 } from "./scene-engine.fixture";

const HIDE = [{ type: "hide", target: "ficha" }];

async function scenario(interactions: object[], extra: object = {}, attrs: Record<string, string> = { mode: "full", "disable-animations": "true" }) {
  const { host, el } = await paintedEngine(doc2([shape2("boton", { interactions, ...extra }), shape2("ficha")]), attrs);
  const heard: CustomEvent[] = [];
  host.addEventListener("oim:action", (e) => heard.push(e as CustomEvent));
  return { host, heard, button: el("boton")!, ficha: el("ficha")! };
}

describe("the player announces what it did", () => {
  it("a click emits oim:action, with the layer and its targets", async () => {
    const e = await scenario([{ on: "press", actions: HIDE }]);
    e.button.click();
    expect(e.heard.length).toBe(1);
    expect(e.heard[0].detail).toMatchObject({ slot: "boton", trigger: "click", targets: ["ficha"], types: ["hide"] });
  });

  it("hover also announces, and is told apart from the click", async () => {
    const e = await scenario([{ on: "hover", actions: HIDE }]);
    e.button.dispatchEvent(new Event("pointerenter"));
    expect(e.heard.length).toBe(1);
    expect(e.heard[0].detail.trigger).toBe("hover");
  });

  it("and carries nothing but the file's own identifiers", async () => {
    const e = await scenario([{ on: "press", actions: HIDE }]);
    e.button.click();
    expect(Object.keys(e.heard[0].detail).sort()).toEqual(["name", "slot", "targets", "trigger", "types"]);
  });
});

describe("the announcement can be listened to by name", () => {
  it("carries the name the author gave it, and the id", async () => {
    const e = await scenario([{ on: "press", actions: HIDE }], { name: "Boton1" });
    e.button.click();
    expect(e.heard[0].detail).toMatchObject({ name: "Boton1", slot: "boton" });
  });

  it("a layer without a name does not invent one", async () => {
    const e = await scenario([{ on: "press", actions: HIDE }]);
    e.button.click();
    expect(e.heard[0].detail.name).toBeUndefined();
  });
});

describe("an interactive layer without actions", () => {
  it("announces anyway, with empty targets, and touches nothing", async () => {
    const e = await scenario([{ on: "press", actions: [] }], { name: "Comprar" });
    e.button.click();
    expect(e.heard.length).toBe(1);
    expect(e.heard[0].detail).toMatchObject({ name: "Comprar", targets: [], types: [] });
    expect(e.ficha.style.display).not.toBe("none");
  });
});

describe("the page can veto the local effect", () => {
  it("the event is truly cancelable, and preventDefault leaves the layer as it was", async () => {
    const e = await scenario([{ on: "press", actions: HIDE }]);
    e.host.addEventListener("oim:action", (ev) => ev.preventDefault());
    e.button.click();
    expect(e.heard[0].cancelable).toBe(true);
    expect(e.ficha.style.display).not.toBe("none");
  });

  it("and without vetoing it, the layer does change", async () => {
    const e = await scenario([{ on: "press", actions: HIDE }]);
    e.button.click();
    expect(e.ficha.style.display).toBe("none");
  });
});

describe("does not bother whoever is not listening", () => {
  it("in image mode there is no click, so there is no oim:action", async () => {
    const e = await scenario([{ on: "press", actions: HIDE }], {}, { mode: "image" });
    e.button.click();
    expect(e.heard.length).toBe(0);
    expect(e.ficha.style.display).not.toBe("none");
  });
});
