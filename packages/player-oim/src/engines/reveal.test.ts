/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Contract 1.22.0: a layer shown or hidden by an action enters and leaves the
// way its own `reveal` says, through the same frames the editor previews.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ImageEngine from "./ImageEngine";
import { revealFrames } from "../../../core/src/reveal.js";

type Fake = { frames: any; opts: any; cancel: any; pause: any; play: any; finish: () => void; onfinish: null | (() => void) };
let calls: Fake[] = [];
const realAnimate = (Element.prototype as any).animate;

beforeEach(() => {
  calls = [];
  (Element.prototype as any).animate = function (frames: any, opts: any) {
    const f: Fake = { frames, opts, cancel: vi.fn(), pause: vi.fn(), play: vi.fn(), onfinish: null, finish: () => f.onfinish?.() };
    calls.push(f);
    return f;
  };
});
afterEach(() => { (Element.prototype as any).animate = realAnimate; });

const tick = () => new Promise((r) => setTimeout(r, 40));

async function render(slots: any[], disableAnimations = false) {
  const host = document.createElement("div");
  host.setAttribute("mode", "full");
  if (disableAnimations) host.setAttribute("disable-animations", "true");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const motor: any = new ImageEngine(host as any);
  motor._viewport = document.createElement("div");
  shadow.appendChild(motor._viewport);
  motor._overlay = document.createElement("div");
  motor._viewport.appendChild(motor._overlay);
  motor.metadata = { slots, width: 800, height: 600 };
  await motor.renderSlots();
  calls = []; // load-time animations are not the subject here
  const get = (id: string) => shadow.querySelector(`[data-slot-id="${id}"]`) as HTMLElement;
  return { motor, get };
}

const geo = (id: string, style: any = {}) => ({
  id, type: "geo", position: [10, 10], style: { width: "20cqw", height: "10cqw", fillColor: "#000", ...style },
});

describe("reveal on show/hide", () => {
  it("uses the layer's reveal", async () => {
    const { motor, get } = await render([geo("panel", { reveal: { effect: "slide-up", duration: 400, easing: "ease-in" } })]);
    motor._showSlotElement(get("panel"));
    await tick();
    expect(calls).toHaveLength(1);
    expect(calls[0].frames).toEqual(revealFrames("slide-up", true));
    expect(calls[0].opts).toEqual({ duration: 400, easing: "ease-in", fill: "both" });
  });

  it("no reveal keeps today's fade", async () => {
    const { motor, get } = await render([geo("panel")]);
    motor._showSlotElement(get("panel"));
    await tick();
    expect(calls[0].frames).toEqual([{ opacity: 0 }, { opacity: 1 }]);
    expect(calls[0].opts).toMatchObject({ duration: 300, easing: "ease" });
  });

  it("never writes transform", async () => {
    const { motor, get } = await render([geo("panel", { reveal: { effect: "scale", duration: 200 } })]);
    const el = get("panel");
    const before = el.style.transform;
    motor._showSlotElement(el);
    await tick();
    expect(el.style.transform).toBe(before);
  });

  it("a rapid toggle cancels the reveal in flight", async () => {
    const { motor, get } = await render([geo("panel")]);
    const el = get("panel");
    motor._showSlotElement(el); await tick();
    motor._hideSlotElement(el); await tick();
    motor._showSlotElement(el); await tick();
    expect(calls).toHaveLength(3);
    expect(calls[0].cancel).toHaveBeenCalled();
    expect(calls[1].cancel).toHaveBeenCalled();
    expect(el.style.display).toBe("flex");
  });

  it("hides only when the hide finishes", async () => {
    const { motor, get } = await render([geo("panel")]);
    const el = get("panel");
    motor._hideSlotElement(el); await tick();
    expect(el.style.display).not.toBe("none");
    calls[0].finish(); await tick();
    expect(el.style.display).toBe("none");
  });

  it("a reveal started while paused is born paused, and play() resumes it", async () => {
    const { motor, get } = await render([geo("panel")]);
    motor.pause();
    motor._showSlotElement(get("panel")); await tick();
    expect(calls[0].pause).toHaveBeenCalled();
    motor.play();
    expect(calls[0].play).toHaveBeenCalled();
  });

  it("disable-animations shows instantly", async () => {
    const { motor, get } = await render([geo("panel")], true);
    const el = get("panel");
    motor._showSlotElement(el); await tick();
    expect(calls).toHaveLength(0);
    expect(el.style.display).toBe("flex");
    expect(el.style.opacity).toBe("1");
  });

  it("a retoggle starts from where the slide was, not from rest", async () => {
    const { motor, get } = await render([geo("panel", { reveal: { effect: "slide-up", duration: 400 } })]);
    const el = get("panel");
    motor._showSlotElement(el); await tick();
    const spy = vi.spyOn(window, "getComputedStyle").mockReturnValue({ opacity: "0.5", translate: "0px 20px", scale: "none" } as any);
    motor._hideSlotElement(el); await tick();
    spy.mockRestore();
    expect(calls[1].frames[0]).toMatchObject({ opacity: "0.5", translate: "0px 20px" });
  });
});
