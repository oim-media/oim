/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Primitive, RenderContext } from "../types.js";

export interface IsoGridParams {
  cols?: number;
  extrude?: number;
  hollow?: boolean;
  strokeWidth?: number;
}

export const renderIsoGrid: Primitive = (rawParams, ctx) => {
  const params = rawParams as IsoGridParams;
  const cols = Math.max(4, Math.min(20, Number(params.cols ?? 8)));
  const extrudeVal = Math.max(0, Math.min(1, Number(params.extrude ?? 0.6)));
  const hollow = Boolean(params.hollow ?? false);
  const strokeW = Math.max(0, Math.min(4, Number(params.strokeWidth ?? 1)));

  const width = ctx.width;
  const height = ctx.height;

  const rows = Math.max(3, Math.round(cols * (height / width)));
  const stepX = width / cols;
  const stepY = height / rows;
  const totalCells = cols * rows;

  const colorStart = ctx.ramp(0, 2);
  const colorEnd = ctx.ramp(1, 2);

  // Register ONE shared gradient in DefsRegistry for all cells of the grid
  const sharedGradId = ctx.defs.registerLinearGradient(
    [
      { offset: 0, color: colorStart, opacity: 1 },
      { offset: 100, color: colorEnd, opacity: 1 }
    ],
    "0%",
    "0%",
    "100%",
    "100%"
  );

  let markup = "";

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const faceColor = ctx.ramp(idx, totalCells);
      const x = c * stepX;
      const y = r * stepY;

      const extrudeOffset = (0.2 + ctx.rng.next() * 0.8) * 24 * extrudeVal;
      const strokeAttr = strokeW > 0 ? ` stroke="${colorEnd}" stroke-width="${strokeW}"` : "";

      if (hollow) {
        // Hollow box frame
        const inset = stepX * 0.2;
        markup += `
          <rect x="${x}" y="${y}" width="${stepX}" height="${stepY}" fill="none"${strokeAttr} />
          <rect x="${x + inset}" y="${y + inset}" width="${stepX - inset * 2}" height="${stepY - inset * 2}" fill="${faceColor}" opacity="0.65" />
        `;
      } else {
        // 3D extruded cube with faces in perspective
        markup += `
          <rect x="${x}" y="${y}" width="${stepX}" height="${stepY}" fill="url(#${sharedGradId})"${strokeAttr} />
          <polygon points="${x},${y} ${x + extrudeOffset},${y - extrudeOffset} ${x + stepX + extrudeOffset},${y - extrudeOffset} ${x + stepX},${y}" fill="${faceColor}" opacity="0.75" />
          <polygon points="${x + stepX},${y} ${x + stepX + extrudeOffset},${y - extrudeOffset} ${x + stepX + extrudeOffset},${y + stepY - extrudeOffset} ${x + stepX},${y + stepY}" fill="#000000" opacity="0.35" />
        `;
      }
    }
  }

  return markup;
};
