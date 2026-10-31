/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Primitive, RenderContext } from "../types.js";

export interface MeshParams {
  resolution?: number;
  distortion?: number;
  borderWidth?: number;
  borderColor?: string;
}

export const renderMesh: Primitive = (rawParams, ctx) => {
  const params = rawParams as MeshParams;
  const resolution = Math.max(3, Math.min(20, Number(params.resolution ?? 8)));
  const distortion = Math.max(0, Math.min(1, Number(params.distortion ?? 0.6)));
  const borderWidth = Math.max(0, Math.min(4, Number(params.borderWidth ?? 0.5)));

  const width = ctx.width;
  const height = ctx.height;

  const cols = resolution;
  const rows = Math.max(3, Math.round(cols * (height / width)));

  const stepX = width / cols;
  const stepY = height / rows;

  const grid: Array<Array<{ x: number; y: number }>> = [];

  for (let r = 0; r <= rows; r++) {
    const rowPoints: Array<{ x: number; y: number }> = [];
    for (let c = 0; c <= cols; c++) {
      const isEdge = r === 0 || r === rows || c === 0 || c === cols;
      const baseX = c * stepX;
      const baseY = r * stepY;

      const jitterX = isEdge ? 0 : (ctx.rng.next() - 0.5) * stepX * distortion;
      const jitterY = isEdge ? 0 : (ctx.rng.next() - 0.5) * stepY * distortion;

      rowPoints.push({ x: baseX + jitterX, y: baseY + jitterY });
    }
    grid.push(rowPoints);
  }

  let markup = "";
  const totalTriangles = rows * cols * 2;
  let triangleIndex = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p1 = grid[r][c];
      const p2 = grid[r][c + 1];
      const p3 = grid[r + 1][c];
      const p4 = grid[r + 1][c + 1];

      const color1 = ctx.ramp(triangleIndex++, totalTriangles);
      const color2 = ctx.ramp(triangleIndex++, totalTriangles);

      const strokeAttr = borderWidth > 0 ? ` stroke="${params.borderColor || color1}" stroke-width="${borderWidth}" stroke-linejoin="bevel"` : "";

      markup += `
        <polygon points="${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}" fill="${color1}"${strokeAttr} />
        <polygon points="${p2.x},${p2.y} ${p4.x},${p4.y} ${p3.x},${p3.y}" fill="${color2}"${strokeAttr} />
      `;
    }
  }

  return markup;
};
