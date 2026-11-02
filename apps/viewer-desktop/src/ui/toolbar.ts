/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  iconCheck,
  iconChevronDown,
  iconEye,
  iconEyeOff,
  iconFolder,
  iconGlobe,
  iconLayers,
  iconLayersOff,
  iconLock,
  iconMaximize,
  iconMinimize,
  iconPalette,
  iconPause,
  iconPlay,
  iconRefresh,
  iconShieldAlert,
  iconShieldCheck,
  iconShieldWarning,
  iconSliders,
  iconUnlock,
} from "./icons.js";
import type { UiLang } from "./dropzone.js";
import { detectUiLang } from "./dropzone.js";
import type {
  OimSpecsSummary,
  SuggestedPalette,
  ViewerSecurityStatus,
} from "../viewer/playerBridge.js";

export interface ToolbarHandlers {
  onTogglePlay: () => void;
  onToggleLayers: () => void;
  onToggleLottie?: () => void;
  onToggleFullscreen: () => void;
  onSelectLang: (lang: string) => void;
  onToggleAutoRotateLang: () => void;
  onSelectPalette: (paletteName: string | null) => void;
  onSelectPaletteOption?: (palette: SuggestedPalette) => void;
  onOpenFile: () => void;
  onInspectorVisibilityChange?: (open: boolean) => void;
}

export class FloatingToolbar {
  private topBarEl: HTMLElement;
  private element: HTMLElement;
  private inspectorEl: HTMLElement;
  private isPlaying = true;
  private showLayers = true;
  private allowLottie = true;
  private isFullscreen = false;
  private autoRotateLang = false;
  private isInspectorOpen = true;
  private isSecurityExpanded = false;
  private isHudVisible = true;
  private lastActivityMs = 0;
  private hideTimer: number | null = null;
  private handlers: ToolbarHandlers;
  private currentLangs: string[] = [];
  private selectedLang = "es";
  private palettes: string[] = [];
  private selectedPalette: string | null = null;
  private activePaletteId = "original";
  private securityStatus: ViewerSecurityStatus = "unsigned";
  private specs: OimSpecsSummary | null = null;
  private openMenu: "lang" | "palette" | null = null;
  private uiLang: UiLang;

  constructor(container: HTMLElement, handlers: ToolbarHandlers, uiLang?: UiLang, inspectorHost?: HTMLElement) {
    this.handlers = handlers;
    this.uiLang = uiLang ?? detectUiLang();

    // 1. Top Glass Header Bar
    this.topBarEl = document.createElement("header");
    this.topBarEl.id = "viewer-top-bar";
    this.topBarEl.style.cssText = `
      height: 42px;
      min-height: 42px;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 0 14px;
      background: rgba(14, 14, 18, 0.88);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      contain: paint;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      z-index: 90;
      transition: opacity 0.22s ease, transform 0.22s ease;
    `;
    container.insertBefore(this.topBarEl, container.firstChild);

    // 2. Collapsible Right Glass Inspector Drawer (Single unified surface, no card-in-card)
    this.inspectorEl = document.createElement("aside");
    this.inspectorEl.id = "inspector-drawer";
    this.inspectorEl.style.cssText = `
      width: 290px;
      min-width: 290px;
      height: 100%;
      background: rgba(16, 16, 20, 0.92);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      contain: paint;
      border-left: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 16px 14px;
      overflow-y: auto;
      overflow-x: hidden;
      z-index: 85;
      color: #f4f4f5;
    `;
    (inspectorHost ?? container).appendChild(this.inspectorEl);

    // 3. Minimal Bottom Floating Glass HUD Pill
    this.element = document.createElement("div");
    this.element.id = "floating-toolbar";
    this.element.style.cssText = `
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(0);
      display: flex;
      align-items: center;
      gap: 3px;
      padding: 4px 6px;
      background: rgba(18, 18, 22, 0.88);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      contain: paint;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 9999px;
      color: #f4f4f5;
      box-shadow: 0 16px 36px -8px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(0, 0, 0, 0.3);
      transition: opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1), transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 100;
      opacity: 1;
      user-select: none;
    `;
    container.appendChild(this.element);

    document.addEventListener("click", (e) => {
      if (!this.element.contains(e.target as Node) && this.openMenu !== null) {
        this.openMenu = null;
        this.render();
      }
    });

    this.render();
    this.setupAutoHide(container);
  }

  private t(es: string, en: string): string {
    return this.uiLang === "es" ? es : en;
  }

  public setPlaying(playing: boolean): void {
    this.isPlaying = playing;
    this.render();
  }

  public setLayersVisible(visible: boolean): void {
    this.showLayers = visible;
    this.render();
  }

  public setAllowLottie(enabled: boolean): void {
    this.allowLottie = enabled;
    this.render();
  }

