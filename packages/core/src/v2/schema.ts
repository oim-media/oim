/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// The 2.0 document. Three rules shape everything below:
//  - one block per idea, the same in every layer that admits it;
//  - an absent field is its default, so no object carries switched-off values;
//  - every object is strict, so a block on the wrong layer type is an error.
// The only open map is `extensions`.

import { z } from "zod";
import {
  cssColorSchema,
  dropCapSchema,
  embeddedFontSchema,
  generativeFillSchema,
  keyframeEasingSchema,
  parallaxSchema,
  textHighlightSchema,
  textMarkSchema,
  textRunsSchema,
} from "../schema.js";
import { LAYER_BLOCKS, type Block, type LayerType } from "./layer-blocks.js";

export const DOCUMENT_VERSION = "2.0.0-draft.1";

const id = z.string().min(1).max(128);
const unit = z.number().min(0).max(1);
const extensions = z.record(z.string(), z.unknown());

// --- values -----------------------------------------------------------------

const binding = z.object({ var: z.string().min(1).max(64) }).strict();

/** A literal, a binding to a variable, or a literal with per-mode exceptions. */
export function scalar<T extends z.ZodType>(literal: T) {
  return z.union([literal, binding, z.object({ value: literal, modes: z.record(z.string(), literal) }).strict()]);
}

const color = scalar(cssColorSchema);
const length = scalar(z.number());

// --- paint ------------------------------------------------------------------

const crop = z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100), zoom: z.number().min(1).max(10) }).strict();
const fit = z.enum(["contain", "cover", "fill", "none", "scale-down"]);

export const imageFiltersSchema = z
  .object({
    preset: z.string().max(64).optional(),
    blur: z.number().min(0).optional(),
    brightness: z.number().min(0).optional(),
    contrast: z.number().min(0).optional(),
    saturate: z.number().min(0).optional(),
    hueRotate: z.number().optional(),
  })
  .strict();

const gradientStop = z.object({ color, at: unit.optional() }).strict();
export const gradientSchema = z
  .object({
    type: z.enum(["linear", "radial", "conic"]),
    angle: z.number().optional(),
    stops: z.array(gradientStop).min(2).max(32),
  })
  .strict();

const patternMotion = z
  .object({
    direction: z.enum(["right", "left", "up", "down", "zoom-in", "zoom-out", "pulse"]),
    period: z.number().positive().optional(),
    speed: z.number().optional(),
  })
  .strict();

export const patternSchema = z
  .object({
    preset: z.string().max(64).optional(),
    colors: z.array(color).max(16).optional(),
    bg: color.optional(),
    scale: z.number().optional(),
    sizes: z.array(z.number()).max(16).optional(),
    counts: z.array(z.number()).max(16).optional(),
    dispersions: z.array(z.number()).max(16).optional(),
    svgs: z.array(z.string()).max(16).optional(),
    fit: z.string().max(32).optional(),
    motion: patternMotion.optional(),
  })
  .strict();

const paintOpacity = { opacity: unit.optional() };
export const paintSchema = z.union([
  z.object({ kind: z.literal("color"), value: color, ...paintOpacity }).strict(),
  z
    .object({
      kind: z.literal("gradient"),
      gradient: gradientSchema.optional(),
      preset: z.string().max(64).optional(),
      ...paintOpacity,
    })
    .strict()
    .refine((p) => (p.gradient === undefined) !== (p.preset === undefined), "a gradient paint has a gradient or a preset"),
  z
    .object({
      kind: z.literal("image"),
      src: z.string().min(1),
      fit: fit.optional(),
      crop: crop.optional(),
      flipX: z.boolean().optional(),
      flipY: z.boolean().optional(),
      filters: imageFiltersSchema.optional(),
      ...paintOpacity,
    })
    .strict(),
  z.object({ kind: z.literal("pattern"), pattern: patternSchema, ...paintOpacity }).strict(),
  z.object({ kind: z.literal("generative"), generative: generativeFillSchema, ...paintOpacity }).strict(),
  z.object({ ref: id }).strict(),
]);

export const strokeSchema = z
  .object({
    paint: paintSchema,
    width: length,
    align: z.enum(["center", "inside", "outside"]).optional(),
    style: z.enum(["solid", "dashed", "dotted"]).optional(),
  })
  .strict();

