/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// A pure port of the backend's `/v1/oim/compile` (apps/backend/src/routers/media.py and core/canonizar.py).
// Clients used to POST raw pixel slots there and get 1.x back; now they build the document themselves.

import { CONTRACT_VERSION } from "../compatibility.js";
import { MAX_SLOTS } from "../limits.js";
import { permissionOf } from "../reeditPermission.js";
import { upgrade, type UpgradeResult } from "./upgrade.js";

type Json = Record<string, unknown>;

/** A shallow copy without the `undefined` values: a key set to undefined is absent in the JSON the backend read. */
const defined = (o: Json): Json => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

// Pure duplicates: two names, one meaning.
const RENAMES: Record<string, string> = { size: "fontSize", font: "fontFamily", color: "fillColor" };

// Boolean shortcuts and the full key they stand for: [key, when true, when false].
const SHORTCUTS: Record<string, [string, unknown, unknown]> = {
  bold: ["fontWeight", 700, 400],
  italic: ["fontStyle", "italic", "normal"],
  underline: ["textDecoration", "underline", "none"],
};

/**
 * The style with one name per concept. Does not mutate its input.
 * When both forms arrive the full one wins: it can say anything the shortcut can, never the reverse.
 */
export function canonizeStyle(style: Json | null | undefined): Json {
  if (!style) return {};
  const out: Json = defined(style);

  for (const [alias, canonical] of Object.entries(RENAMES)) {
    if (alias in out) {
      const value = out[alias];
      delete out[alias];
      if (!(canonical in out)) out[canonical] = value;
    }
  }
  for (const [alias, [canonical, yes, no]] of Object.entries(SHORTCUTS)) {
    if (alias in out) {
      const value = out[alias];
      delete out[alias];
      if (!(canonical in out)) out[canonical] = value ? yes : no;
    }
  }
  if ("fontSizeOverrides" in out) {
    const overrides = out.fontSizeOverrides;
    delete out.fontSizeOverrides;
    if (overrides && typeof overrides === "object" && !Array.isArray(overrides)) {
      out.fontSizes = { ...(overrides as Json), ...((out.fontSizes as Json | undefined) ?? {}) };
    }
  }
  return out;
}

/** A slot as the editors hold it: measures in pixels. Aliases (`raw_px`, `x`, `width`, `font_size`) are read like the backend does. */
export type RawSlot = Json & { id: string };

export type CompileInput = {
  canvas_width: number;
  canvas_height: number;
  slots_raw: RawSlot[];
  oim_id?: string;
  reedit?: string;
  /** Legacy name of `reedit`. */
  reedicion?: string;
  immutable_lock?: boolean;
  min_player?: string;
  capabilities?: string[];
  description?: Record<string, string>;
  palettes?: Record<string, Record<string, string | null>>;
  defaultPalette?: string;
  fonts?: unknown[];
  /** 1.x root fields that never went through compile (background, name, languages): copied as they are before `upgrade`. */
  passthrough?: Json;
};

// The twelve dynamic colour roles and the name rule of core's dynamic-colors.ts.
const PALETTE_NAME = /^[a-z][a-z0-9-]{0,23}$/;
const PALETTE_ROLES = new Set([
  "primary", "on-primary", "secondary", "on-secondary", "surface", "on-surface",
  "outline", "accent", "text-primary", "text-secondary", "text-muted", "text-on-accent",
]);

/** Python truthiness, which the backend's `if value:` checks lean on. */
const truthy = (v: unknown): boolean =>
  !(
    v === undefined || v === null || v === false || v === 0 || v === "" ||
    (Array.isArray(v) && v.length === 0) ||
    (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0)
  );

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const own = <T>(v: T): T => (v === undefined ? v : structuredClone(v));

/** Python's `round(n, 4)`: correctly rounded, and exact ties go to the even digit. */
function round4(n: number): number {
  const scaled = n * 32;
  if (Number.isInteger(scaled) && scaled % 2 !== 0) {
    // n = odd/32 is the only way to sit exactly between two 4-decimal values.
    const lower = Math.floor(n * 10000);
    return (lower % 2 === 0 ? lower : lower + 1) / 10000;
  }
  return Number(n.toFixed(4));
}

/** Python prints a float with its point: `10.0`, not `10`. Both are valid CSS; parity wants the same text. */
const pyFloat = (r: number): string => (Object.is(r, -0) ? "-0.0" : Number.isInteger(r) ? `${r}.0` : `${r}`);