  public setFullscreen(fullscreen: boolean): void {
    this.isFullscreen = fullscreen;
    if (fullscreen) {
      this.isInspectorOpen = false;
      this.handlers.onInspectorVisibilityChange?.(false);
      this.topBarEl.style.position = "absolute";
      this.topBarEl.style.top = "0";
      this.topBarEl.style.left = "0";
      this.topBarEl.style.right = "0";
      this.topBarEl.style.zIndex = "90";
    } else {
      this.topBarEl.style.position = "relative";
      this.topBarEl.style.top = "auto";
      this.topBarEl.style.left = "auto";
      this.topBarEl.style.right = "auto";
      this.topBarEl.style.visibility = "visible";
      this.topBarEl.style.opacity = "1";
      this.topBarEl.style.pointerEvents = "auto";
    }
    this.show();
    this.render();
  }

  public setAutoRotateLang(enabled: boolean): void {
    this.autoRotateLang = enabled;
    this.render();
  }

  public setSecurityStatus(status: ViewerSecurityStatus): void {
    this.securityStatus = status;
    this.render();
  }

  public setLanguages(langs: string[], currentLang: string): void {
    this.currentLangs = langs.filter((l) => l && l.trim().length > 0 && l !== "*");
    if (currentLang && currentLang !== "*") {
      this.selectedLang = currentLang.toLowerCase();
    } else if (this.currentLangs.length > 0) {
      this.selectedLang = this.currentLangs[0].toLowerCase();
    }
    this.render();
  }

  public setPalettes(palettes: string[], activePalette: string | null): void {
    this.palettes = palettes;
    this.selectedPalette = activePalette;
    this.activePaletteId = activePalette ? `author:${activePalette}` : "original";
    this.render();
  }

  public setActivePaletteId(paletteId: string): void {
    this.activePaletteId = paletteId;
    if (paletteId === "original") {
      this.selectedPalette = null;
    } else if (paletteId.startsWith("author:")) {
      this.selectedPalette = paletteId.slice("author:".length);
    } else {
      this.selectedPalette = paletteId;
    }
    this.render();
  }

  public setSpecs(specs: OimSpecsSummary | null): void {
    this.specs = specs;
    this.render();
  }

  public setChromeVisible(visible: boolean): void {
    this.topBarEl.style.display = visible ? "flex" : "none";
    this.element.style.display = visible ? "flex" : "none";
    this.inspectorEl.style.display = visible && this.isInspectorOpen ? "flex" : "none";
  }

  public toggleInfoPopover(): void {
    this.isInspectorOpen = !this.isInspectorOpen;
    this.handlers.onInspectorVisibilityChange?.(this.isInspectorOpen);
    this.show();
    this.render();
  }

  public show(): void {
    if (!this.isHudVisible) {
      this.isHudVisible = true;
      this.element.style.visibility = "visible";
      this.element.style.opacity = "1";
      this.element.style.pointerEvents = "auto";
      this.element.style.transform = "translateX(-50%) translateY(0)";
      if (this.isFullscreen) {
        this.topBarEl.style.visibility = "visible";
        this.topBarEl.style.opacity = "1";
        this.topBarEl.style.pointerEvents = "auto";
      }
    }
    this.resetTimer();
  }

  private hide(): void {
    if (this.openMenu !== null) return;
    this.isHudVisible = false;
    this.element.style.opacity = "0";
    this.element.style.pointerEvents = "none";
    this.element.style.transform = "translateX(-50%) translateY(8px)";
    if (this.isFullscreen) {
      this.topBarEl.style.opacity = "0";
      this.topBarEl.style.pointerEvents = "none";
    }
    window.setTimeout(() => {
      if (!this.isHudVisible) {
        this.element.style.visibility = "hidden";
        if (this.isFullscreen) {
          this.topBarEl.style.visibility = "hidden";
        }
      }
    }, 240);
  }

  private resetTimer(): void {
    if (this.hideTimer !== null) {
      window.clearTimeout(this.hideTimer);
    }
    this.hideTimer = window.setTimeout(() => {
      this.hide();
    }, 3200);
  }

