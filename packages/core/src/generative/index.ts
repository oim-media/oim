/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GENERATOR_CATALOG, getGeneratorSpec } from "./catalog.js";
import { renderLayerStack } from "./primitives/layer-stack.js";
import { renderScatter } from "./primitives/scatter.js";
import { renderBlob } from "./primitives/blob.js";
import { renderMesh } from "./primitives/mesh.js";
import { renderRadial } from "./primitives/radial.js";
import { renderGradient } from "./primitives/gradient.js";
import { renderIsoGrid } from "./primitives/iso-grid.js";
import { createRng } from "./rng.js";
import { createDefsRegistry, buildSvgDocument } from "./svg.js";
import { createColorRamp } from "./ramp.js";
import { GenerativeConfig, Primitive, PrimitiveName, RenderContext } from "./types.js";

const PRIMITIVE_MAP: Record<PrimitiveName, Primitive> = {
  "layer-stack": renderLayerStack,
  scatter: renderScatter,
  blob: renderBlob,
  mesh: renderMesh,
  radial: renderRadial,
  gradient: renderGradient,
  "iso-grid": renderIsoGrid
};

const warnedUnknownGenerators = new Set<string>();

export interface CanvasDimensions {
  width: number;
  height: number;
  bleed?: number;
}

export function renderGenerativeSVG(config: GenerativeConfig, canvas: CanvasDimensions): string {
  let spec = getGeneratorSpec(config.generatorId);

  if (!spec) {
    if (!warnedUnknownGenerators.has(config.generatorId)) {
      warnedUnknownGenerators.add(config.generatorId);
      console.warn(`[GenerativeEngine] Unknown generatorId "${config.generatorId}", falling back to "stacked-waves"`);
    }
    spec = GENERATOR_CATALOG[0]; // fall back to stacked-waves
  }

  // 1. Clamp and resolve parameters validated against the schema
  const baseParams: Record<string, unknown> = {};

  for (const schemaItem of spec.schema) {
    const rawVal = config.params ? config.params[schemaItem.key] : undefined;
    const val = rawVal !== undefined ? rawVal : schemaItem.default;

    if (schemaItem.kind === "range" && typeof val === "number") {
      const min = schemaItem.min ?? -Infinity;
      const max = schemaItem.max ?? Infinity;
      baseParams[schemaItem.key] = Math.max(min, Math.min(max, val));
    } else {
      baseParams[schemaItem.key] = val;
    }
  }

  // 2. Build cross-cutting services (RNG, DefsRegistry, OKLab color ramp)
  const rng = createRng(config.seed || 42);
  const defs = createDefsRegistry();

  const colorRamp = createColorRamp({
    mode: config.colors?.mode || "monochrome",
    stops: config.colors?.stops || ["#3b82f6", "#0f172a"],
    direction: config.colors?.direction || "forward"
  });

  const ctx: RenderContext = {
    width: canvas.width || 804,
    height: canvas.height || 1200,
    bleed: canvas.bleed !== undefined ? canvas.bleed : 1,
    rng,
    defs,
    ramp: colorRamp
  };

  // 3. Render each layer
  let contentMarkup = spec.layers
    .map((layer) => {
      const resolvedParams = { ...layer.fixed, ...baseParams };
      const primitiveFn = PRIMITIVE_MAP[layer.primitive];
      const marcas = primitiveFn(resolvedParams, ctx);

      const estilos = [
        layer.blend && layer.blend !== "normal" ? `mix-blend-mode:${layer.blend}` : null,
        layer.opacidad !== undefined && layer.opacidad !== 1 ? `opacity:${layer.opacidad}` : null
      ]
        .filter(Boolean)
        .join(";");

      // Without styles or blur the layer is not wrapped: a single-layer generator produces
      // the same SVG as before, byte for byte.
      if (!estilos && !layer.desenfoque) return marcas;

      const filtro = layer.desenfoque ? ` filter="url(#${ctx.defs.registerBlur(layer.desenfoque)})"` : "";
      const styleAttr = estilos ? ` style="${estilos}"` : "";
      return `<g${styleAttr}${filtro}>${marcas}</g>`;
    })
    .join("");

  // 4. Tiled grain, 128px
  if (spec.grano && spec.grano.intensidad > 0) {
    const grainPatternId = defs.registerGrain(spec.grano.intensidad);
    contentMarkup += `<rect width="100%" height="100%" fill="url(#${grainPatternId})" opacity="${spec.grano.intensidad}"/>`;
  }

  // 5. Assemble the SVG document with a dynamic viewBox
  return buildSvgDocument({
    width: ctx.width,
    height: ctx.height,
    bleed: ctx.bleed,
    defs,
    content: contentMarkup,
    backgroundColor: config.colors?.backgroundVisible !== false ? config.colors?.background : undefined
  });
}

export * from "./types.js";
export * from "./catalog.js";
