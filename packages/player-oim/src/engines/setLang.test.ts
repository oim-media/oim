/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { doc2, paintedEngine, shape2, text2 } from "./scene-engine.fixture";

const file = () => doc2([text2("t", { es: "Hola", en: "Hello" }), shape2("s")]);

describe("setLang", () => {
  it("the words change in place: the same nodes, no new scene", async () => {
    const { engine, el } = await paintedEngine(file(), { lang: "es" });
    const text = el("t")!, shape = el("s")!, scene = engine._scene;
    engine.setLang("en");
    expect(el("t")).toBe(text);
    expect(el("s")).toBe(shape);
    expect(engine._scene).toBe(scene);
    expect(text.textContent).toBe("Hello");
  });

  it("emits oim:langchange once, and nothing for the same language", async () => {
    const { engine, host } = await paintedEngine(file(), { lang: "es" });
    const heard: string[] = [];
    host.addEventListener("oim:langchange", (e) => heard.push((e as CustomEvent).detail.lang));
    engine.setLang("en");
    engine.setLang("en");
    expect(heard).toEqual(["en"]);
    expect(host.getAttribute("lang")).toBe("en");
  });
});