  private setupAutoHide(listenTarget: HTMLElement): void {
    const onMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      if (this.isFullscreen && e.clientY < 50) {
        this.show();
        return;
      }
      if (this.isHudVisible && now - this.lastActivityMs < 250) {
        return;
      }
      this.lastActivityMs = now;
      this.show();
    };
    const onClick = () => {
      this.lastActivityMs = Date.now();
      this.show();
    };
    listenTarget.addEventListener("mousemove", onMouseMove as EventListener, { passive: true });
    listenTarget.addEventListener("click", onClick, { passive: true });
    this.resetTimer();
  }

  public getSecurityBadgeConfig(): { icon: string; text: string; color: string; bg: string } {
    switch (this.securityStatus) {
      case "verified":
        return {
          icon: iconShieldCheck,
          text: this.t("Firmado con OIM", "Signed with OIM"),
          color: "#22c55e",
          bg: "rgba(34, 197, 94, 0.14)",
        };
      case "verified_authorless":
        return {
          icon: iconShieldCheck,
          text: this.t("Firmado · sin autoría", "Signed · no authorship"),
          color: "#38bdf8",
          bg: "rgba(56, 189, 248, 0.14)",
        };
      case "image_unsealed":
        return {
          icon: iconShieldWarning,
          text: this.t("Firmado · sin sello", "Signed · unsealed"),
          color: "#cbd5e1",
          bg: "rgba(148, 163, 184, 0.14)",
        };
      case "expired_key":
        return {
          icon: iconShieldWarning,
          text: this.t("Clave expirada", "Expired key"),
          color: "#f59e0b",
          bg: "rgba(245, 158, 11, 0.14)",
        };
      case "no_metadata":
        return {
          icon: iconShieldWarning,
          text: this.t("Sin datos OIM", "No OIM data"),
          color: "#f59e0b",
          bg: "rgba(245, 158, 11, 0.14)",
        };
      case "image_mismatch":
        return {
          icon: iconShieldAlert,
          text: this.t("Imagen alterada", "Image altered"),
          color: "#ef4444",
          bg: "rgba(239, 68, 68, 0.16)",
        };
      case "invalid_signature":
      case "corrupt":
      case "domain_blocked":
        return {
          icon: iconShieldAlert,
          text:
            this.securityStatus === "corrupt"
              ? this.t("Corrupto", "Corrupt")
              : this.t("Firma inválida", "Invalid signature"),
          color: "#ef4444",
          bg: "rgba(239, 68, 68, 0.16)",
        };
      case "unsigned":
      default:
        return {
          icon: iconShieldWarning,
          text: this.t("Sin firma", "Unsigned"),
          color: "#a1a1aa",
          bg: "rgba(161, 161, 170, 0.12)",
        };
    }
  }

  private getEffectivePaletteList(): SuggestedPalette[] {
    if (this.specs?.palettePreview?.available && this.specs.palettePreview.palettes.length > 0) {
      return this.specs.palettePreview.palettes;
    }
    if (this.palettes.length > 0) {
      return [
        { id: "original", name: [this.t("Automática", "Auto"), this.t("Automática", "Auto")], colors: {} },
        ...this.palettes.map((p) => ({
          id: `author:${p}`,
          name: [p, p] as [string, string],
          colors: {},
        })),
      ];
    }
    return [];
  }

  private renderTopBar(): void {
    const sec = this.getSecurityBadgeConfig();
    const s = this.specs;
    const fileName = s?.fileName ?? "OIM Viewer";

    this.topBarEl.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
        <span style="
          width: 7px;
          height: 7px;
          border-radius: 9999px;
          background: ${sec.color};
          box-shadow: 0 0 8px ${sec.color}99;
          flex-shrink: 0;
        "></span>
        <span style="
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 12px;
          color: #e4e4e7;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          min-width: 0;
          max-width: 340px;
        " title="${fileName}">${fileName}</span>

        <!-- Compact Signature Badge (icon-only by default, click to show/hide text) -->
        <button id="security-badge" type="button" title="${sec.text} — ${this.t("Clic para mostrar/ocultar estado", "Click to show/hide status")}" style="
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: ${this.isSecurityExpanded ? "3px 9px" : "3px 6px"};
          background: ${sec.bg};
          color: ${sec.color};
          border: 1px solid ${sec.color}40;
          border-radius: 9999px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.03em;
          white-space: nowrap;
          cursor: pointer;
          flex-shrink: 0;
          transition: padding 0.15s ease, background 0.15s ease;
        ">
          <span style="display: flex; align-items: center;">${sec.icon}</span>
          <span class="security-badge-label" style="display: ${this.isSecurityExpanded ? "inline" : "none"};">${sec.text}</span>
        </button>
      </div>

      <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
        ${
          s
            ? `
          <span style="
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 10px;
            color: #a1a1aa;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.08);
            padding: 3px 7px;
            border-radius: 6px;
          ">${s.fileSizeFormatted}</span>
        `
            : ""
        }

        <button id="top-btn-fullscreen" type="button" title="${this.t("Pantalla completa (F11)", "Fullscreen (F11)")}" style="
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 9px;
          border-radius: 7px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.09);
          color: #e4e4e7;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
        ">
          ${this.isFullscreen ? iconMinimize : iconMaximize}
          <span>${this.isFullscreen ? this.t("Salir", "Exit") : this.t("Pantalla completa", "Fullscreen")}</span>
        </button>

        <button id="top-btn-open" type="button" title="${this.t("Cargar otro archivo (Ctrl+O)", "Load another file (Ctrl+O)")}" style="
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 9px;
          border-radius: 7px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.09);
          color: #e4e4e7;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
        ">
          ${iconFolder}
          <span>${this.t("Cargar otro", "Load another")}</span>
        </button>

        <button id="top-btn-inspector" type="button" title="${this.t("Panel de ajustes y ficha técnica (I)", "Settings & technical specs panel (I)")}" style="
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 9px;
          border-radius: 7px;
          background: ${this.isInspectorOpen ? "#ffffff" : "rgba(255, 255, 255, 0.05)"};
          border: 1px solid ${this.isInspectorOpen ? "#ffffff" : "rgba(255, 255, 255, 0.09)"};
          color: ${this.isInspectorOpen ? "#09090b" : "#e4e4e7"};
          font-size: 11px;
          font-weight: ${this.isInspectorOpen ? "700" : "500"};
          cursor: pointer;
        ">
          ${iconSliders}
          <span>${this.t("Ajustes", "Inspector")}</span>
        </button>
      </div>
    `;

    this.topBarEl.querySelector("#security-badge")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.isSecurityExpanded = !this.isSecurityExpanded;
      this.renderTopBar();
    });
    this.topBarEl.querySelector("#top-btn-fullscreen")?.addEventListener("click", () => {
      this.handlers.onToggleFullscreen();
    });
    this.topBarEl.querySelector("#top-btn-open")?.addEventListener("click", () => {
      this.handlers.onOpenFile();
    });
    this.topBarEl.querySelector("#top-btn-inspector")?.addEventListener("click", () => {
      this.toggleInfoPopover();
    });
  }

  private renderInspectorDrawer(): void {
    const s = this.specs;
    this.inspectorEl.style.display = this.isInspectorOpen && s !== null ? "flex" : "none";
    if (!s) {
      this.inspectorEl.innerHTML = "";
      return;
    }

    const caps = s.capabilities;
    const sec = this.getSecurityBadgeConfig();
    const hasMultipleLangs = this.currentLangs.length > 1 || caps.hasLanguages;
    const langsToRender = this.currentLangs.length > 0 ? this.currentLangs : caps.languages;
    const paletteList = this.getEffectivePaletteList();
    const colorRoles = s.palettePreview?.colorRoles ?? [];
    const slotEntries = Object.entries(s.slotTypes);

    const reeditLabel =
      s.reeditPolicy === "public"
        ? this.t("Público (editable)", "Public (re-editable)")
        : s.reeditPolicy === "sealed"
          ? this.t("Sellado (inmutable)", "Sealed (immutable)")
          : this.t("Solo autor", "Author only");

    const hasAnySettings = s.slotsCount > 0 || hasMultipleLangs || paletteList.length > 0 || caps.hasAnimations || caps.hasLottie;

    this.inspectorEl.innerHTML = `
      ${
        hasAnySettings
          ? `
        <!-- Sección 1: Ajustes y Diagnóstico (limpio, sin card-in-card) -->
        <div>
          <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); margin-bottom: 12px;">
            <span style="font-size: 11px; font-weight: 700; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.06em;">
              ${this.t("Ajustes", "Settings")}
            </span>
            <span style="font-family: ui-monospace, monospace; font-size: 10px; color: #71717a;">
              ${s.slotsCount} ${this.t("slots", "slots")}
            </span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${
              s.slotsCount > 0
                ? `
              <!-- Capa Interactiva (Slots) -->
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                <div style="min-width: 0;">
                  <div style="font-size: 12px; font-weight: 500; color: #f4f4f5;">
                    ${this.t("Capa interactiva", "Interactive layer")}
                  </div>
                  <div style="font-size: 10px; color: #71717a;">
                    ${this.showLayers ? this.t("Superposición activa", "Overlay active") : this.t("Base PNG plana", "Flat PNG base")}
                  </div>
                </div>
                <button id="insp-btn-layers" type="button" style="
                  display: inline-flex;
                  align-items: center;
                  gap: 5px;
                  padding: 4px 9px;
                  border-radius: 6px;
                  border: 1px solid ${this.showLayers ? "#ffffff" : "rgba(255, 255, 255, 0.12)"};
                  background: ${this.showLayers ? "#ffffff" : "transparent"};
                  color: ${this.showLayers ? "#09090b" : "#a1a1aa"};
                  font-size: 11px;
                  font-weight: 600;
                  cursor: pointer;
                  flex-shrink: 0;
                  transition: background 0.12s ease, color 0.12s ease;
                ">
                  ${this.showLayers ? iconEye : iconEyeOff}
                  <span>${this.showLayers ? this.t("Visible", "Visible") : this.t("Oculta", "Hidden")}</span>
                </button>
              </div>
            `
                : ""
            }

            ${
              hasMultipleLangs
                ? `
              <!-- Selector de Idioma -->
              <div style="display: flex; flex-direction: column; gap: 6px;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <span style="font-size: 12px; font-weight: 500; color: #f4f4f5;">
                    ${this.t("Idioma", "Language")}
                  </span>
                  <button id="insp-btn-autorotate" type="button" style="
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 2px 7px;
                    border-radius: 5px;
                    border: 1px solid ${this.autoRotateLang ? "#ffffff" : "transparent"};
                    background: ${this.autoRotateLang ? "#ffffff" : "rgba(255, 255, 255, 0.05)"};
                    color: ${this.autoRotateLang ? "#09090b" : "#a1a1aa"};
                    font-size: 10px;
                    font-weight: 500;
                    cursor: pointer;
                  ">
                    ${iconRefresh}
                    <span>${this.t("Auto-rotar", "Auto-rotate")}</span>
                  </button>
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                  ${langsToRender
                    .map((l) => {
                      const active = l.toLowerCase() === this.selectedLang.toLowerCase();
                      return `
                      <button class="insp-lang-opt" type="button" data-lang="${l.toLowerCase()}" style="
                        padding: 3px 9px;
                        border-radius: 5px;
                        font-size: 11px;
                        font-weight: 600;
                        border: 1px solid ${active ? "#ffffff" : "rgba(255, 255, 255, 0.09)"};
                        background: ${active ? "#ffffff" : "transparent"};
                        color: ${active ? "#09090b" : "#d4d4d8"};
                        cursor: pointer;
                        transition: background 0.12s ease, color 0.12s ease;
                      ">${l.toUpperCase()}</button>
                    `;
                    })
                    .join("")}
                </div>
              </div>
            `
                : ""
            }

            ${
              paletteList.length > 0
                ? `
              <!-- Adaptación de Tema Dinámico -->
              <div style="display: flex; flex-direction: column; gap: 6px;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <span style="display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 500; color: #f4f4f5;">
                    <span style="color: #a1a1aa; display: flex;">${iconPalette}</span>
                    <span>${this.t("Tema de color", "Color theme")}</span>
                  </span>
                  ${
                    colorRoles.length > 0
                      ? `<span style="font-size: 10px; color: #71717a;">${colorRoles.length} roles</span>`
                      : ""
                  }
                </div>
                <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px;">
                  ${paletteList
                    .map((p) => {
                      const active = p.id === this.activePaletteId;
                      const swatchesHtml =
                        colorRoles.length > 0
                          ? `
                        <span style="display: flex; height: 12px; border-radius: 3px; overflow: hidden; margin-bottom: 4px;">
                          ${colorRoles
                            .map(
                              ({ role, authorColor }) => `
                            <span style="flex: 1; background: ${p.colors[role] ?? authorColor ?? "#3f3f46"};"></span>
                          `
                            )
                            .join("")}
                        </span>
                      `
                          : "";
                      return `
                      <button class="insp-palette-card" type="button" data-palette-id="${p.id}" style="
                        padding: 5px 6px;
                        border-radius: 6px;
                        border: 1px solid ${active ? "#ffffff" : "rgba(255, 255, 255, 0.08)"};
                        background: ${active ? "#ffffff" : "rgba(255, 255, 255, 0.03)"};
                        color: ${active ? "#09090b" : "#d4d4d8"};
                        text-align: left;
                        cursor: pointer;
                        min-width: 0;
                        transition: border-color 0.12s ease;
                      ">
                        ${swatchesHtml}
                        <span style="
                          display: block;
                          font-size: 10px;
                          font-weight: ${active ? "700" : "500"};
                          overflow: hidden;
                          text-overflow: ellipsis;
                          white-space: nowrap;
                        ">${this.t(p.name[0], p.name[1])}</span>
                      </button>
                    `;
                    })
                    .join("")}
                </div>
              </div>
            `
                : ""
            }

            ${
              caps.hasAnimations
                ? `
              <!-- Animaciones de Capa -->
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <span style="font-size: 12px; font-weight: 500; color: #f4f4f5;">
                  ${this.t("Animaciones", "Animations")}
                </span>
                <button id="insp-btn-play" type="button" style="
                  display: inline-flex;
                  align-items: center;
                  gap: 5px;
                  padding: 4px 9px;
                  border-radius: 6px;
                  border: 1px solid ${this.isPlaying ? "#ffffff" : "rgba(255, 255, 255, 0.12)"};
                  background: ${this.isPlaying ? "#ffffff" : "transparent"};
                  color: ${this.isPlaying ? "#09090b" : "#a1a1aa"};
                  font-size: 11px;
                  font-weight: 600;
                  cursor: pointer;
                ">
                  ${this.isPlaying ? iconPlay : iconPause}
                  <span>${this.isPlaying ? this.t("Activo", "Active") : this.t("Pausado", "Paused")}</span>
                </button>
              </div>
            `
                : ""
            }

            ${
              caps.hasLottie
                ? `
              <!-- Micro-animaciones Lottie -->
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <span style="font-size: 12px; font-weight: 500; color: #f4f4f5;">
                  ${this.t("Vectores Lottie", "Lottie Vectors")}
                </span>
                <button id="insp-btn-lottie" type="button" style="
                  display: inline-flex;
                  align-items: center;
                  gap: 5px;
                  padding: 4px 9px;
                  border-radius: 6px;
                  border: 1px solid ${this.allowLottie ? "#ffffff" : "rgba(255, 255, 255, 0.12)"};
                  background: ${this.allowLottie ? "#ffffff" : "transparent"};
                  color: ${this.allowLottie ? "#09090b" : "#a1a1aa"};
                  font-size: 11px;
                  font-weight: 600;
                  cursor: pointer;
                ">
                  <span>${this.allowLottie ? this.t("Activo", "Active") : this.t("Pausado", "Paused")}</span>
                </button>
              </div>
            `
                : ""
            }
          </div>
        </div>
        <div style="height: 1px; background: rgba(255, 255, 255, 0.08); margin: 4px 0;"></div>
      `
          : ""
      }

      <!-- Sección 2: Ficha Técnica (Lista limpia clave-valor, sin tarjetas anidadas) -->
      <div id="info-popover">
        <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); margin-bottom: 12px;">
          <span style="font-size: 11px; font-weight: 700; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.06em;">
            ${this.t("Ficha Técnica", "Technical Specs")}
          </span>
          <span style="font-family: ui-monospace, monospace; font-size: 10px; color: #71717a;">v${s.schemaVersion}</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 9px; font-size: 11px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 10px;">
            <span style="color: #71717a; flex-shrink: 0;">${this.t("Archivo", "File")}</span>
            <span style="color: #f4f4f5; font-family: ui-monospace, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: right;" title="${s.fileName}">
              ${s.fileName}
            </span>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 10px;">
            <span style="color: #71717a; flex-shrink: 0;">${this.t("Peso", "Size")}</span>
            <span style="color: #f4f4f5; font-family: ui-monospace, monospace;">${s.fileSizeFormatted}</span>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 10px;">
            <span style="color: #71717a; flex-shrink: 0;">${this.t("Resolución", "Dimensions")}</span>
            <span style="color: #f4f4f5;">${s.dimensionsLabel}</span>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 10px;">
            <span style="color: #71717a; flex-shrink: 0;">${this.t("Esquema OIM", "OIM Schema")}</span>
            <span style="color: #f4f4f5; font-family: ui-monospace, monospace;">v${s.schemaVersion}</span>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 10px;">
            <span style="color: #71717a; flex-shrink: 0;">${this.t("Reedición", "Re-edit")}</span>
            <span style="color: #f4f4f5; display: inline-flex; align-items: center; gap: 4px;">
              <span style="color: ${s.reeditPolicy === "public" ? "#22c55e" : "#f59e0b"}; display: flex;">
                ${s.reeditPolicy === "public" ? iconUnlock : iconLock}
              </span>
              ${reeditLabel}
            </span>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 10px;">
            <span style="color: #71717a; flex-shrink: 0;">${this.t("Firma", "Signature")}</span>
            <span style="color: ${sec.color}; display: inline-flex; align-items: center; gap: 4px; font-weight: 500;">
              <span style="display: flex;">${sec.icon}</span>
              <span>${sec.text}</span>
            </span>
          </div>

          ${
            slotEntries.length > 0
              ? `
            <div style="padding-top: 4px; display: flex; flex-direction: column; gap: 5px;">
              <span style="color: #71717a; font-size: 10px;">${this.t("Desglose de capas", "Layer breakdown")}</span>
              <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                ${slotEntries
                  .map(
                    ([type, count]) => `
                  <span style="padding: 2px 6px; border-radius: 4px; background: rgba(255, 255, 255, 0.05); color: #d4d4d8; font-size: 10px; font-family: ui-monospace, monospace;">
                    ${type.toUpperCase()} <strong style="color: #ffffff;">${count}</strong>
                  </span>
                `
                  )
                  .join("")}
              </div>
            </div>
          `
              : ""
          }
        </div>
      </div>
    `;

    this.inspectorEl.querySelector("#insp-btn-layers")?.addEventListener("click", () => {
      this.handlers.onToggleLayers();
    });
    this.inspectorEl.querySelector("#insp-btn-autorotate")?.addEventListener("click", () => {
      this.handlers.onToggleAutoRotateLang();
    });
    this.inspectorEl.querySelector("#insp-btn-play")?.addEventListener("click", () => {
      this.handlers.onTogglePlay();
    });
    this.inspectorEl.querySelector("#insp-btn-lottie")?.addEventListener("click", () => {
      this.handlers.onToggleLottie?.();
    });

    this.inspectorEl.querySelectorAll(".insp-lang-opt").forEach((btn) => {
      btn.addEventListener("click", () => {
        const lang = (btn as HTMLElement).getAttribute("data-lang");
        if (lang) {
          this.selectedLang = lang;
          this.handlers.onSelectLang(lang);
          this.render();
        }
      });
    });

    this.inspectorEl.querySelectorAll(".insp-palette-card").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = (btn as HTMLElement).getAttribute("data-palette-id");
        if (!id) return;
        this.selectPaletteById(id);
      });
    });
  }

  private selectPaletteById(id: string): void {
    const paletteList = this.getEffectivePaletteList();
    const found = paletteList.find((p) => p.id === id);
    this.setActivePaletteId(id);
    if (found && this.handlers.onSelectPaletteOption) {
      this.handlers.onSelectPaletteOption(found);
    } else if (id === "original") {
      this.handlers.onSelectPalette(null);
    } else if (id.startsWith("author:")) {
      this.handlers.onSelectPalette(id.slice("author:".length));
    } else {
      this.handlers.onSelectPalette(id);
    }
  }

  private renderBottomHud(): void {
    const caps = this.specs?.capabilities;
    const hasAnimations = caps ? caps.hasAnimations || caps.hasLottie : true;
    const hasLayers = caps ? caps.slotsCount > 0 : true;
    const hasMultipleLangs = this.currentLangs.length > 1;
    const paletteList = this.getEffectivePaletteList();
    const hasPalettes = paletteList.length > 0;
    const hasContextualControls = hasAnimations || hasLayers || hasMultipleLangs || hasPalettes;

    const activePaletteObj = paletteList.find((p) => p.id === this.activePaletteId) ?? paletteList[0];
    const activePaletteLabel = activePaletteObj
      ? this.t(activePaletteObj.name[0], activePaletteObj.name[1])
      : this.selectedPalette ?? this.t("Original", "Original");

    this.element.innerHTML = `
      <!-- Play / Pause (only visible if the file has animations or Lottie) -->
      <button id="btn-play" type="button" title="${this.isPlaying ? this.t("Pausar animaciones (Espacio)", "Pause animations (Space)") : this.t("Reproducir animaciones (Espacio)", "Play animations (Space)")}" style="
        background: none;
        border: none;
        color: #ffffff;
        cursor: pointer;
        display: ${hasAnimations ? "flex" : "none"};
        align-items: center;
        padding: 6px;
        border-radius: 9999px;
        transition: background 0.12s ease;
      ">
        ${this.isPlaying ? iconPause : iconPlay}
      </button>

      <!-- Toggle Capas Dinámicas (only visible if the file has interactive slots) -->
      <button id="btn-layers" type="button" title="${this.showLayers ? this.t("Ocultar capa interactiva (L)", "Hide interactive layer (L)") : this.t("Mostrar capa interactiva (L)", "Show interactive layer (L)")}" style="
        background: ${this.showLayers ? "transparent" : "rgba(239, 68, 68, 0.16)"};
        border: none;
        color: ${this.showLayers ? "#ffffff" : "#f87171"};
        cursor: pointer;
        display: ${hasLayers ? "flex" : "none"};
        align-items: center;
        padding: 6px;
        border-radius: 9999px;
        transition: background 0.12s ease;
      ">
        ${this.showLayers ? iconLayers : iconLayersOff}
      </button>

      <!-- Selector de Idiomas (flat trigger inside HUD, no double-nested card) -->
      <div id="lang-picker-container" style="
        position: relative;
        display: ${hasMultipleLangs ? "flex" : "none"};
        align-items: center;
      ">
        <button id="btn-lang-trigger" type="button" title="${this.t("Cambiar idioma", "Switch language")}" style="
          background: transparent;
          border: none;
          color: #ffffff;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 5px 8px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 600;
          transition: background 0.12s ease;
        ">
          <span style="display: flex; align-items: center; color: #a1a1aa;">${iconGlobe}</span>
          <span style="letter-spacing: 0.03em;">${this.selectedLang.toUpperCase()}</span>
          <span style="display: flex; align-items: center; color: #71717a;">${iconChevronDown}</span>
        </button>

        <div id="lang-menu" style="
          position: absolute;
          bottom: calc(100% + 10px);
          left: 50%;
          transform: translateX(-50%);
          background: rgba(20, 20, 24, 0.94);
          backdrop-filter: blur(22px) saturate(180%);
          -webkit-backdrop-filter: blur(22px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 10px;
          padding: 4px;
          box-shadow: 0 14px 32px rgba(0, 0, 0, 0.65);
          display: ${this.openMenu === "lang" ? "flex" : "none"};
          flex-direction: column;
          gap: 2px;
          min-width: 120px;
          z-index: 120;
        ">
          ${this.currentLangs
            .map((l) => {
              const isSelected = l.toLowerCase() === this.selectedLang.toLowerCase();
              return `
              <button class="lang-opt" type="button" data-lang="${l.toLowerCase()}" style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 5px 9px;
                background: ${isSelected ? "#ffffff" : "transparent"};
                border: none;
                border-radius: 6px;
                color: ${isSelected ? "#09090b" : "#d4d4d8"};
                font-size: 11px;
                font-weight: ${isSelected ? "700" : "500"};
                cursor: pointer;
                text-align: left;
                width: 100%;
              ">
                <span>${l.toUpperCase()}</span>
                <span style="display: flex; align-items: center; opacity: ${isSelected ? "1" : "0"};">
                  ${iconCheck}
                </span>
              </button>
            `;
            })
            .join("")}
          <div style="height: 1px; background: rgba(255, 255, 255, 0.08); margin: 2px 0;"></div>
          <button id="btn-auto-rotate" type="button" style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 6px;
            padding: 5px 9px;
            background: ${this.autoRotateLang ? "#ffffff" : "transparent"};
            border: none;
            border-radius: 6px;
            color: ${this.autoRotateLang ? "#09090b" : "#a1a1aa"};
            font-size: 10px;
            font-weight: 700;
            cursor: pointer;
            width: 100%;
          ">
            <span style="display: inline-flex; align-items: center; gap: 5px;">
              ${iconRefresh}
              <span>${this.t("Auto-rotar (3s)", "Auto-rotate (3s)")}</span>
            </span>
          </button>
        </div>
      </div>

      <!-- Selector de Paletas (flat trigger inside HUD) -->
      <div id="palette-picker-container" style="
        position: relative;
        display: ${hasPalettes ? "flex" : "none"};
        align-items: center;
      ">
        <button id="btn-palette-trigger" type="button" title="${this.t("Cambiar tema de color", "Switch color theme")}" style="
          background: transparent;
          border: none;
          color: #ffffff;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 5px 8px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 600;
          transition: background 0.12s ease;
        ">
          <span style="display: flex; align-items: center; color: #a1a1aa;">${iconPalette}</span>
          <span style="max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${activePaletteLabel}</span>
          <span style="display: flex; align-items: center; color: #71717a;">${iconChevronDown}</span>
        </button>

        <div id="palette-menu" style="
          position: absolute;
          bottom: calc(100% + 10px);
          left: 50%;
          transform: translateX(-50%);
          background: rgba(20, 20, 24, 0.94);
          backdrop-filter: blur(22px) saturate(180%);
          -webkit-backdrop-filter: blur(22px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 10px;
          padding: 4px;
          box-shadow: 0 14px 32px rgba(0, 0, 0, 0.65);
          display: ${this.openMenu === "palette" ? "flex" : "none"};
          flex-direction: column;
          gap: 2px;
          min-width: 140px;
          z-index: 120;
        ">
          ${paletteList
            .map((p) => {
              const isSelected = p.id === this.activePaletteId;
              const rawName = p.id === "original" ? "" : p.id.startsWith("author:") ? p.id.slice("author:".length) : p.id;
              return `
              <button class="palette-opt" type="button" data-palette="${rawName}" data-palette-id="${p.id}" style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 5px 9px;
                background: ${isSelected ? "#ffffff" : "transparent"};
                border: none;
                border-radius: 6px;
                color: ${isSelected ? "#09090b" : "#d4d4d8"};
                font-size: 11px;
                font-weight: ${isSelected ? "700" : "500"};
                cursor: pointer;
                width: 100%;
                text-align: left;
              ">
                <span>${this.t(p.name[0], p.name[1])}</span>
                <span style="display: flex; align-items: center; opacity: ${isSelected ? "1" : "0"};">
                  ${iconCheck}
                </span>
              </button>
            `;
            })
            .join("")}
        </div>
      </div>

      <div style="width: 1px; height: 14px; background: rgba(255, 255, 255, 0.12); display: ${hasContextualControls ? "block" : "none"};"></div>

      <!-- Inspector / Ficha Técnica (I) -->
      <button id="btn-info" type="button" title="${this.t("Ajustes y ficha técnica (I)", "Settings & technical specs (I)")}" style="
        background: ${this.isInspectorOpen ? "#ffffff" : "transparent"};
        border: none;
        color: ${this.isInspectorOpen ? "#09090b" : "#ffffff"};
        cursor: pointer;
        display: flex;
        align-items: center;
        padding: 6px;
        border-radius: 9999px;
        transition: background 0.12s ease, color 0.12s ease;
      ">
        ${iconSliders}
      </button>

      <!-- Abrir otro archivo (Ctrl+O) -->
      <button id="btn-open-another" type="button" title="${this.t("Abrir otro archivo (Ctrl+O)", "Open another file (Ctrl+O)")}" style="
        background: none;
        border: none;
        color: #ffffff;
        cursor: pointer;
        display: flex;
        align-items: center;
        padding: 6px;
        border-radius: 9999px;
        transition: background 0.12s ease;
      ">
        ${iconFolder}
      </button>

      <!-- Pantalla Completa (F11) -->
      <button id="btn-fullscreen" type="button" title="${this.t("Pantalla completa (F11)", "Fullscreen (F11)")}" style="
        background: none;
        border: none;
        color: #ffffff;
        cursor: pointer;
        display: flex;
        align-items: center;
        padding: 6px;
        border-radius: 9999px;
        transition: background 0.12s ease;
      ">
        ${this.isFullscreen ? iconMinimize : iconMaximize}
      </button>
    `;

    this.element.querySelector("#btn-play")?.addEventListener("click", () => this.handlers.onTogglePlay());
    this.element.querySelector("#btn-layers")?.addEventListener("click", () => this.handlers.onToggleLayers());
    this.element.querySelector("#btn-open-another")?.addEventListener("click", () => this.handlers.onOpenFile());
    this.element.querySelector("#btn-fullscreen")?.addEventListener("click", () => this.handlers.onToggleFullscreen());

    this.element.querySelector("#btn-info")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleInfoPopover();
    });

    this.element.querySelector("#btn-lang-trigger")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.openMenu = this.openMenu === "lang" ? null : "lang";
      this.renderBottomHud();
    });

    this.element.querySelector("#btn-auto-rotate")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.handlers.onToggleAutoRotateLang();
    });

    this.element.querySelectorAll(".lang-opt").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const lang = (btn as HTMLElement).getAttribute("data-lang");
        if (lang) {
          this.selectedLang = lang;
          this.openMenu = null;
          this.handlers.onSelectLang(lang);
          this.render();
        }
      });
    });

    this.element.querySelector("#btn-palette-trigger")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.openMenu = this.openMenu === "palette" ? null : "palette";
      this.renderBottomHud();
    });

    this.element.querySelectorAll(".palette-opt").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const paletteId = (btn as HTMLElement).getAttribute("data-palette-id") || "original";
        this.openMenu = null;
        this.selectPaletteById(paletteId);
      });
    });
  }

  private render(): void {
    this.renderTopBar();
    this.renderInspectorDrawer();
    this.renderBottomHud();
  }
}
