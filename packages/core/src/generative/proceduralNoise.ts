/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SvgNoiseFilterOptions {
  intensity?: number;
  baseFrequency?: number;
  numOctaves?: number;
  /** Tints the grain. Absent (or not a hex/rgb color): the grey grain of every .oim so far. */
  color?: string;
}

/** Goes into an SVG attribute and comes from a .oim anyone can make: hex or rgb()/rgba() only. */
const GRAIN_COLOR =/^#[0-9a-fA-F]{3,8}$|^rgba?\([\d.,\s%]+\)$/;

/**
 * Genera el marcado SVG canónico para el filtro de ruido analógico procedural.
 *
 * Utiliza los estándares abiertos del W3C (`<feTurbulence>` y `<feColorMatrix>`).
 * Con `stitchTiles="stitch"`, el patrón puede repetirse sin costuras ni bordes duros.
 */
export function buildSvgNoiseFilter(id: string, options?: SvgNoiseFilterOptions): string {
  const intensity = Math.max(1, Math.min(100, options?.intensity ?? 15));
  const rawFreq = options?.baseFrequency ?? 0.8;
  const baseFrequency = Math.max(0.1, Math.min(2.0, rawFreq));
  const numOctaves = Math.max(1, Math.min(4, options?.numOctaves ?? 3));

  const turbulence = `<feTurbulence type="fractalNoise" baseFrequency="${baseFrequency}" numOctaves="${numOctaves}" stitchTiles="stitch"/>`;
  const color = options?.color?.trim();
  if (color && GRAIN_COLOR.test(color)) {
    // The noise becomes the alpha and the color fills it.
    return `<filter id="${id}">${turbulence.replace("/>", ' result="n"/>')}<feColorMatrix in="n" type="luminanceToAlpha" result="a"/><feFlood flood-color="${color}"/><feComposite in2="a" operator="in"/></filter>`;
  }
  return `<filter id="${id}">${turbulence}<feColorMatrix type="saturate" values="0"/></filter>`;
}

/** How a layer's grain blends with the layer. Monochrome by design. */
export const GRAIN_BLENDS = ["overlay", "soft-light", "multiply"] as const;
export type GrainBlend = (typeof GRAIN_BLENDS)[number];

/**
 * The layer types that take grain. One list for the player and the editor's
 * panel: Lottie, masks, filters, groups and components do not (a group's
 * grain would fall on its children).
 */
export const GRAIN_LAYER_TYPES = ["text", "artistic-text", "geo", "shape", "svg", "draw", "image", "pattern"] as const;

export interface LayerGrainOptions {
  /** 1–100, the grain's opacity. Default 20. */
  intensity?: number;
  /** 1–100, from finest to coarsest. Default 50. */
  size?: number;
  blend?: GrainBlend;
}

