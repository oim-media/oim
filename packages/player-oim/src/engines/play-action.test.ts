/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Contract 1.22.0: an animation can wait for an action (`trigger: "action"`)
// and the `play` action runs a layer's timeline from the start.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ImageEngine from "./ImageEngine";

type Fake = { el: Element; frames: any; opts: any; currentTime: number; cancel: any; pause: any; play: any; finish: any; onfinish: any };
let calls: Fake[] = [];
const realAnimate = (Element.prototype as any).animate;

beforeEach(() => {
  calls = [];
  (Element.prototype as any).animate = function (frames: any, opts: any) {
    const f: Fake = { el: this, frames, opts, currentTime: -1, cancel: vi.fn(), pause: vi.fn(), play: vi.fn(), finish: vi.fn(), onfinish: null };
    calls.push(f);
    return f;
  };
});
afterEach(() => { (Element.prototype as any).animate = realAnimate; vi.restoreAllMocks(); });

const KF = [{ t: 0, o: 0 }, { t: 1, o: 1 }];
const icon = (animation: any) => ({
  id: "icon", type: "geo", position: [10, 10],
  style: { width: "10cqw", height: "10cqw", fillColor: "#000", animation },
});
const button = (states: any) => ({
  id: "btn", type: "geo", position: [50, 50],
  style: { width: "10cqw", height: "10cqw", fillColor: "#fff", isInteractive: true, states },
});

async function render(slots: any[]) {
  const host = document.createElement("div");
  host.setAttribute("mode", "full");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const motor: any = new ImageEngine(host as any);
  motor._viewport = document.createElement("div");
  shadow.appendChild(motor._viewport);
  motor._overlay = document.createElement("div");
  motor._viewport.appendChild(motor._overlay);
  motor.metadata = { slots, width: 800, height: 600 };
  await motor.renderSlots();
  const get = (id: string) => shadow.querySelector(`[data-slot-id="${id}"]`) as HTMLElement;
  const timeline = () => calls.find((c) => get("icon").contains(c.el) && c.opts && "iterations" in c.opts)!;
  return { motor, get, timeline };
}

describe("animation.trigger", () => {
  it("action: runs once and rests at the first keyframe", async () => {
    const { timeline } = await render([icon({ keyframes: KF, duration: 2, trigger: "action" })]);
    const t = timeline();
    expect(t.opts).toMatchObject({ iterations: 1, fill: "both", easing: "linear", duration: 2000 });
    expect(t.pause).toHaveBeenCalled();
    expect(t.currentTime).toBe(0);
  });

  it("absent: keeps looping", async () => {
    const { timeline } = await render([icon({ keyframes: KF, duration: 2 })]);
    expect(timeline().opts.iterations).toBe(Infinity);
    expect(timeline().pause).not.toHaveBeenCalled();
  });
});

describe("the play action", () => {
  it("restarts the target's timeline, every click", async () => {
    const { get, timeline } = await render([
      icon({ keyframes: KF, duration: 2, trigger: "action" }),
      button({ active: { actions: [{ target: "icon", type: "play" }] } }),
    ]);
    const t = timeline();
    for (const n of [1, 2]) {
      t.currentTime = 1234;
      get("btn").dispatchEvent(new Event("click"));
      expect(t.currentTime).toBe(0);
      expect(t.play).toHaveBeenCalledTimes(n);
    }
  });

  it("on a looping layer it stays looping", async () => {
    const { get, timeline } = await render([
      icon({ keyframes: KF, duration: 2 }),
      button({ active: { actions: [{ target: "icon", type: "play" }] } }),
    ]);
    get("btn").dispatchEvent(new Event("click"));
    expect(timeline().opts.iterations).toBe(Infinity);
    expect(timeline().currentTime).toBe(0);
  });

  it("leaving a hover does not revert it, nor show or hide anything", async () => {
    const { motor, get, timeline } = await render([
      icon({ keyframes: KF, duration: 2, trigger: "action" }),
      button({ hover: { actions: [{ target: "icon", type: "play" }] } }),
    ]);
    const show = vi.spyOn(motor, "_showSlotElement");
    const hide = vi.spyOn(motor, "_hideSlotElement");
    const t = timeline();
    const pausesBefore = t.pause.mock.calls.length;
    get("btn").dispatchEvent(new Event("mouseenter"));
    get("btn").dispatchEvent(new Event("mouseleave"));
    expect(t.pause.mock.calls.length).toBe(pausesBefore);
    expect(t.cancel).not.toHaveBeenCalled();
    expect(show).not.toHaveBeenCalled();
    expect(hide).not.toHaveBeenCalled();
  });

  it("on a layer without keyframes it warns once and does nothing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { get } = await render([
      { id: "icon", type: "geo", position: [10, 10], style: { width: "10cqw", height: "10cqw", fillColor: "#000" } },
      button({ active: { actions: [{ target: "icon", type: "play" }] } }),
    ]);
    get("btn").dispatchEvent(new Event("click"));
    get("btn").dispatchEvent(new Event("click"));
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("while the player is paused, it rewinds but stays paused", async () => {
    const { motor, get, timeline } = await render([
      icon({ keyframes: KF, duration: 2, trigger: "action" }),
      button({ active: { actions: [{ target: "icon", type: "play" }] } }),
    ]);
    motor.pause();
    get("btn").dispatchEvent(new Event("click"));
    expect(timeline().currentTime).toBe(0);
    expect(timeline().play).not.toHaveBeenCalled();
  });

  it("with animations off (reduced motion) it does nothing, silently", async () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as any);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { get } = await render([
      icon({ keyframes: KF, duration: 2, trigger: "action" }),
      button({ active: { actions: [{ target: "icon", type: "play" }] } }),
    ]);
    get("btn").dispatchEvent(new Event("click"));
    expect(calls.filter((c) => c.opts && "iterations" in c.opts)).toHaveLength(0);
    expect(warn).not.toHaveBeenCalled();
  });
});
