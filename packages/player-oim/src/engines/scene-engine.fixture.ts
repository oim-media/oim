/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import ImageEngine from "./ImageEngine";

/** A 2.0 document with these layers, 1000×500, in Spanish and English. */
export const doc2 = (layers: object[], extra: object = {}) =>
  ({ oim: "2.0.0-draft.1", canvas: { width: 1000, height: 500 }, languages: ["es", "en"], layers, ...extra });

export const shape2 = (id: string, extra: object = {}) =>
  ({ id, type: "shape", box: { x: 0, y: 0, width: 100, height: 100 }, geometry: { kind: "rect" }, ...extra });

export const text2 = (id: string, content: Record<string, string>, extra: object = {}) =>
  ({ id, type: "text", box: { x: 0, y: 0 }, text: { content }, ...extra });

/**
 * An engine mounted on a host with its shell (viewport, overlay) and the file painted:
 * what `load` leaves after verifying, without the download and the signature.
 */
export async function paintedEngine(file: object, attrs: Record<string, string> = {}) {
  const host = document.createElement("div");
  for (const [k, v] of Object.entries(attrs)) host.setAttribute(k, v);
  const shadow = host.attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const engine: any = new ImageEngine(host as any);
  engine._viewport = document.createElement("div");
  shadow.appendChild(engine._viewport);
  engine._overlay = document.createElement("div");
  engine._viewport.appendChild(engine._overlay);
  engine.fileMetadata = file;
  engine.metadata = file;
  await engine.renderSlots();
  const el = (id: string) => engine._overlay.querySelector(`[data-oim-id="${id}"]`) as HTMLElement | null;
  return { host, engine, el };
}
