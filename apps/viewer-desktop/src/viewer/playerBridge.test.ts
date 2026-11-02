/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from "vitest";
import { buildSpecsSummary, extractPaletteNames, formatFileSize, pngSize } from "./playerBridge.js";
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

  it("builds technical specs summary using @oim-media/core permissionOf", () => {
    const specs = buildSpecsSummary(
      {
        oim: "1.26.1",
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
    expect(specs.schemaVersion).toBe("1.26.1");
    expect(specs.slotsCount).toBe(3);
    expect(specs.slotTypes).toEqual({ text: 2, lottie: 1 });
    expect(specs.reeditPolicy).toBe("sealed");
    expect(specs.palettes).toEqual(["dark", "light"]);
    expect(specs.defaultPalette).toBe("dark");
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

  it("renders FloatingToolbar with simplified OIM mark (<= 32px), all security states, palettes, and specs", () => {
    const container = document.createElement("div");
    const onSelectPalette = vi.fn();
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
        onOpenFile: vi.fn(),
      },
      "en"
    );

    // Simplified OIM mark (viewBox="0 0 64 64")
    expect(container.querySelector('svg[viewBox="0 0 64 64"]')).not.toBeNull();

    // Security statuses
    toolbar.setSecurityStatus("verified");
    expect(container.querySelector("#security-badge")?.textContent).toContain("Signed with OIM");

    toolbar.setSecurityStatus("expired_key");
    expect(container.querySelector("#security-badge")?.textContent).toContain("Expired key");

    toolbar.setSecurityStatus("image_mismatch");
    expect(container.querySelector("#security-badge")?.textContent).toContain("Image altered");

    // Palettes & Specs
    toolbar.setLanguages(["es", "en"], "en");
    toolbar.setPalettes(["dark", "light"], "dark");
    toolbar.setSpecs({
      fileName: "demo.oim.png",
      fileSizeFormatted: "120.0 KB",
      dimensionsLabel: "1080 × 1080 px",
      schemaVersion: "1.26.1",
      slotsCount: 2,
      slotTypes: { text: 2 },
      reeditPolicy: "public",
      palettes: ["dark", "light"],
      defaultPalette: "dark",
    });

    const paletteOpts = container.querySelectorAll(".palette-opt");
    expect(paletteOpts.length).toBe(3); // Auto + dark + light
    (paletteOpts[2] as HTMLButtonElement).click();
    expect(onSelectPalette).toHaveBeenCalledWith("light");

    (container.querySelector("#btn-auto-rotate") as HTMLButtonElement).click();
    expect(onToggleAutoRotateLang).toHaveBeenCalledTimes(1);
  });
});