const ALIASED_IN_RAW_PX = [
  "x_px", "y_px", "width_px", "height_px", "font_size_px", "align", "border_radius_px", "letter_spacing_px",
  "stroke_width_px", "stroke_color", "font_sizes_px", "is_auto_width", "shadows_raw_px", "blur_raw_px",
];

/** The slot with its alias keys resolved, as the backend's `RawSlot` validator does before reading it. */
function withAliases(data: Json): Json {
  const slot: Json = defined(data);
  if (isObject(slot.raw_px)) {
    for (const key of ALIASED_IN_RAW_PX) if (key in slot.raw_px && !(key in slot)) slot[key] = slot.raw_px[key];
  }
  for (const [alias, key] of [["x", "x_px"], ["y", "y_px"], ["width", "width_px"], ["height", "height_px"], ["font_size", "font_size_px"]]) {
    if (alias in slot && !(key in slot)) slot[key] = slot[alias];
  }
  return slot;
}

function validate(input: Json): void {
  for (const name of ["canvas_width", "canvas_height"]) {
    const v = input[name];
    if (typeof v !== "number" || !(v > 0 && v <= 16384)) throw new Error(`${name} must be a number greater than 0 and at most 16384 (canvas)`);
  }
  if (!Array.isArray(input.slots_raw)) throw new Error("slots_raw must be an array");
  if (input.slots_raw.length > MAX_SLOTS) throw new Error(`Máximo ${MAX_SLOTS} slots permitidos`);
  if (input.palettes === undefined || input.palettes === null) return;
  const entries = Object.entries(input.palettes as Json);
  if (entries.length > 6) throw new Error("At most 6 palettes per document");
  for (const [name, colors] of entries) {
    if (!PALETTE_NAME.test(name)) throw new Error(`Invalid palette name: '${name}'`);
    for (const [role, color] of Object.entries(colors as Json)) {
      if (!PALETTE_ROLES.has(role)) throw new Error(`Unknown palette role: '${role}'`);
      if (typeof color === "string" && color.length > 128) throw new Error("Palette colour too long");
    }
  }
}

/**
 * Raw pixel slots to the 1.x metadata the backend's `/compile` returns, minus `timestamp`.
 *
 * `round: true` rounds every measure to four decimals and prints it the way Python does: the
 * output the backend gives, for parity checks. `round: false` keeps the full precision, so
 * `upgrade` rebuilds the pixels without the error that rounding adds. Does not check accounts
 * or policies: that is the server's job when it signs.
 */
