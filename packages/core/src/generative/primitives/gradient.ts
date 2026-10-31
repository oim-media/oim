/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Primitive, RenderContext } from "../types.js";

export interface GradientParams {
  kind?: "linear" | "radial";
  angle?: number;
  softness?: number;
  focus?: number;
}

export const renderGradient: Primitive = (rawParams, ctx) => {
  const params = rawParams as GradientParams;
  const kind = params.kind || "linear";
  const angle = Number(params.angle ?? 135);
  const softness = Math.max(0, Math.min(1, Number(params.softness ?? 0.8)));

  const width = ctx.width;
  const height = ctx.height;

  const color1 = ctx.ramp(0, 2);
  const color2 = ctx.ramp(1, 2);

  const stops = [
    { offset: 0, color: color1, opacity: 1 },
    { offset: Math.round(softness * 100), color: color2, opacity: 1 }
  ];

  let gradId = "";

  if (kind === "radial") {
    gradId = ctx.defs.registerRadialGradient(stops, "50%", "50%", "70%");
  } else {
    const rad = (angle * Math.PI) / 180;
    const x1 = Math.round(50 - Math.cos(rad) * 50);
    const y1 = Math.round(50 - Math.sin(rad) * 50);
    const x2 = Math.round(50 + Math.cos(rad) * 50);
    const y2 = Math.round(50 + Math.sin(rad) * 50);

    gradId = ctx.defs.registerLinearGradient(stops, `${x1}%`, `${y1}%`, `${x2}%`, `${y2}%`);
  }

  return `<rect width="${width}" height="${height}" fill="url(#${gradId})" />`;
};
