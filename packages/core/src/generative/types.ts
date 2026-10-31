/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Rng {
  next(): number; // 0..1
  range(min: number, max: number): number;
  pick<T>(items: T[]): T;
}

export interface DefsRegistry {
  registerLinearGradient(stops: Array<{ offset: number; color: string; opacity?: number }>, x1?: string, y1?: string, x2?: string, y2?: string): string;
  registerRadialGradient(stops: Array<{ offset: number; color: string; opacity?: number }>, cx?: string, cy?: string, r?: string): string;
  registerBlur(px: number): string;
  registerGrain(intensidad: number): string;
  serialize(): string;
}

export interface RenderContext {
  width: number;          // Real width of the project canvas
  height: number;         // Real height
  bleed: number;          // Bleed in user units (default 1)
  rng: Rng;               // Deterministic mulberry32 stream
  defs: DefsRegistry;     // Gradient and filter deduplication
  ramp: (i: number, total: number) => string; // Color of layer i
}

export type PrimitiveName = 
  | 'layer-stack'
  | 'scatter'
  | 'blob'
  | 'mesh'
  | 'radial'
  | 'gradient'
  | 'iso-grid';

export type Primitive = (params: Record<string, unknown>, ctx: RenderContext) => string;

export interface ParamOption {
  value: string;
  label: { es: string; en: string };
  icon?: string;
}

export interface ParamSchema {
  key: string;
  kind: 'range' | 'enum' | 'toggle';
  group: 'VARIANTS' | 'DIRECTION' | 'COLOR' | 'SHAPE';
  label: { es: string; en: string };
  min?: number;
  max?: number;
  step?: number;
  options?: ParamOption[];
  default: number | string | boolean;
}

export interface GenerativeLayer {
  primitive: PrimitiveName;
  fixed: Record<string, unknown>;
  blend?: 'normal' | 'screen' | 'multiply' | 'overlay' | 'soft-light' | 'lighten' | 'darken';
  opacidad?: number;    // 0-1
  desenfoque?: number;  // px
}

export interface GeneratorSpec {
  id: string;
  layers: GenerativeLayer[];
  schema: ParamSchema[];
  grano?: { intensidad: number };  // 0-1
}

/**
 * The input of `renderGenerativeSVG`.
 *
 * Everything is optional except `generatorId`, on purpose. This object is not built
 * by the code: it arrives from a persisted row, so it may be partial or come from an
 * older schema version. The engine already treats it that way (it reads `config.params
 * ?` and `config.colors?.mode`), and this type stops those guards from
 * contradicting the signature.
 *
 * The editor's `GenerativeBackground`, with all fields present, is assignable to this
 * by structural typing.
 */
export interface GenerativeConfig {
  generatorId: string;
  seed?: number;
  params?: Record<string, number | string | boolean>;
  colors?: {
    mode?: 'monochrome' | 'palette';
    stops?: string[];
    direction?: 'forward' | 'reverse' | 'radial';
    background?: string;
    backgroundVisible?: boolean;
  };
}
