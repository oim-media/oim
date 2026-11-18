/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const SVG = "http://www.w3.org/2000/svg";

/** The two tones a duotone maps luminance to. */
export const DUOTONE_COLORS = { shadows: "#1e1b4b", lights: "#fbbf24" };

function hexChannel(hex: string, channelIndex: 0 | 1 | 2): number {
  const clean = (hex || "").replace("#", "");
  const value = parseInt(clean.substring(channelIndex * 2, channelIndex * 2 + 2), 16) || 0;
  return Math.round((value / 255) * 1000) / 1000;
}

/** The duotone SVG filter: grey by luminance, then a two-stop table per channel. Shared by the 1.x painter and the scene. */
export function duotoneFilter(doc: Document, id: string): SVGFilterElement {
  const filter = doc.createElementNS(SVG, "filter");
  filter.setAttribute("id", id);
  // The table is in sRGB, as the editor draws it; linearRGB (the SVG default) lightens every tone.
  filter.setAttribute("color-interpolation-filters", "sRGB");
  const colorMatrix = doc.createElementNS(SVG, "feColorMatrix");
  colorMatrix.setAttribute("type", "matrix");
  colorMatrix.setAttribute("values", "0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 1 0");
  filter.appendChild(colorMatrix);
  const transfer = doc.createElementNS(SVG, "feComponentTransfer");
  (["R", "G", "B"] as const).forEach((ch, idx) => {
    const func = doc.createElementNS(SVG, "feFunc" + ch);
    func.setAttribute("type", "table");
    func.setAttribute("tableValues", `${hexChannel(DUOTONE_COLORS.shadows, idx as 0 | 1 | 2)} ${hexChannel(DUOTONE_COLORS.lights, idx as 0 | 1 | 2)}`);
    transfer.appendChild(func);
  });
  filter.appendChild(transfer);
  return filter;
}
