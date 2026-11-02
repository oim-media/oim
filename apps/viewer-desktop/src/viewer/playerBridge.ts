/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OimPlayer, type OimPlayerInstance, type OimSecurityStatus } from "@oim-media/player-oim";
import {
  DYNAMIC_COLOR_ROLES,
  isSafeCssColor,
  isValidDynamicColorRole,
  permissionOf,
  type DynamicColorRole,
  type ReeditPermission,
} from "@oim-media/core";

export type ViewerSecurityStatus = OimSecurityStatus | "domain_blocked";

export interface StageSize {
  width: number;
  height: number;
}

export interface ColorRoleEntry {
  role: DynamicColorRole;
  authorColor: string | null;
}

export interface SuggestedPalette {
  id: string;
  /** [es, en] */
  name: [string, string];
  colors: Partial<Record<DynamicColorRole, string>>;
}

export interface PalettePreviewData {
  colorRoles: ColorRoleEntry[];
  palettes: SuggestedPalette[];
  available: boolean;
}

export interface OimCapabilities {
  hasLanguages: boolean;
  languages: string[];
  hasLottie: boolean;
  hasDynamicColors: boolean;
  dynamicColorRoles: string[];
  hasAnimations: boolean;
  hasParallax: boolean;
  slotsCount: number;
  slotTypes: Record<string, number>;
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
  capabilities: OimCapabilities;
  palettePreview: PalettePreviewData;
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
  applyPaletteColors: (colors: Partial<Record<DynamicColorRole, string>> | null, authorPaletteName?: string | null) => void;
  setAllowLottie: (enabled: boolean) => void;
  setDisableAnimations: (disabled: boolean) => void;
  toggleSlots: (show: boolean) => void;
  getMetadata: () => any;
  getSecurityStatus: () => ViewerSecurityStatus;
  destroy: () => void;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const ROLE_FIELDS: ReadonlyArray<readonly [string, string]> = [
  ["fillColorRole", "fillColor"],
  ["colorRole", "fillColor"],
  ["strokeColorRole", "strokeColor"],
  ["textStrokeColorRole", "textStrokeColor"],
  ["effectColorRole", "effectColor"],
  ["maskBgColorRole", "maskBgColor"],
  ["maskStrokeColorRole", "maskStrokeColor"],
  ["shadowColorRole", "shadowColor"],
  ["backgroundPatternColorRole", "backgroundPatternColor"],
  ["backgroundPatternBgColorRole", "backgroundPatternBgColor"],
  ["fillPatternColorRole", "fillPatternColor"],
  ["fillPatternBgColorRole", "fillPatternBgColor"],
];

const HUE_TURNS = [60, 120, 180, 240];

type Hsl = [number, number, number];

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

export function toPickerHex(color: string | null | undefined): string {
  if (!color) return "#000000";
  const c = color.trim().toLowerCase();
  let m = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/.exec(c);
  if (m) return `#${m[1]}`;
  m = /^#([0-9a-f])([0-9a-f])([0-9a-f])[0-9a-f]?$/.exec(c);
  if (m) return `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`;
  m = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/.exec(c);
  if (m) {
    return "#" + [m[1], m[2], m[3]].map((n) => Math.min(255, Number(n)).toString(16).padStart(2, "0")).join("");
  }
  return "#000000";
}

function hexToHsl(color: string): Hsl | null {
  const hex = toPickerHex(color);
  if (hex === "#000000" && !/^(#0{3,8}|rgba?\(\s*0\s*,\s*0\s*,\s*0)/i.test(color.trim())) return null;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r
      ? ((g - b) / d + (g < b ? 6 : 0)) * 60
      : max === g
        ? ((b - r) / d + 2) * 60
        : ((r - g) / d + 4) * 60;
  return [h, s, l];
}

function hslToHex([h, s, l]: Hsl): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return "#" + [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
}

export function collectColorRoles(metadata: Record<string, unknown> | null | undefined): ColorRoleEntry[] {
  const slots = metadata && Array.isArray(metadata.slots) ? metadata.slots : [];
  const byRole = new Map<DynamicColorRole, ColorRoleEntry>();

  for (const slot of slots) {
    const style = (slot as { style?: unknown } | null)?.style;
    if (!style || typeof style !== "object") continue;
    const st = style as Record<string, unknown>;
    for (const [roleField, colorField] of ROLE_FIELDS) {
      const role = st[roleField];
      if (!isValidDynamicColorRole(role)) continue;
      const color = st[colorField];
      const safe = typeof color === "string" && isSafeCssColor(color) ? color : null;
      const known = byRole.get(role);
      if (!known) byRole.set(role, { role, authorColor: safe });
      else if (!known.authorColor && safe) known.authorColor = safe;
    }

    if (Array.isArray(st.effects)) {
      for (const eff of st.effects) {
        if (!eff || typeof eff !== "object") continue;
        const e = eff as Record<string, unknown>;
        const role = e.colorRole;
        if (!isValidDynamicColorRole(role)) continue;
        const color = e.color;
        const safe = typeof color === "string" && isSafeCssColor(color) ? color : null;
        const known = byRole.get(role);
        if (!known) byRole.set(role, { role, authorColor: safe });
        else if (!known.authorColor && safe) known.authorColor = safe;
      }
    }
  }

  // Also include roles declared in metadata.palettes so author palettes always render swatches
  const rawPalettes =
    metadata && typeof metadata.palettes === "object" && metadata.palettes !== null
      ? (metadata.palettes as Record<string, unknown>)
      : null;
  if (rawPalettes) {
    for (const rawColors of Object.values(rawPalettes)) {
      if (!rawColors || typeof rawColors !== "object") continue;
      for (const [role, val] of Object.entries(rawColors as Record<string, unknown>)) {
        if (isValidDynamicColorRole(role) && typeof val === "string" && isSafeCssColor(val)) {
          if (!byRole.has(role)) {
            byRole.set(role, { role, authorColor: val.trim() });
          }
        }
      }
    }
  }

  return [...byRole.values()];
}

export function suggestPalettes(entries: ColorRoleEntry[]): SuggestedPalette[] {
  const parsed = entries
    .map((e) => ({ role: e.role, hsl: e.authorColor ? hexToHsl(e.authorColor) : null }))
    .filter((e): e is { role: DynamicColorRole; hsl: Hsl } => e.hsl !== null);

  const build = (map: (c: Hsl) => Hsl) =>
    Object.fromEntries(parsed.map(({ role, hsl }) => [role, hslToHex(map(hsl))]));

  return [
    { id: "original", name: ["Original", "Original"], colors: {} },
    ...HUE_TURNS.map((deg) => ({
      id: `hue-${deg}`,
      name: [`Tono +${deg}°`, `Hue +${deg}°`] as [string, string],
      colors: build(([h, s, l]) => [(h + deg) % 360, s, l]),
    })),
    { id: "mono", name: ["Monocromo", "Monochrome"], colors: build(([, , l]) => [0, 0, l]) },
  ];
}

export function extractAuthorPalettes(
  metadata: Record<string, unknown> | null | undefined
): SuggestedPalette[] {
  const rawPalettes =
    metadata && typeof metadata.palettes === "object" && metadata.palettes !== null
      ? (metadata.palettes as Record<string, unknown>)
      : null;
  if (!rawPalettes) return [];

  const result: SuggestedPalette[] = [];
  for (const [paletteName, rawColors] of Object.entries(rawPalettes)) {
    if (!paletteName || typeof rawColors !== "object" || rawColors === null) continue;
    const colors: Partial<Record<DynamicColorRole, string>> = {};
    for (const [role, val] of Object.entries(rawColors as Record<string, unknown>)) {
      if (isValidDynamicColorRole(role) && typeof val === "string" && isSafeCssColor(val)) {
        colors[role] = val.trim();
      }
    }
    if (Object.keys(colors).length > 0) {
      const label = paletteName.charAt(0).toUpperCase() + paletteName.slice(1);
      result.push({
        id: `author:${paletteName}`,
        name: [label, label],
        colors,
      });
    }
  }
  return result;
}

export function buildPalettePreview(
  metadata: Record<string, unknown> | null | undefined
): PalettePreviewData {
  const colorRoles = collectColorRoles(metadata);
  const suggested = suggestPalettes(colorRoles);
  const author = extractAuthorPalettes(metadata);
  const palettes = author.length === 0 ? suggested : [suggested[0], ...author, ...suggested.slice(1)];
  const available = palettes.some((p) => Object.keys(p.colors).length > 0);
  return { colorRoles, palettes, available };
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

export function detectOimCapabilities(
  metadata: Record<string, unknown> | null | undefined
): OimCapabilities {
  if (!metadata || typeof metadata !== "object") {
    return {
      hasLanguages: false,
      languages: [],
      hasLottie: false,
      hasDynamicColors: false,
      dynamicColorRoles: [],
      hasAnimations: false,
      hasParallax: false,
      slotsCount: 0,
      slotTypes: {},
    };
  }

  let langs: string[] = [];
  if (Array.isArray(metadata.lang) && metadata.lang.length > 0) {
    langs = metadata.lang.map(String).filter((l) => l && l !== "*");
  } else if (Array.isArray(metadata.slots)) {
    const langSet = new Set<string>();
    for (const slot of metadata.slots) {
      const s = slot as Record<string, unknown> | null;
      if (s?.content && typeof s.content === "object") {
        Object.keys(s.content).forEach((l) => {
          if (l && l !== "*") langSet.add(l);
        });
      }
    }
    langs = Array.from(langSet);
  }

  const hasLanguages = langs.length > 1;
  const slots: unknown[] = Array.isArray(metadata.slots) ? metadata.slots : [];
  const slotsCount = slots.length;
  const slotTypes: Record<string, number> = {};
  let hasLottie = false;
  let hasAnimations = false;

  for (const rawSlot of slots) {
    const slot = (rawSlot && typeof rawSlot === "object" ? rawSlot : {}) as Record<string, unknown>;
    const type = typeof slot.type === "string" ? slot.type : "text";
    slotTypes[type] = (slotTypes[type] || 0) + 1;

    if (type === "lottie") {
      hasLottie = true;
    }

    const st = (slot.style && typeof slot.style === "object" ? slot.style : {}) as Record<string, unknown>;
    if (
      (typeof st.animationType === "string" && st.animationType !== "none") ||
      (typeof st.textAnimationType === "string" && st.textAnimationType !== "none") ||
      (Array.isArray(slot.keyframes) && slot.keyframes.length > 0) ||
      (typeof st.cssAnimation === "string" && st.cssAnimation !== "none") ||
      type === "lottie"
    ) {
      hasAnimations = true;
    }
  }

  const dynamicColorRoles: string[] = collectColorRoles(metadata).map((e) => e.role);
  const hasDynamicColors = dynamicColorRoles.length > 0;
  const hasParallax = Boolean(
    metadata.parallax ||
      metadata.isParallaxGroup ||
      (Array.isArray(metadata.capabilities) &&
        (metadata.capabilities.includes("infinite_parallax") ||
          metadata.capabilities.includes("vector_parallax"))) ||
      (Array.isArray(metadata.slots) &&
        metadata.slots.some((s: any) => s && (s.parallax?.enabled || s.style?.parallax?.enabled)))
  );

  return {
    hasLanguages,
    languages: langs,
    hasLottie,
    hasDynamicColors,
    dynamicColorRoles,
    hasAnimations,
    hasParallax,
    slotsCount,
    slotTypes,
  };
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
  const capabilities = detectOimCapabilities(metadata);
  const palettePreview = buildPalettePreview(metadata);

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
    slotsCount: capabilities.slotsCount,
    slotTypes: capabilities.slotTypes,
    reeditPolicy: permissionOf((metadata ?? {}) as { reedit?: unknown; reedicion?: unknown }),
    palettes,
    defaultPalette,
    capabilities,
    palettePreview,
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

  playerEl.style.width = "100%";
  playerEl.style.height = "100%";
  playerEl.style.display = "block";

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
      for (const role of DYNAMIC_COLOR_ROLES) {
        playerEl.style.removeProperty(`--oim-color-${role}`);
      }
      if (paletteName) {
        playerEl.setAttribute("palette", paletteName);
      } else {
        playerEl.removeAttribute("palette");
      }
    },
    applyPaletteColors: (colors, authorPaletteName) => {
      for (const role of DYNAMIC_COLOR_ROLES) {
        playerEl.style.removeProperty(`--oim-color-${role}`);
      }
      if (authorPaletteName) {
        playerEl.setAttribute("palette", authorPaletteName);
      } else {
        playerEl.removeAttribute("palette");
      }
      if (colors) {
        for (const [role, color] of Object.entries(colors)) {
          if (color && isValidDynamicColorRole(role) && isSafeCssColor(color)) {
            playerEl.style.setProperty(`--oim-color-${role}`, color);
          }
        }
      }
    },
    setAllowLottie: (enabled: boolean) => {
      playerEl.setAttribute("allow-lottie", enabled ? "true" : "false");
    },
    setDisableAnimations: (disabled: boolean) => {
      if (disabled) {
        playerEl.setAttribute("disable-animations", "true");
      } else {
        playerEl.removeAttribute("disable-animations");
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