export function compileRaw(request: CompileInput, opts: { round?: boolean } = {}): Json {
  const round = opts.round ?? false;
  const input: Json = defined(request as unknown as Json);
  if ("width" in input && !("canvas_width" in input)) input.canvas_width = input.width;
  if ("height" in input && !("canvas_height" in input)) input.canvas_height = input.height;
  if ("slots" in input && !("slots_raw" in input)) input.slots_raw = input.slots;
  validate(input);

  const w = input.canvas_width as number;
  const h = input.canvas_height as number;
  const rnd = (n: number): number => (round ? round4(n) : n);
  const cqw = (n: number): string => `${round ? pyFloat(round4(n)) : n}cqw`;
  const pct = (px: number): number => (px / w) * 100;

  const slots = (input.slots_raw as Json[]).map((data) => {
    const s = withAliases(data);
    const type = s.type === undefined ? "text" : (s.type as string | null);
    const scaleWidth = Math.max(0, pct(num(s.width_px)));
    const scaleHeight = Math.max(0, pct(num(s.height_px)));

    const style = canonizeStyle(isObject(s.style) ? own(s.style) : undefined);
    style.width = cqw(scaleWidth);
    style.height = cqw(scaleHeight);

    // Size and wrap are typography: only layers that set text carry them.
    const setsText = type === "text" || type === "artistic-text";
    if (!setsText) {
      delete style.maxWidth;
      delete style.textAlign;
    // An auto-width text grows with its words: its cap is the canvas. "none" read as no width at all,
    // and a player then capped the text at 80 % of the canvas, wrapping a word its box was made to hold.
    } else if (truthy(s.is_auto_width)) style.maxWidth = cqw(100);
    else if (!("maxWidth" in style)) style.maxWidth = cqw(scaleWidth * 1.1);

    const fontSize = typeof s.font_size_px === "number" ? s.font_size_px : undefined;
    if (setsText && fontSize !== undefined && fontSize > 0) style.fontSize = cqw(Math.max(0.1, Math.min(50, pct(fontSize))));

    if (isObject(s.font_sizes_px) && truthy(s.font_sizes_px)) {
      if (!("fontSizes" in style)) style.fontSizes = {};
      for (const [lang, px] of Object.entries(s.font_sizes_px)) {
        if (typeof px === "number" && px > 0) (style.fontSizes as Json)[lang] = cqw(Math.max(0.1, Math.min(50, pct(px))));
      }
    }

    const radius = s.border_radius_px;
    if (typeof radius === "number") {
      if (radius) style.borderRadius = cqw(pct(radius)); // square corners are the default: nothing to write
    } else if (isObject(radius)) {
      const corner = (k: string): string => cqw(pct(num(radius[k])));
      style.borderRadius = `${corner("topLeft")} ${corner("topRight")} ${corner("bottomRight")} ${corner("bottomLeft")}`;
    }

    const spacing = typeof s.letter_spacing_px === "number" ? s.letter_spacing_px : undefined;
    if (spacing !== undefined && spacing !== 0) style.letterSpacing = cqw(pct(spacing));

    const strokeWidth = typeof s.stroke_width_px === "number" ? s.stroke_width_px : undefined;
    if (strokeWidth !== undefined && strokeWidth > 0 && truthy(s.stroke_color)) {
      if (type === "text") style["-webkit-text-stroke"] = `${cqw(pct(strokeWidth))} ${s.stroke_color}`;
      else style.border = `${cqw(pct(strokeWidth))} solid ${s.stroke_color}`;
    }

    const blur = typeof s.blur_raw_px === "number" ? s.blur_raw_px : undefined;
    if (blur !== undefined && blur > 0) style.filter = `blur(${cqw(pct(blur))})`;

    if (Array.isArray(s.shadows_raw_px) && s.shadows_raw_px.length > 0) {
      const parts = (s.shadows_raw_px as Json[]).map((sd) => {
        const inset = truthy(sd.inset) && type !== "text" ? " inset" : "";
        const color = truthy(sd.color) ? sd.color : "rgba(0,0,0,0.5)";
        return `${cqw(pct(num(sd.offsetX)))} ${cqw(pct(num(sd.offsetY)))} ${cqw(pct(num(sd.blur)))} ${color}${inset}`;
      });
      style[type === "text" ? "textShadow" : "boxShadow"] = parts.join(", ");
    }

    // The position is clamped to the canvas, as the backend always did (a separate decision if that should go).
    const slot: Json = {
      id: s.id,
      type,
      position: [rnd(Math.max(0, Math.min(100, pct(num(s.x_px))))), rnd(Math.max(0, Math.min(100, (num(s.y_px) / h) * 100)))],
      style,
    };
    if (truthy(s.content)) slot.content = own(s.content);
    if (truthy(s.name)) slot.name = s.name;
    const align = s.align === undefined ? "center" : s.align;
    if (truthy(align)) slot.align = align;
    if (truthy(s.width_px)) slot.width_px = s.width_px;
    if (truthy(s.height_px)) slot.height_px = s.height_px;
    if (truthy(s.zone_id)) slot.zone_id = s.zone_id;
    if (truthy(s.interaction)) slot.interaction = own(s.interaction);
    return slot;
  });

  const permission = permissionOf({ reedit: input.reedit, reedicion: input.reedicion, immutable_lock: input.immutable_lock });
  const palettes = input.palettes as Json | undefined | null;
  const metadata: Json = {
    oim: CONTRACT_VERSION,
    media_type: "image",
    oim_id: input.oim_id || `oim_${globalThis.crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
    reedit: permission,
    immutable_lock: permission === "sealed",
    canvas: { natural_width: w, natural_height: h },
    min_player: input.min_player,
    capabilities: own(input.capabilities),
    description: own(input.description),
    palettes: own(palettes),
    // defaultPalette only when it names one of the palettes sent.
    defaultPalette: palettes && typeof input.defaultPalette === "string" && input.defaultPalette in palettes ? input.defaultPalette : undefined,
    fonts: truthy(input.fonts) ? own(input.fonts) : undefined,
    slots,
  };
  for (const key of Object.keys(metadata)) if (metadata[key] === undefined || metadata[key] === null) delete metadata[key];
  return metadata;
}

/**
 * Raw pixel slots to a 2.0 document, without the network.
 *
 * `upgrade(compileRaw(input))` with the measures unrounded, so the pixels come back as the author
 * sent them. What `compileRaw` produced wins over `passthrough`, the same rule the editor applied
 * when it pasted the root fields that never went through the backend.
 */
export function rawToDocument(input: CompileInput): UpgradeResult {
  return upgrade({ ...input.passthrough, ...compileRaw(input, { round: false }) });
}