// --- effects ----------------------------------------------------------------

export const effectSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("shadow"),
      x: z.number().optional(),
      y: z.number().optional(),
      blur: z.number().min(0).optional(),
      spread: z.number().optional(),
      color: color.optional(),
      opacity: unit.optional(),
      inner: z.boolean().optional(),
    })
    .strict(),
  z.object({ kind: z.literal("glow"), radius: z.number().min(0), color: color.optional(), intensity: z.number().optional() }).strict(),
  z.object({ kind: z.literal("blur"), radius: z.number().min(0) }).strict(),
  z.object({ kind: z.literal("backdrop") }).extend(imageFiltersSchema.shape).strict(),
  z
    .object({
      kind: z.literal("grain"),
      intensity: z.number().min(0).max(100).optional(),
      size: z.number().min(0).optional(),
      blend: z.string().max(32).optional(),
      color: color.optional(),
    })
    .strict(),
  z.object({ kind: z.literal("color-grade"), params: z.record(z.string(), z.unknown()) }).strict(),
]);

// --- text -------------------------------------------------------------------

export const textSchema = z
  .object({
    content: z.record(z.string(), z.string()),
    font: z
      .object({
        family: z.string().max(256).optional(),
        size: length.optional(),
        weight: z.union([z.number(), z.string().max(16)]).optional(),
        italic: z.boolean().optional(),
      })
      .strict()
      .optional(),
    align: z.enum(["left", "center", "right", "justify"]).optional(),
    lineHeight: z.union([z.number(), z.string().max(16)]).optional(),
    letterSpacing: z.number().optional(),
    transform: z.enum(["uppercase", "lowercase", "capitalize"]).optional(),
    decoration: z.string().max(64).optional(),
    maxWidth: length.optional(),
    marks: z.record(z.string(), textMarkSchema).optional(),
    runs: textRunsSchema.optional(),
    highlight: textHighlightSchema.optional(),
    dropCap: dropCapSchema.optional(),
    artistic: z
      .object({
        preset: z.string().max(64).optional(),
        curve: z.object({ type: z.enum(["arc", "wave", "arch"]), amount: z.number() }).strict().optional(),
        extrusion: z
          .object({ depth: z.number().min(0), angle: z.number().optional(), color: color.optional(), shading: z.boolean().optional() })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

// --- geometry ---------------------------------------------------------------

const pathEntry = z
  .object({
    d: z.string().min(1),
    fillRule: z.literal("evenodd").optional(),
    fill: z.string().max(128).optional(),
    stroke: z.string().max(128).optional(),
    strokeWidth: z.number().min(0).optional(),
    opacity: unit.optional(),
    transform: z.array(z.number()).length(6).optional(),
  })
  .strict();

export const geometrySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("rect") }).strict(),
  z.object({ kind: z.literal("ellipse") }).strict(),
  z.object({ kind: z.literal("line") }).strict(),
  z.object({ kind: z.literal("polygon"), sides: z.number().int().min(3).max(64) }).strict(),
  z.object({ kind: z.literal("star"), points: z.number().int().min(3).max(64), inner: unit.optional() }).strict(),
  z.object({ kind: z.literal("preset"), name: z.string().min(1).max(64) }).strict(),
  z
    .object({
      kind: z.literal("paths"),
      viewBox: z.array(z.number()).length(4),
      paths: z.array(pathEntry).min(1).max(2000),
    })
    .strict(),
]);

const corners = z.union([z.number().min(0), z.array(z.number().min(0)).length(4)]);

export const imageSchema = z
  .object({
    src: z.string().min(1),
    fit: fit.optional(),
    crop: crop.optional(),
    flipX: z.boolean().optional(),
    flipY: z.boolean().optional(),
    filters: imageFiltersSchema.optional(),
  })
  .strict();

export const maskSchema = z
  .object({
    mode: z.enum(["window", "cutout"]).optional(),
    invert: z.boolean().optional(),
    feather: z.number().min(0).optional(),
    scope: z.enum(["group", "canvas"]).optional(),
  })
  .strict();

// --- animation --------------------------------------------------------------

