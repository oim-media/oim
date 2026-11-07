/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from "vitest";
import {
  buildPalettePreview,
  buildSpecsSummary,
  collectColorRoles,
  detectOimCapabilities,
  extractPaletteNames,
  formatFileSize,
  pngSize,
} from "./playerBridge.js";
import { FloatingToolbar } from "../ui/toolbar.js";
import { renderDropzone } from "../ui/dropzone.js";

describe("viewer-desktop playerBridge & UI", () => {
  it("reads PNG IHDR dimensions accurately with pngSize", () => {
    const ihdr = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x07, 0x80, // 1920
      0x00, 0x00, 0x04, 0x38, // 1080
    ]);
    expect(pngSize(ihdr)).toEqual({ width: 1920, height: 1080 });
    expect(pngSize(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it("extracts valid named palettes and rejects unsafe CSS payloads via @oim-media/core", () => {
    const names = extractPaletteNames({
      palettes: {
        dark: { primary: "#111111", "text-primary": "#eeeeee" },
        light: { primary: "#fafafa" },
        bad: { primary: "url(javascript:alert(1))" },
        unknown: { notARole: "#ffffff" },
      },
    });
    expect(names).toEqual(["dark", "light"]);
  });

  it("collects dynamic color roles and builds visual palette preview with HSL variations", () => {
    const meta = {
      palettes: {
        dark: { primary: "#0f172a", surface: "#1e293b" },
      },
      slots: [
        {
          id: "s1",
          type: "geo",
          style: {
            fillColorRole: "primary",
            fillColor: "#2563eb",
            strokeColorRole: "outline",
            strokeColor: "#e2e8f0",
          },
        },
      ],
    };

    const roles = collectColorRoles(meta);
    expect(roles.map((r) => r.role)).toEqual(["primary", "outline", "surface"]);

    const preview = buildPalettePreview(meta);
    expect(preview.available).toBe(true);
    expect(preview.palettes.map((p) => p.id)).toEqual([
      "original",
      "author:dark",
      "hue-60",
      "hue-120",
      "hue-180",
      "hue-240",
      "mono",
    ]);
  });

  it("detects OIM capabilities accurately so controls only appear when supported", () => {
    const staticSingleLang = detectOimCapabilities({
      lang: ["es"],
      slots: [{ id: "1", type: "text", content: { es: "Hola" }, style: {} }],
    });
    expect(staticSingleLang.hasLanguages).toBe(false);
    expect(staticSingleLang.hasAnimations).toBe(false);
    expect(staticSingleLang.hasLottie).toBe(false);
    expect(staticSingleLang.hasDynamicColors).toBe(false);

    const richMultiLang = detectOimCapabilities({
      lang: ["es", "en"],
      slots: [
        {
          id: "1",
          type: "text",
          content: { es: "Hola", en: "Hello" },
          style: { textAnimationType: "typewriter", fillColorRole: "primary", fillColor: "#2563eb" },
        },
        { id: "2", type: "lottie", style: {} },
      ],
    });
    expect(richMultiLang.hasLanguages).toBe(true);
    expect(richMultiLang.hasAnimations).toBe(true);
    expect(richMultiLang.hasLottie).toBe(true);
    expect(richMultiLang.hasDynamicColors).toBe(true);
  });

  it("builds technical specs summary using @oim-media/core permissionOf", () => {
    const specs = buildSpecsSummary(
      {
        oim: "1.27.6",
        reedit: "sealed",
        palettes: {
          dark: { primary: "#111111" },
          light: { primary: "#ffffff" },
        },
        defaultPalette: "dark",
        slots: [
          { id: "1", type: "text" },
          { id: "2", type: "text" },
          { id: "3", type: "lottie" },
        ],
      },
      "poster.oim.png",
      512 * 1024,
      { width: 1200, height: 800 }
    );

    expect(specs.fileName).toBe("poster.oim.png");
    expect(specs.fileSizeFormatted).toBe(formatFileSize(512 * 1024));
    expect(specs.dimensionsLabel).toBe("1200 × 800 px");
    expect(specs.schemaVersion).toBe("1.27.6");
    expect(specs.slotsCount).toBe(3);
    expect(specs.slotTypes).toEqual({ text: 2, lottie: 1 });
    expect(specs.reeditPolicy).toBe("sealed");
    expect(specs.palettes).toEqual(["dark", "light"]);
    expect(specs.defaultPalette).toBe("dark");
    expect(specs.capabilities.hasLottie).toBe(true);
    expect(specs.palettePreview.available).toBe(true);
  });

  it("renders official OIM brand mark (oim-marca.svg >= 32px) and error state in dropzone", () => {
    const container = document.createElement("div");
    const onOpen = vi.fn();
    renderDropzone(container, onOpen, {
      uiLang: "es",
      errorMessage: "La imagen de este archivo fue alterada",
    });

    expect(container.querySelector('svg[viewBox="0 0 256 256"]')).not.toBeNull();
    expect(container.querySelector("#dropzone-error")?.textContent).toContain("alterada");
    (container.querySelector("#btn-open-file") as HTMLButtonElement).click();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("renders clean bottom HUD (no logo, no signature text), compact top-bar signature toggle, and contextual inspector", () => {
    const container = document.createElement("div");
    const onSelectPalette = vi.fn();
    const onSelectPaletteOption = vi.fn();
    const onToggleAutoRotateLang = vi.fn();
    const toolbar = new FloatingToolbar(
      container,
      {
        onTogglePlay: vi.fn(),
        onToggleLayers: vi.fn(),
        onToggleFullscreen: vi.fn(),
        onSelectLang: vi.fn(),
        onToggleAutoRotateLang,
        onSelectPalette,
        onSelectPaletteOption,
        onOpenFile: vi.fn(),
      },
      "en"
    );

    const bottomHud = container.querySelector("#floating-toolbar")!;
    // Bottom bar must NOT contain OIM logo or signature badge
    expect(bottomHud.querySelector('svg[viewBox="0 0 64 64"]')).toBeNull();
    expect(bottomHud.querySelector("#security-badge")).toBeNull();

    // Compact signature badge lives in the top bar and starts collapsed (icon-only)
    const topBar = container.querySelector("#viewer-top-bar")!;
    toolbar.setSecurityStatus("verified");
    const badge = topBar.querySelector("#security-badge") as HTMLButtonElement;
    expect(badge).not.toBeNull();
    expect(badge.textContent).toContain("Signed with OIM");
    const badgeLabel = badge.querySelector(".security-badge-label") as HTMLElement;
    expect(badgeLabel.style.display).toBe("none");

    // Clicking the compact badge expands the signature text; clicking again hides it
    badge.click();
    expect(
      (topBar.querySelector("#security-badge .security-badge-label") as HTMLElement).style.display
    ).toBe("inline");
    (topBar.querySelector("#security-badge") as HTMLButtonElement).click();
    expect(
      (topBar.querySelector("#security-badge .security-badge-label") as HTMLElement).style.display
    ).toBe("none");

    toolbar.setSecurityStatus("expired_key");
    expect(topBar.querySelector("#security-badge")?.textContent).toContain("Expired key");

    toolbar.setSecurityStatus("image_mismatch");
    expect(topBar.querySelector("#security-badge")?.textContent).toContain("Image altered");

    // Contextual controls in Inspector & Bottom HUD
    const specs = buildSpecsSummary(
      {
        oim: "1.27.6",
        lang: ["es", "en"],
        reedit: "public",
        palettes: {
          dark: { primary: "#111111" },
          light: { primary: "#ffffff" },
        },
        defaultPalette: "dark",
        slots: [
          {
            id: "1",
            type: "text",
            content: { es: "Hola", en: "Hello" },
            style: { fillColorRole: "primary", fillColor: "#2563eb" },
          },
        ],
      },
      "sistema_de_tokens_dinamicos_temas_dynamic_color_roles_01_-_ui_dashboard_tema_claro.oim.png",
      24166,
      { width: 1080, height: 1080 }
    );

    toolbar.setLanguages(["es", "en"], "en");
    toolbar.setPalettes(specs.palettes, specs.defaultPalette);
    toolbar.setSpecs(specs);

    // Lottie toggle should NOT be rendered since slots have no lottie
    const inspector = container.querySelector("#inspector-drawer")!;
    expect(inspector.querySelector("#insp-btn-lottie")).toBeNull();
    // Language switcher and Dynamic Theme swatch cards SHOULD be rendered
    expect(inspector.querySelectorAll(".insp-lang-opt").length).toBe(2);
    const paletteCards = inspector.querySelectorAll(".insp-palette-card");
    expect(paletteCards.length).toBeGreaterThanOrEqual(3);

    (paletteCards[2] as HTMLButtonElement).click();
    expect(onSelectPaletteOption).toHaveBeenCalledTimes(1);

    (bottomHud.querySelector("#btn-auto-rotate") as HTMLButtonElement).click();
    expect(onToggleAutoRotateLang).toHaveBeenCalledTimes(1);
  });
});
