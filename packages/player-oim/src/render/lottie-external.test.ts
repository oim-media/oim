/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createExternalLottieLoader, vendorUrl } from "./lottie-external";

const fakeLottie = { loadAnimation: () => ({}) };
const scripts = () => Array.from(document.querySelectorAll("script[data-oim-lottie]")) as HTMLScriptElement[];

describe("cargador externo de lottie", () => {
  beforeEach(() => {
    const origCreateElement = document.createElement.bind(document);
    document.createElement = function (tagName: string, options?: ElementCreationOptions) {
      const el = origCreateElement(tagName, options);
      if (tagName.toLowerCase() === "script") {
        const sym = Object.getOwnPropertySymbols(el).find(s => s.description === "disableEvaluation");
        if (sym) (el as any)[sym] = true;
      }
      return el;
    };
    document.head.innerHTML = "";
    delete (globalThis as any).lottie;
  });

  it("resolves the file next to the player script, on both public paths", () => {
    expect(vendorUrl("https://cdn.oim.media/oim-player.js", "5.13.0"))
      .toBe("https://cdn.oim.media/vendor/lottie_light-5.13.0.js");
    expect(vendorUrl("https://cdn.oim.media/player/v1/oim-player.js?cb=1", "5.13.0"))
      .toBe("https://cdn.oim.media/player/v1/vendor/lottie_light-5.13.0.js");
  });

  it("without the script URL it uses the CDN's", () => {
    expect(vendorUrl(null, "5.13.0")).toBe("https://cdn.oim.media/player/v1/vendor/lottie_light-5.13.0.js");
  });

  it("five requests insert a single script and all of them receive lottie", async () => {
    const load = createExternalLottieLoader({ scriptUrl: "https://cdn.oim.media/oim-player.js", version: "5.13.0" });
    const all = Promise.all([1, 2, 3, 4, 5].map(() => load()));
    expect(scripts()).toHaveLength(1);
    (globalThis as any).lottie = fakeLottie;
    scripts()[0].onload!(new Event("load"));
    for (const l of await all) expect(l).toBe(fakeLottie);
  });

  it("if there is already a lottie on the page it inserts nothing", async () => {
    (globalThis as any).lottie = fakeLottie;
    const load = createExternalLottieLoader({ scriptUrl: null, version: "5.13.0" });
    expect(await load()).toBe(fakeLottie);
    expect(scripts()).toHaveLength(0);
  });

  it("if the load fails it rejects with the URL, removes the script and the next time it retries", async () => {
    const load = createExternalLottieLoader({ scriptUrl: "https://cdn.oim.media/oim-player.js", version: "5.13.0" });
    const first = load();
    scripts()[0].onerror!(new Event("error"));
    await expect(first).rejects.toThrow("https://cdn.oim.media/vendor/lottie_light-5.13.0.js");
    expect(scripts()).toHaveLength(0);
    const second = load();
    expect(scripts()).toHaveLength(1);
    (globalThis as any).lottie = fakeLottie;
    scripts()[0].onload!(new Event("load"));
    expect(await second).toBe(fakeLottie);
  });

  it("if the script loads but does not define lottie, it rejects instead of hanging", async () => {
    const load = createExternalLottieLoader({ scriptUrl: null, version: "5.13.0" });
    const p = load();
    scripts()[0].onload!(new Event("load"));
    await expect(p).rejects.toThrow("lottie");
  });
});
