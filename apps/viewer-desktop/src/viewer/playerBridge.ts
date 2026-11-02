/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OimPlayer, type OimPlayerInstance, type OimSecurityStatus } from "@oim-media/player-oim";
import {
  isSafeCssColor,
  isValidDynamicColorRole,
  permissionOf,
  type ReeditPermission,
} from "@oim-media/core";

export type ViewerSecurityStatus = OimSecurityStatus | "domain_blocked";

export interface StageSize {
  width: number;
  height: number;
}

export interface OimSpecsSummary {
  fileName: string;
  fileSizeFormatted: string;
  dimensionsLabel: string;
  schemaVersion: string;
  slotsCount: number;
  slotTypes: Record<string, number>;
  reeditPolicy: ReeditPermission;
  palettes: string[];
  defaultPalette: string | null;
}

export interface PlayerInstance {
  element: OimPlayerInstance;
  play: () => void;
  pause: () => void;
  setLang: (lang: string) => void;
  getCurrentLang: () => string;
  getLanguages: () => string[];
  setAutoRotateLang: (enabled: boolean) => void;
  setPalette: (paletteName: string | null) => void;
  toggleSlots: (show: boolean) => void;
  getMetadata: () => any;
  getSecurityStatus: () => ViewerSecurityStatus;
  destroy: () => void;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Width and height from the PNG IHDR chunk (bytes 16..24), or null if not a PNG. */
export function pngSize(bytes: Uint8Array): StageSize | null {
  if (bytes.length < 24) return null;
  if (!PNG_SIGNATURE.every((b, i) => bytes[i] === b)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  return width > 0 && height > 0 ? { width, height } : null;
}

export function formatFileSize(bytes: number): string {
  if (!bytes || Number.isNaN(bytes) || bytes <= 0) return "0 KB";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/**
 * Extracts valid named palettes defined in `metadata.palettes` (contract 1.20.0+),
 * validating roles and CSS colors through `@oim-media/core`.
 */
export function extractPaletteNames(metadata: Record<string, unknown> | null | undefined): string[] {
  const raw =
    metadata && typeof metadata.palettes === "object" && metadata.palettes !== null
      ? (metadata.palettes as Record<string, unknown>)
      : null;
  if (!raw) return [];

  const names: string[] = [];
  for (const [name, entry] of Object.entries(raw)) {
    if (!name || typeof entry !== "object" || entry === null) continue;
    const hasSafeColor = Object.entries(entry as Record<string, unknown>).some(
      ([role, val]) => isValidDynamicColorRole(role) && typeof val === "string" && isSafeCssColor(val)
    );
    if (hasSafeColor) names.push(name);
  }
  return names;
}

/**
 * Builds the technical specifications summary directly from the parsed metadata
 * and `@oim-media/core` helpers, avoiding duplicate contract logic in the UI.
 */
export function buildSpecsSummary(
  metadata: Record<string, unknown> | null | undefined,
  fileName: string,
  fileSizeBytes: number,
  stageSize: StageSize | null
): OimSpecsSummary {
  const slots = metadata && Array.isArray(metadata.slots) ? metadata.slots : [];
  const slotTypes: Record<string, number> = {};
  for (const rawSlot of slots) {
    const slot = (rawSlot && typeof rawSlot === "object" ? rawSlot : {}) as Record<string, unknown>;
    const type = typeof slot.type === "string" ? slot.type : "text";
    slotTypes[type] = (slotTypes[type] || 0) + 1;
  }

  const canvas =
    metadata && typeof metadata.canvas === "object" && metadata.canvas !== null
      ? (metadata.canvas as Record<string, unknown>)
      : null;
  const width =
    (typeof metadata?.width === "number" && metadata.width) ||
    (typeof canvas?.natural_width === "number" && canvas.natural_width) ||
    stageSize?.width ||
    null;
  const height =
    (typeof metadata?.height === "number" && metadata.height) ||
    (typeof canvas?.natural_height === "number" && canvas.natural_height) ||
    stageSize?.height ||
    null;

  const palettes = extractPaletteNames(metadata);
  const defaultPalette =
    typeof metadata?.defaultPalette === "string" && palettes.includes(metadata.defaultPalette)
      ? metadata.defaultPalette
      : null;

  return {
    fileName,
    fileSizeFormatted: formatFileSize(fileSizeBytes),
    dimensionsLabel: width && height ? `${width} × ${height} px` : "Responsive",
    schemaVersion: String(metadata?.oim ?? metadata?.version ?? "1.0"),
    slotsCount: slots.length,
    slotTypes,
    reeditPolicy: permissionOf((metadata ?? {}) as { reedit?: unknown; reedicion?: unknown }),
    palettes,
    defaultPalette,
  };
}

export function mountOimPlayer(
  container: HTMLElement,
  source: Blob | string,
  options?: {
    onLoaded?: (meta: any, security: ViewerSecurityStatus, player: PlayerInstance) => void;
    onLangChange?: (lang: string) => void;
    onError?: (err: any, security: ViewerSecurityStatus) => void;
  }
): PlayerInstance {
  const playerEl = OimPlayer.mount(container, source, {
    allowZoom: true,
    showLanguageSelector: false,
    showSlots: true,
    fit: "contain",
    align: "center",
    allowLottie: true,
    allowDynamicColors: true,
  });

  if (!playerEl) {
    throw new Error("Could not mount <oim-player> into container");
  }

  playerEl.setAttribute("mode", "full");
  playerEl.setAttribute("fit", "contain");
  playerEl.setAttribute("align", "center");
  playerEl.setAttribute("allow-zoom", "true");
  playerEl.setAttribute("allow-lottie", "true");

  const instance: PlayerInstance = {
    element: playerEl,
    play: () => playerEl.play(),
    pause: () => playerEl.pause(),
    setLang: (lang: string) => playerEl.setLang(lang),
    getCurrentLang: () => playerEl.currentLang || "es",
    getLanguages: () => (playerEl.languages || []).filter((l) => l && l !== "*"),
    setAutoRotateLang: (enabled: boolean) => {
      if (enabled) {
        playerEl.setAttribute("auto-rotate-lang", "3000");
      } else {
        playerEl.removeAttribute("auto-rotate-lang");
      }
    },
    setPalette: (paletteName: string | null) => {
      if (paletteName) {
        playerEl.setAttribute("palette", paletteName);
      } else {
        playerEl.removeAttribute("palette");
      }
    },
    toggleSlots: (show: boolean) => {
      playerEl.setAttribute("show-slots", show ? "true" : "false");
    },
    getMetadata: () => playerEl.getMetadata(),
    getSecurityStatus: () => (playerEl.getSecurityStatus() || "unsigned") as ViewerSecurityStatus,
    destroy: () => playerEl.destroy(),
  };

  playerEl.addEventListener("oim:loaded", ((e: CustomEvent) => {
    const meta = e.detail?.metadata ?? playerEl.getMetadata();
    const security = (e.detail?.security ?? playerEl.getSecurityStatus() ?? "unsigned") as ViewerSecurityStatus;
    options?.onLoaded?.(meta, security, instance);
  }) as EventListener);

  playerEl.addEventListener("oim:langchange", ((e: CustomEvent) => {
    if (e.detail?.lang) {
      options?.onLangChange?.(String(e.detail.lang).toLowerCase());
    }
  }) as EventListener);

  playerEl.addEventListener("error", ((e: CustomEvent) => {
    const msg = String(e.detail?.message ?? e.detail ?? "");
    let security: ViewerSecurityStatus = "corrupt";
    if (msg.startsWith("OIM_ALTERED")) {
      security = msg.includes("image_mismatch") ? "image_mismatch" : "invalid_signature";
    } else if (msg.includes("no_metadata")) {
      security = "no_metadata";
    }
    options?.onError?.(e.detail, security);
  }) as EventListener);

  return instance;
}
