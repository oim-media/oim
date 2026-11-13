/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { permissionOf } from "../../reeditPermission.js";
import { DOCUMENT_VERSION, type OimDocument } from "../schema.js";
import { asObject, type UpgradeContext, type V1Object } from "./context.js";

/** Fallback when a 1.x file declares no canvas: the base the core has always assumed. */
const DEFAULT_CANVAS = 800;

// A converted document is not a signed one: it is signed again as 2.0, so the
// signature of the 1.x bytes and everything that travelled with it is dropped.
const TRANSPORT_KEYS = ["signature", "key_version", "signed_at", "timestamp", "image_hash", "image_hash_alg"];

// Root keys with no place in 2.0: superseded, never read, or about the video format.
const RETIRED_ROOT_KEYS = [
  "version",
  "min_player",
  "image",
  "media_type",
  "allowed_domains",
  "terms_accepted",
  "redirect_membership_verified",
  "capabilities",
  "capabilities_required",
];

export function canvasOf(meta: V1Object): { width: number; height: number } {
  const canvas = asObject(meta.canvas) ?? {};
  const positive = (value: unknown) => (typeof value === "number" && value > 0 ? value : undefined);
  const width = positive(canvas.natural_width) ?? positive(canvas.width) ?? DEFAULT_CANVAS;
  const height = positive(canvas.natural_height) ?? positive(canvas.height) ?? width;
  return { width, height };
}

export function languagesOf(meta: V1Object): string[] {
  for (const key of ["languages", "lang"]) {
    const list = meta[key];
    if (Array.isArray(list)) {
      const clean = list.filter((l): l is string => typeof l === "string" && l.length > 0);
      if (clean.length > 0) return [...new Set(clean)];
    }
  }
  return ["es"];
}

/** Every colour role some palette of the document defines. */
export function rolesOf(meta: V1Object): Set<string> {
  const roles = new Set<string>();
  for (const palette of Object.values(asObject(meta.palettes) ?? {})) {
    for (const role of Object.keys(asObject(palette) ?? {})) roles.add(role);
  }
  return roles;
}

/** The 2.0 document without its layers, and the 1.x list the layers come from. */
export function convertRoot(ctx: UpgradeContext, meta: V1Object): { document: OimDocument; slots: unknown[] } {
  const document: OimDocument = {
    oim: DOCUMENT_VERSION,
    canvas: ctx.canvas,
    languages: languagesOf(meta),
    layers: [],
  };
  for (const key of ["oim", "canvas", "languages", "lang"]) ctx.take(meta, key);

  const id = ctx.take(meta, "oim_id");
  if (typeof id === "string" && id) document.id = id;
  const name = ctx.take(meta, "name");
  if (typeof name === "string" && name) document.name = name;

  // `reedit` wins over the lock; an unknown value never loosens the permission.
  if (meta.reedit !== undefined || meta.immutable_lock !== undefined) document.reedit = permissionOf(meta);
  ctx.take(meta, "reedit");
  ctx.take(meta, "immutable_lock");

  const description = asObject(ctx.take(meta, "description"));
  if (description && Object.keys(description).length > 0) document.description = description as Record<string, string>;

  const fonts = ctx.take(meta, "fonts");
  if (Array.isArray(fonts) && fonts.length > 0) document.fonts = fonts as OimDocument["fonts"];

  for (const key of TRANSPORT_KEYS) ctx.retire(meta, key);
  for (const key of RETIRED_ROOT_KEYS) ctx.retire(meta, key);

  let slots: unknown[] = [];
  for (const key of ["slots", "elements", "layers"]) {
    const list = ctx.take(meta, key);
    if (slots.length === 0 && Array.isArray(list)) slots = list;
  }
  return { document, slots };
}
