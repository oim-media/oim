/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ImageBlock } from "@oim-media/core/v2";

/**
 * The picture an image layer shows in one language, or undefined when it shows
 * none: the file's own base picture (the page paints it behind the layers), an
 * empty picture, or a reference that was not resolved. Only a picture carried by
 * the file is painted, never a network address.
 */
export function pictureOf(image: Pick<ImageBlock, "src"> | undefined, lang: string): string | undefined {
  const src = image?.src;
  if (src === undefined || typeof src !== "string" && (!("value" in src) || typeof src.value !== "string")) return undefined;
  const picked = typeof src === "string" ? src : src.modes?.[lang] ?? src.value;
  if (!picked || picked === "oim:base" || !picked.startsWith("data:image/")) return undefined;
  return picked;
}
