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
  width: number;          // Ancho real del lienzo del proyecto
  height: number;         // Alto real
  bleed: number;          // Sangrado en unidades de usuario (default 1)
  rng: Rng;               // Flujo determinista mulberry32
  defs: DefsRegistry;     // Deduplicación de gradientes y filtros
  ramp: (i: number, total: number) => string; // Color de la capa i
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
 * La entrada de `renderGenerativeSVG`.
 *
 * Todo es opcional menos `generatorId` a proposito. Este objeto no lo construye
 * el codigo: llega de una fila persistida, asi que puede ser parcial o venir de
 * una version anterior del esquema. El motor ya lo trata asi -lee `config.params
 * ?` y `config.colors?.mode`-, y este tipo hace que esas guardas dejen de
 * contradecir la firma.
 *
 * El `GenerativeBackground` del editor, con todos los campos presentes, es
 * asignable a esto por tipado estructural.
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
