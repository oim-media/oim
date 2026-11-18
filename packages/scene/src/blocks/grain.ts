/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Relative, like the player's other shared modules: "@oim-media/core" pulls in the whole index and zod.
import { buildLayerGrainFilter, type LayerGrainOptions } from "../../../core/src/generative/proceduralNoise.js";

const SVG = "http://www.w3.org/2000/svg";

/** The scene's own hidden `<defs>`, made on first use: the filters its layers point at live here. */
export function defsOf(host: Element): Element {
  const found = host.querySelector(":scope > svg.oim-grain-defs > defs");
  if (found) return found;
  const doc = host.ownerDocument;
  const svg = doc.createElementNS(SVG, "svg");
  svg.setAttribute("class", "oim-grain-defs");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("style", "position:absolute;pointer-events:none");
  const defs = doc.createElementNS(SVG, "defs");
  svg.appendChild(defs);
  host.appendChild(svg);
  return defs;
}

/**
 * Puts the core's grain filter for one layer into `host`'s own defs, replacing an
 * earlier one with the same id. Parsed as SVG, never assigned as HTML: the markup
 * is built from a sanitised id, clamped numbers and a fixed list of blend modes.
 */
export function defineGrain(host: Element, id: string, fx: { intensity?: number; size?: number; blend?: string }): void {
  if (typeof DOMParser === "undefined") return;
  const doc = host.ownerDocument;
  const defs = defsOf(host);
  defs.querySelector("#" + id)?.remove();
  const markup = buildLayerGrainFilter(id, { intensity: fx.intensity, size: fx.size, blend: fx.blend as LayerGrainOptions["blend"] }); // core keeps only its own blend modes
  const parsed = new DOMParser().parseFromString(`<svg xmlns="${SVG}"><defs>${markup}</defs></svg>`, "image/svg+xml");
  const filter = parsed.querySelector("filter");
  if (filter) defs.appendChild(doc.importNode(filter, true));
}
