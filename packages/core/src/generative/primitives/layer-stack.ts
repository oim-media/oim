/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Primitive, RenderContext } from "../types.js";

export interface LayerStackParams {
  layers?: number;
  interpolation?: "wave" | "peak" | "step" | "zigzag" | "chevron";
  boundary?: "shared" | "independent";
  frequency?: number;
  amplitude?: number;
  balance?: number;
  anchor?: "bottom" | "top" | "left" | "right";
}

interface Point {
  x: number;
  y: number;
}

export const renderLayerStack: Primitive = (rawParams, ctx) => {
  const params = rawParams as LayerStackParams;
  const layers = Math.max(1, Math.min(12, Number(params.layers ?? 5)));
  const interpolation = params.interpolation || "wave";
  const boundary = params.boundary || "shared";
  const frequency = Math.max(2, Math.min(12, Number(params.frequency ?? 4)));
  const amplitude = Math.max(0, Math.min(1, Number(params.amplitude ?? 0.5)));
  const balance = Math.max(0, Math.min(1, Number(params.balance ?? 0.5)));
  const anchor = params.anchor || "bottom";

  const width = ctx.width;
  const height = ctx.height;
  const bleed = ctx.bleed;

  const isVertical = anchor === "bottom" || anchor === "top";
  const mainSize = isVertical ? height : width;
  const crossSize = isVertical ? width : height;

  const layerSpan = mainSize / (layers + 1);
  const bias = (balance - 0.5) * crossSize * 0.4;

  const allPoints: Point[][] = [];

  for (let l = 0; l < layers; l++) {
    const baseOffset = (l + 1) * layerSpan;
    const currentPoints: Point[] = [];
    const stepCross = crossSize / frequency;

    for (let f = 0; f <= frequency; f++) {
      const crossPos = f * stepCross;
      const noise = (ctx.rng.next() - 0.5) * layerSpan * amplitude * 1.6;
      const pointOffset = Math.max(10, Math.min(mainSize - 10, baseOffset + noise));

      if (isVertical) {
        const x = crossPos + (f > 0 && f < frequency ? bias : 0);
        const y = anchor === "bottom" ? height - pointOffset : pointOffset;
        currentPoints.push({ x, y });
      } else {
        const y = crossPos + (f > 0 && f < frequency ? bias : 0);
        const x = anchor === "right" ? width - pointOffset : pointOffset;
        currentPoints.push({ x, y });
      }
    }
    allPoints.push(currentPoints);
  }

  let markup = "";
  const layerIndices = boundary === "independent"
    ? Array.from({ length: layers }, (_, idx) => layers - 1 - idx)
    : Array.from({ length: layers }, (_, idx) => idx);

  for (const l of layerIndices) {
    const color = ctx.ramp(l, layers);
    const currentPoints = allPoints[l];
    let pathD = "";

    // 1. Trace the front edge forward
    if (interpolation === "step") {
      pathD = `M ${currentPoints[0].x} ${currentPoints[0].y}`;
      for (let p = 0; p < currentPoints.length - 1; p++) {
        const p1 = currentPoints[p];
        const p2 = currentPoints[p + 1];
        if (isVertical) {
          pathD += ` L ${p2.x} ${p1.y} L ${p2.x} ${p2.y}`;
        } else {
          pathD += ` L ${p1.x} ${p2.y} L ${p2.x} ${p2.y}`;
        }
      }
    } else if (interpolation === "peak") {
      pathD = `M ${currentPoints[0].x} ${currentPoints[0].y}`;
      for (let p = 1; p < currentPoints.length; p++) {
        pathD += ` L ${currentPoints[p].x} ${currentPoints[p].y}`;
      }
    } else if (interpolation === "zigzag" || interpolation === "chevron") {
      pathD = `M ${currentPoints[0].x} ${currentPoints[0].y}`;
      for (let p = 0; p < currentPoints.length - 1; p++) {
        const p1 = currentPoints[p];
        const p2 = currentPoints[p + 1];
        const midX = (p1.x + p2.x) / 2 + (isVertical ? 0 : (l % 2 === 0 ? 30 : -30));
        const midY = (p1.y + p2.y) / 2 + (isVertical ? (l % 2 === 0 ? 30 : -30) : 0);
        pathD += ` L ${midX} ${midY} L ${p2.x} ${p2.y}`;
      }
    } else {
      // Wave (Bezier Spline)
      pathD = `M ${currentPoints[0].x} ${currentPoints[0].y}`;
      for (let p = 0; p < currentPoints.length - 1; p++) {
        const p1 = currentPoints[p];
        const p2 = currentPoints[p + 1];
        const cp1x = p1.x + (p2.x - p1.x) * 0.5;
        const cp1y = p1.y;
        const cp2x = p1.x + (p2.x - p1.x) * 0.5;
        const cp2y = p2.y;
        pathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
      }
    }

    // 2. Close the polygon (boundary: 'shared' vs 'independent')
    if (boundary === "shared" && l > 0) {
      const prev = allPoints[l - 1];
      const dy = anchor === "bottom" ? bleed : (anchor === "top" ? -bleed : 0);
      const dx = anchor === "right" ? bleed : (anchor === "left" ? -bleed : 0);

      for (let p = prev.length - 1; p >= 0; p--) {
        pathD += ` L ${prev[p].x + dx} ${prev[p].y + dy}`;
      }
    } else {
      // Closing edge to the outer frame
      if (anchor === "bottom") {
        pathD += ` L ${width} ${height + bleed} L 0 ${height + bleed}`;
      } else if (anchor === "top") {
        pathD += ` L ${width} ${-bleed} L 0 ${-bleed}`;
      } else if (anchor === "right") {
        pathD += ` L ${width + bleed} ${height} L ${width + bleed} 0`;
      } else {
        pathD += ` L ${-bleed} ${height} L ${-bleed} 0`;
      }
    }

    pathD += " Z";
    markup += `<path d="${pathD}" fill="${color}" stroke="${color}" stroke-width="0.5" stroke-linejoin="round" stroke-linecap="round" />`;
  }

  return markup;
};