export const ANIMATABLE = ["opacity", "x", "y", "scale", "rotation", "blur", "trimStart", "trimEnd"] as const;

const track = z
  .object({
    property: z.enum(ANIMATABLE),
    keyframes: z
      .array(z.object({ t: unit, v: z.number(), e: keyframeEasingSchema.optional() }).strict())
      .min(2)
      .max(240),
  })
  .strict();

function animationFor(targets: readonly [string, ...string[]]) {
  return z
    .object({
      on: z.enum(["load", "loop", "enter", "hover", "press"]),
      target: z.enum(targets).optional(),
      preset: z.string().min(1).max(64).optional(),
      params: z.record(z.string(), z.unknown()).optional(),
      tracks: z.array(track).min(1).max(16).optional(),
      duration: z.number().min(0),
      delay: z.number().min(0).optional(),
      stagger: z.number().min(0).optional(),
      easing: keyframeEasingSchema.optional(),
    })
    .strict()
    .refine((a) => (a.preset === undefined) !== (a.tracks === undefined), "an animation carries a preset or tracks");
}

export const animationSchema = animationFor(["layer", "chars", "words", "lines"]);
const layerOnlyAnimation = animationFor(["layer"]);

const sceneLoop = z
  .object({
    direction: z.enum(["left_to_right", "right_to_left"]).optional(),
    speedPxSec: z.number().optional(),
    mirror: z.boolean().optional(),
    pauseOnHover: z.boolean().optional(),
    depth: z.number().optional(),
    off: z.boolean().optional(),
  })
  .strict();

export const motionSchema = z.object({ parallax: parallaxSchema.optional(), sceneLoop: sceneLoop.optional() }).strict();

export const interactionSchema = z
  .object({
    on: z.enum(["press", "hover"]),
    action: z.literal("toggle"),
    show: z.array(id).max(150).optional(),
    hide: z.array(id).max(150).optional(),
    transition: z.number().min(0).optional(),
  })
  .strict();

const a11y = z.object({ alt: z.record(z.string(), z.string()).optional(), decorative: z.boolean().optional() }).strict();

// --- layer ------------------------------------------------------------------

const boxSchema = z
  .object({ x: z.number(), y: z.number(), width: z.number().min(0), height: z.number().min(0), rotation: z.number().optional() })
  .strict();

