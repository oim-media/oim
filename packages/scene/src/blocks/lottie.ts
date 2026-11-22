/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { loadLottie } from "../runtime/lottie-loader.js";

export type LottieRun = { play(): void; pause(): void; destroy(): void };

/**
 * The animation a lottie layer carries, parsed; undefined for anything else.
 * Only inline JSON (or a JSON data URL): a file never makes the player fetch a URL.
 */
export function lottieData(src: string | undefined): object | undefined {
  if (!src) return undefined;
  let text = src.trim();
  const dataUrl = /^data:application\/json(;base64)?,/i.exec(text);
  if (dataUrl) {
    const body = text.slice(dataUrl[0].length);
    try {
      text = dataUrl[1] ? atob(body) : decodeURIComponent(body);
    } catch {
      return undefined;
    }
  }
  if (!text.startsWith("{")) return undefined;
  try {
    const data = JSON.parse(text);
    return data && typeof data === "object" && Array.isArray(data.layers) ? data : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Plays a lottie layer inside `el` with lottie_light (no expressions, no eval).
 * The library loads late, so the run reads `paused()` when it starts; a paused
 * scene rests on the middle frame, like the editor and the static export: frame 0
 * is empty in most Lotties (they build from nothing), the middle one is full.
 */
export function playLottie(el: HTMLElement, data: object, opts: { loop: boolean; paused: () => boolean }): LottieRun {
  const box = el.ownerDocument.createElement("div");
  box.className = "oim-lottie";
  Object.assign(box.style, { position: "absolute", inset: "0" });
  el.appendChild(box);
  let anim: { play(): void; pause(): void; destroy(): void; goToAndStop(f: number, isFrame: boolean): void; totalFrames: number } | undefined;
  let gone = false;
  loadLottie()
    .then((lottie) => {
      if (gone) return;
      anim = lottie.loadAnimation({ container: box, renderer: "svg", loop: opts.loop, autoplay: !opts.paused(), animationData: data });
      if (opts.paused()) anim!.goToAndStop(Math.max(0, Math.floor((anim!.totalFrames - 1) / 2)) || 0, true);
    })
    .catch(() => {
      box.remove();
    });
  return {
    play: () => anim?.play(),
    pause: () => anim?.pause(),
    destroy: () => {
      gone = true;
      anim?.destroy();
      box.remove();
    },
  };
}
