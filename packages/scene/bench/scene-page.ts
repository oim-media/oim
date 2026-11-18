/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// The page the visual gate (`parity:scene`) opens for each vector. It does what a
// host does: reads the file, upgrades a 1.x one, resolves the references, paints
// the base picture behind the layers, then mounts the scene. Output is read back
// through `window.__oimSettled` and `window.__oimSkip`.
import { extractOIM } from "@oim-media/core";
import { hasBaseLayer, isV2, resolveRefs, upgrade, type OimDocument } from "@oim-media/core/v2";
import { unsupportedUse } from "../src/coverage.js";
import { mount } from "../src/index.js";

declare global {
  interface Window {
    __oimSettled?: "loaded" | "skipped" | "error";
    __oimSkip?: string[];
  }
}

async function run(): Promise<void> {
  const host = document.getElementById("host")!;
  try {
    const { metadata, image } = await extractOIM(await (await fetch(host.dataset.src!)).blob());
    const { document } = resolveRefs(isV2(metadata) ? (metadata as OimDocument) : upgrade(metadata).document);
    window.__oimSkip = unsupportedUse(document);
    if (window.__oimSkip.length) {
      window.__oimSettled = "skipped";
      return;
    }
    if (hasBaseLayer(document)) host.style.background = `url(${URL.createObjectURL(image)}) 0 0 / 100% 100% no-repeat`;
    // Paused, as the player is painted with disable-animations: the golden is the resting frame.
    mount(host, document, { paused: true });
    window.__oimSettled = "loaded";
  } catch (err) {
    console.error(err);
    window.__oimSettled = "error";
  }
}

void run();