const BLEND = ["multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "difference"] as const;

function blockShape(type: LayerType): Record<string, z.ZodType> {
  const animations = z.array(type === "text" ? animationSchema : layerOnlyAnimation).max(16);
  const all: Record<Block, z.ZodType> = {
    fills: z.array(paintSchema).max(8),
    strokes: z.array(strokeSchema).max(8),
    effects: z.array(effectSchema).max(16),
    animations,
    motion: motionSchema,
    mask: maskSchema,
    geometry: geometrySchema,
    corners,
    text: textSchema,
    image: imageSchema,
    a11y,
    interaction: interactionSchema,
    children: z.array(z.lazy(() => layerSchema)).max(150),
  };
  // What a type cannot exist without is required; every other block is optional.
  const required: Partial<Record<LayerType, Block>> = { text: "text", shape: "geometry", image: "image", group: "children" };
  const shape: Record<string, z.ZodType> = {};
  for (const block of LAYER_BLOCKS[type]) {
    shape[block] = required[type] === block ? all[block] : all[block].optional();
  }
  return shape;
}

function layerOf<T extends LayerType>(type: T, own: Record<string, z.ZodType> = {}) {
  return z
    .object({
      id,
      type: z.literal(type),
      name: z.string().max(256).optional(),
      box: boxSchema,
      opacity: unit.optional(),
      visible: z.boolean().optional(),
      blend: z.enum(BLEND).optional(),
      // Shown only in these languages; absent means every language.
      languages: z.array(z.string().min(1).max(16)).min(1).max(64).optional(),
      extensions: extensions.optional(),
      ...blockShape(type),
      ...own,
    })
    .strict();
}

const lottie = z.object({ src: z.string().min(1).optional(), loop: z.boolean().optional() }).strict();

export const layerSchema: z.ZodType = z.lazy(() =>
  z.discriminatedUnion("type", [
    layerOf("text"),
    layerOf("shape"),
    layerOf("image"),
    layerOf("lottie", { lottie: lottie.optional() }),
    layerOf("group"),
  ]),
);

// --- document ---------------------------------------------------------------

const variableValue = z.union([z.string().max(256), z.number()]);
export const variablesSchema = z
  .object({
    modes: z.record(z.string(), z.array(z.string().min(1).max(64)).min(1).max(64)).optional(),
    defaults: z.record(z.string(), z.string()).optional(),
    values: z.record(z.string(), z.union([variableValue, z.record(z.string(), variableValue)])).optional(),
  })
  .strict();

function duplicatedIds(layers: unknown, seen: Set<string>, out: string[]): void {
  if (!Array.isArray(layers)) return;
  for (const layer of layers) {
    if (!layer || typeof layer !== "object") continue;
    const layerId = (layer as { id?: unknown }).id;
    if (typeof layerId === "string") {
      if (seen.has(layerId)) out.push(layerId);
      seen.add(layerId);
    }
    duplicatedIds((layer as { children?: unknown }).children, seen, out);
  }
}

export const documentSchema = z
  .object({
    oim: z.string().regex(/^2\.\d+\.\d+(-[\w.]+)?$/),
    id: z.string().max(128).optional(),
    name: z.string().max(256).optional(),
    // What the whole work shows, per language, for screen readers.
    description: z.record(z.string(), z.string().max(1000)).optional(),
    canvas: z.object({ width: z.number().positive(), height: z.number().positive() }).strict(),
    languages: z.array(z.string().min(1).max(16)).min(1).max(64),
    variables: variablesSchema.optional(),
    resources: z.record(z.string(), paintSchema).optional(),
    fonts: z.array(embeddedFontSchema).optional(),
    layers: z.array(layerSchema).max(150),
    reedit: z.enum(["public", "author_only", "sealed"]).optional(),
    extensionsUsed: z.array(z.string().max(64)).optional(),
    extensionsRequired: z.array(z.string().max(64)).optional(),
    extensions: extensions.optional(),
    image_hash: z.string().optional(),
    image_hash_alg: z.string().optional(),
    signature: z.string().optional(),
    key_version: z.string().optional(),
    signed_at: z.string().optional(),
  })
  .strict()
  .superRefine((document, ctx) => {
    const repeated: string[] = [];
    duplicatedIds(document.layers, new Set(), repeated);
    for (const layerId of repeated) {
      ctx.addIssue({ code: "custom", path: ["layers"], message: `layer id "${layerId}" is used more than once` });
    }
  });

// --- types ------------------------------------------------------------------
// Written by hand: the layer is recursive, and a readable type is worth more
// to the converters than one inferred through z.lazy.

export type Paint = z.infer<typeof paintSchema>;
export type Stroke = z.infer<typeof strokeSchema>;
export type Effect = z.infer<typeof effectSchema>;
export type TextBlock = z.infer<typeof textSchema>;
export type Geometry = z.infer<typeof geometrySchema>;
export type ImageBlock = z.infer<typeof imageSchema>;
export type Mask = z.infer<typeof maskSchema>;
export type Animation = z.infer<typeof animationSchema>;
export type Motion = z.infer<typeof motionSchema>;
export type Interaction = z.infer<typeof interactionSchema>;
export type Box = z.infer<typeof boxSchema>;
export type Variables = z.infer<typeof variablesSchema>;

export type Layer = {
  id: string;
  type: LayerType;
  name?: string;
  box: Box;
  opacity?: number;
  visible?: boolean;
  blend?: (typeof BLEND)[number];
  languages?: string[];
  extensions?: Record<string, unknown>;
  fills?: Paint[];
  strokes?: Stroke[];
  effects?: Effect[];
  animations?: Animation[];
  motion?: Motion;
  mask?: Mask;
  geometry?: Geometry;
  corners?: number | number[];
  text?: TextBlock;
  image?: ImageBlock;
  a11y?: { alt?: Record<string, string>; decorative?: boolean };
  interaction?: Interaction;
  lottie?: { src?: string; loop?: boolean };
  children?: Layer[];
};

export type OimDocument = Omit<z.infer<typeof documentSchema>, "layers"> & { layers: Layer[] };