const clampPercent = (v: number | undefined, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(1, Math.min(100, v)) : fallback;

/**
 * The layer grain's `grainSize` as feTurbulence's baseFrequency: a straight
 * inverse line from 2.0 (size 1, finest) to 0.2 (size 100, coarsest). The one
 * place that conversion lives, for the editor, the player and the export.
 */
export function grainFrequency(size?: number): number {
  const s = clampPercent(size, 50);
  return Math.round((2 - ((s - 1) * 1.8) / 99) * 1000) / 1000;
}

/**
 * Photographic grain for ONE layer, as an SVG filter applied to the layer
 * itself: monochrome fractal noise, cut to the layer's own alpha so it only
 * shows where there is ink, scaled by the intensity and blended with the
 * layer. Fixed seed: the same input paints the same pixels everywhere.
 */
export function buildLayerGrainFilter(id: string, options?: LayerGrainOptions): string {
  const intensity = clampPercent(options?.intensity, 20);
  const blend: GrainBlend = (GRAIN_BLENDS as readonly string[]).includes(options?.blend as string)
    ? (options!.blend as GrainBlend)
    : "overlay";
  const slope = Math.round(intensity) / 100;
  return (
    `<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
    `<feTurbulence type="fractalNoise" baseFrequency="${grainFrequency(options?.size)}" numOctaves="3" seed="7" stitchTiles="stitch" result="n"/>` +
    `<feColorMatrix in="n" type="saturate" values="0" result="g"/>` +
    `<feComposite in="g" in2="SourceAlpha" operator="in" result="m"/>` +
    `<feComponentTransfer in="m" result="t"><feFuncA type="linear" slope="${slope}"/></feComponentTransfer>` +
    `<feBlend in="t" in2="SourceGraphic" mode="${blend}"/>` +
    `</filter>`
  );
}

export interface BlobPathOptions {
  seed?: number;
  points?: number;
  randomness?: number;
  size?: number;
}

/**
 * Genera una curva cerrada de Bézier cúbica determinista para una forma de Blob orgánico.
 *
 * Emplea un generador pseudoaleatorio por congruencia lineal (LCG) para garantizar
 * que la misma semilla (seed) siempre produzca idéntica geometría en cualquier cliente.
 */
export function generateBlobPath(options?: BlobPathOptions): string {
  let seed = options?.seed ?? 42;
  const pointsCount = Math.max(3, Math.min(16, options?.points ?? 6));
  const randomness = Math.max(0.05, Math.min(0.8, options?.randomness ?? 0.35));
  const size = options?.size ?? 100;

  const rng = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const center = size / 2;
  const baseRadius = size * 0.4;
  const points: [number, number][] = [];

  for (let i = 0; i < pointsCount; i++) {
    const angle = (Math.PI * 2 / pointsCount) * i;
    const rVariation = 1 + (rng() - 0.5) * 2 * randomness;
    const r = baseRadius * rVariation;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    points.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
  }

  // Interpolar puntos en un ciclo cerrado con curvas de Bézier cúbicas
  const n = points.length;
  let d = `M ${points[0][0]},${points[0][1]}`;

  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];

    // Puntos de control Catmull-Rom a Bézier cúbica
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;

    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2[0]},${p2[1]}`;
  }

  d += " Z";
  return d;
}

export interface ScribblePathOptions {
  seed?: number;
  segments?: number;
  amplitude?: number;
  width?: number;
  height?: number;
}

/**
 * Genera un trazo abierto editorial de garabato / subrayado procedural y determinista.
 * Ideal para rotuladores, subrayados de titulares, anotaciones y garabatos fffuel.
 */
export function generateScribblePath(options?: ScribblePathOptions): string {
  let seed = options?.seed ?? 42;
  const segments = Math.max(3, Math.min(12, options?.segments ?? 5));
  const amplitude = Math.max(5, Math.min(40, options?.amplitude ?? 15));
  const w = options?.width ?? 100;
  const h = options?.height ?? 100;

  const rng = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  // Trazo de izquierda a derecha con oscilaciones y retorno leve
  const startX = 5;
  const startY = h * 0.7 + (rng() - 0.5) * 10;
  let d = `M ${startX.toFixed(1)},${startY.toFixed(1)}`;

  const stepX = (w - 10) / segments;
  for (let i = 1; i <= segments; i++) {
    const currentX = startX + i * stepX;
    const direction = i % 2 === 1 ? -1 : 1;
    const targetY = h * 0.75 + direction * (amplitude * (0.6 + rng() * 0.8));
    const cpX = currentX - stepX * 0.5;
    const cpY = targetY + (rng() - 0.5) * 10;
    d += ` Q ${cpX.toFixed(1)},${cpY.toFixed(1)} ${currentX.toFixed(1)},${targetY.toFixed(1)}`;
  }

  // Trazo de vuelta rápido inferior
  const returnCpX = w * 0.5;
  const returnCpY = h * 0.85 + (rng() - 0.5) * 8;
  const endX = startX + (rng() * 10);
  const endY = h * 0.82 + (rng() - 0.5) * 8;
  d += ` Q ${returnCpX.toFixed(1)},${returnCpY.toFixed(1)} ${endX.toFixed(1)},${endY.toFixed(1)}`;

  return d;
}

