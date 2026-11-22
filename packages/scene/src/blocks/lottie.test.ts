/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: Array<Record<string, unknown>> = [];
const anim = { play: vi.fn(), pause: vi.fn(), destroy: vi.fn(), goToAndStop: vi.fn(), totalFrames: 90 };
vi.mock("../runtime/lottie-loader.js", () => ({
  loadLottie: () => Promise.resolve({ loadAnimation: (o: Record<string, unknown>) => (calls.push(o), anim) }),
}));

import { mount } from "../index.js";
import { lottieData } from "./lottie.js";

const DOT = { v: "5.7.0", fr: 30, ip: 0, op: 30, w: 100, h: 100, layers: [] as unknown[] };
const doc = (src: string, loop?: boolean) => ({
  oim: "2.0.0-draft.1",
  canvas: { width: 100, height: 100 },
  languages: ["es"],
  layers: [{ id: "l", type: "lottie", box: { x: 0, y: 0, width: 100, height: 100 }, lottie: { src, ...(loop === undefined ? {} : { loop }) } }],
}) as never;
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("lottieData", () => {
  it("reads inline JSON and JSON data URLs, never a URL", () => {
    expect(lottieData(JSON.stringify(DOT))).toEqual(DOT);
    expect(lottieData("data:application/json;base64," + btoa(JSON.stringify(DOT)))).toEqual(DOT);
    expect(lottieData("https://example.com/a.json")).toBeUndefined();
    expect(lottieData("{not json")).toBeUndefined();
    expect(lottieData(JSON.stringify({ v: "5" }))).toBeUndefined();
  });
});

describe("lottie layer", () => {
  beforeEach(() => {
    calls.length = 0;
    vi.clearAllMocks();
  });

  it("is not played unless the host allows it", async () => {
    const host = document.createElement("div");
    mount(host, doc(JSON.stringify(DOT)));
    await flush();
    expect(calls).toHaveLength(0);
    expect(host.querySelector(".oim-lottie")).toBeNull();
  });

  it("plays with the light library, loops by default, and follows pause, play and destroy", async () => {
    const host = document.createElement("div");
    const scene = mount(host, doc(JSON.stringify(DOT)), { allowLottie: true });
    await flush();
    expect(calls[0]).toMatchObject({ renderer: "svg", loop: true, autoplay: true, animationData: DOT });
    expect(calls[0].container).toBe(host.querySelector(".oim-lottie"));
    scene.pause();
    expect(anim.pause).toHaveBeenCalled();
    scene.play();
    expect(anim.play).toHaveBeenCalled();
    scene.destroy();
    expect(anim.destroy).toHaveBeenCalled();
  });

  // Same rest as the editor and the static export (OIM-Studio lottie-frame.ts): frame 0 is
  // empty in most Lotties (Success.json is at scale 0 there), the middle one is full.
  it("a paused scene shows the middle frame, and loop: false plays once", async () => {
    const host = document.createElement("div");
    mount(host, doc(JSON.stringify(DOT), false), { allowLottie: true, paused: true });
    await flush();
    expect(calls[0]).toMatchObject({ loop: false, autoplay: false });
    expect(anim.goToAndStop).toHaveBeenCalledWith(44, true);
  });
});
