/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  iconCheck,
  iconChevronDown,
  iconFolder,
  iconGlobe,
  iconInfo,
  iconLayers,
  iconLayersOff,
  iconLock,
  iconMaximize,
  iconMinimize,
  iconOimMarcaSimple,
  iconPalette,
  iconPause,
  iconPlay,
  iconRefresh,
  iconShieldAlert,
  iconShieldCheck,
  iconShieldWarning,
  iconUnlock,
} from "./icons.js";
import type { UiLang } from "./dropzone.js";
import { detectUiLang } from "./dropzone.js";
import type { OimSpecsSummary, ViewerSecurityStatus } from "../viewer/playerBridge.js";

export interface ToolbarHandlers {
  onTogglePlay: () => void;
  onToggleLayers: () => void;
  onToggleFullscreen: () => void;
  onSelectLang: (lang: string) => void;
  onToggleAutoRotateLang: () => void;
  onSelectPalette: (paletteName: string | null) => void;
  onOpenFile: () => void;
}

export class FloatingToolbar {
  private element: HTMLElement;
  private isPlaying = true;
  private showLayers = true;
  private isFullscreen = false;
  private autoRotateLang = false;
  private hideTimer: number | null = null;
  private handlers: ToolbarHandlers;
  private currentLangs: string[] = [];
  private selectedLang = "es";
  private palettes: string[] = [];
  private selectedPalette: string | null = null;
  private securityStatus: ViewerSecurityStatus = "unsigned";
  private specs: OimSpecsSummary | null = null;
  private openMenu: "lang" | "palette" | "info" | null = null;
  private uiLang: UiLang;

  constructor(container: HTMLElement, handlers: ToolbarHandlers, uiLang?: UiLang) {
    this.handlers = handlers;
    this.uiLang = uiLang ?? detectUiLang();
    this.element = document.createElement("div");
    this.element.id = "floating-toolbar";
    this.element.style.cssText = `
      position: absolute;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      background: rgba(21, 22, 25, 0.88);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 9999px;
      color: #f3f4f6;
      box-shadow: 0 16px 36px -8px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(0, 0, 0, 0.25);
      transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
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

  public setFullscreen(fullscreen: boolean): void {
    this.isFullscreen = fullscreen;
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
    this.render();
  }

  public setSpecs(specs: OimSpecsSummary | null): void {
    this.specs = specs;
    this.render();
  }

  public toggleInfoPopover(): void {
    this.openMenu = this.openMenu === "info" ? null : "info";
    this.show();
    this.render();
  }

  public show(): void {
    this.element.style.opacity = "1";
    this.element.style.pointerEvents = "auto";
    this.element.style.transform = "translateX(-50%) translateY(0)";
    this.resetTimer();
  }

  private hide(): void {
    if (this.openMenu !== null) return;
    this.element.style.opacity = "0";
    this.element.style.pointerEvents = "none";
    this.element.style.transform = "translateX(-50%) translateY(8px)";
  }

  private resetTimer(): void {
    if (this.hideTimer !== null) {
      window.clearTimeout(this.hideTimer);
    }
    this.hideTimer = window.setTimeout(() => {
      this.hide();
    }, 3500);
  }

  private setupAutoHide(listenTarget: HTMLElement): void {
    const onActivity = () => this.show();
    listenTarget.addEventListener("mousemove", onActivity);
    listenTarget.addEventListener("click", onActivity);
    this.resetTimer();
  }

  public getSecurityBadgeConfig(): { icon: string; text: string; color: string; bg: string } {
    switch (this.securityStatus) {
      case "verified":
        return {
          icon: iconShieldCheck,
          text: this.t("Firmado con OIM", "Signed with OIM"),
          color: "#22c55e",
          bg: "rgba(34, 197, 94, 0.12)",
        };
      case "verified_authorless":
        return {
          icon: iconShieldCheck,
          text: this.t("Firmado · sin autoría", "Signed · no authorship"),
          color: "#38bdf8",
          bg: "rgba(56, 189, 248, 0.12)",
        };
      case "image_unsealed":
        return {
          icon: iconShieldWarning,
          text: this.t("Firmado · sin sello", "Signed · unsealed"),
          color: "#cbd5e1",
          bg: "rgba(148, 163, 184, 0.12)",
        };
      case "expired_key":
        return {
          icon: iconShieldWarning,
          text: this.t("Clave expirada", "Expired key"),
          color: "#f59e0b",
          bg: "rgba(245, 158, 11, 0.12)",
        };
      case "no_metadata":
        return {
          icon: iconShieldWarning,
          text: this.t("Sin datos OIM", "No OIM data"),
          color: "#f59e0b",
          bg: "rgba(245, 158, 11, 0.12)",
        };
      case "image_mismatch":
        return {
          icon: iconShieldAlert,
          text: this.t("Imagen alterada", "Image altered"),
          color: "#ef4444",
          bg: "rgba(239, 68, 68, 0.15)",
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
          bg: "rgba(239, 68, 68, 0.15)",
        };
      case "unsigned":
      default:
        return {
          icon: iconShieldWarning,
          text: this.t("Sin firma", "Unsigned"),
          color: "#9ca3af",
          bg: "rgba(156, 163, 175, 0.1)",
        };
    }
  }

  private renderSpecsPopover(): string {
    if (!this.specs) return "";
    const s = this.specs;
    const slotEntries = Object.entries(s.slotTypes);
    const reeditLabel =
      s.reeditPolicy === "public"
        ? this.t("Público (editable)", "Public (re-editable)")
        : s.reeditPolicy === "sealed"
          ? this.t("Sellado (inmutable)", "Sealed (immutable)")
          : this.t("Solo autor", "Author only");

    return `
      <div id="info-popover" style="
        position: absolute;
        bottom: calc(100% + 10px);
        right: 0;
        background: rgba(24, 24, 27, 0.96);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 14px;
        padding: 14px;
        box-shadow: 0 16px 36px rgba(0, 0, 0, 0.65);
        display: ${this.openMenu === "info" ? "flex" : "none"};
        flex-direction: column;
        gap: 10px;
        width: 268px;
        z-index: 120;
        font-size: 11px;
      ">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 8px;">
          <span style="font-weight: 700; color: #f3f4f6; text-transform: uppercase; letter-spacing: 0.06em;">
            ${this.t("Ficha Técnica", "Technical Specs")}
          </span>
          <span style="color: #9ca3af; font-family: ui-monospace, monospace;">v${s.schemaVersion}</span>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <div style="background: rgba(255, 255, 255, 0.04); padding: 7px 9px; border-radius: 8px;">
            <span style="color: #9ca3af; font-size: 10px; display: block;">${this.t("Archivo", "File")}</span>
            <span style="color: #f3f4f6; font-weight: 600; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${s.fileName}">${s.fileName}</span>
          </div>
          <div style="background: rgba(255, 255, 255, 0.04); padding: 7px 9px; border-radius: 8px;">
            <span style="color: #9ca3af; font-size: 10px; display: block;">${this.t("Peso", "Size")}</span>
            <span style="color: #f3f4f6; font-weight: 600;">${s.fileSizeFormatted}</span>
          </div>
          <div style="background: rgba(255, 255, 255, 0.04); padding: 7px 9px; border-radius: 8px;">
            <span style="color: #9ca3af; font-size: 10px; display: block;">${this.t("Resolución", "Dimensions")}</span>
            <span style="color: #f3f4f6; font-weight: 600;">${s.dimensionsLabel}</span>
          </div>
          <div style="background: rgba(255, 255, 255, 0.04); padding: 7px 9px; border-radius: 8px;">
            <span style="color: #9ca3af; font-size: 10px; display: block;">${this.t("Reedición", "Re-edit")}</span>
            <span style="color: #f3f4f6; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
              <span style="color: ${s.reeditPolicy === "public" ? "#22c55e" : "#f59e0b"}; display: flex;">
                ${s.reeditPolicy === "public" ? iconUnlock : iconLock}
              </span>
              ${reeditLabel}
            </span>
          </div>
        </div>
        ${
          slotEntries.length > 0
            ? `
          <div style="background: rgba(255, 255, 255, 0.04); padding: 8px 9px; border-radius: 8px;">
            <span style="color: #9ca3af; font-size: 10px; display: block; margin-bottom: 5px;">
              ${s.slotsCount} ${this.t("capas interactivas", "interactive layers")}
            </span>
            <div style="display: flex; flex-wrap: wrap; gap: 4px;">
              ${slotEntries
                .map(
                  ([type, count]) => `
                <span style="padding: 2px 6px; border-radius: 5px; background: rgba(255,255,255,0.08); color: #d1d5db; font-size: 10px; font-family: ui-monospace, monospace;">
                  ${type.toUpperCase()}: <strong>${count}</strong>
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
    `;
  }

  private render(): void {
    const sec = this.getSecurityBadgeConfig();
    const hasMultipleLangs = this.currentLangs.length > 1;
    const hasPalettes = this.palettes.length > 0;

    this.element.innerHTML = `
      <!-- Marca oficial simplificada (<= 32px) -->
      <div title="OIM Viewer" style="display: flex; align-items: center; color: #f3f4f6; padding-left: 2px;">
        ${iconOimMarcaSimple}
      </div>

      <!-- Badge de Seguridad Criptográfica -->
      <div id="security-badge" title="${sec.text}" style="
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        background: ${sec.bg};
        color: ${sec.color};
        border: 1px solid ${sec.color}40;
        border-radius: 9999px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.01em;
        white-space: nowrap;
      ">
        ${sec.icon}
        <span>${sec.text}</span>
      </div>

      <div style="width: 1px; height: 16px; background: rgba(255, 255, 255, 0.14);"></div>

      <!-- Play / Pause -->
      <button id="btn-play" type="button" title="${this.isPlaying ? this.t("Pausar animaciones (Espacio)", "Pause animations (Space)") : this.t("Reproducir animaciones (Espacio)", "Play animations (Space)")}" style="
        background: none;
        border: none;
        color: #ffffff;
        cursor: pointer;
        display: flex;
        align-items: center;
        padding: 6px;
        border-radius: 6px;
      ">
        ${this.isPlaying ? iconPause : iconPlay}
      </button>

      <!-- Toggle Capas Dinámicas -->
      <button id="btn-layers" type="button" title="${this.showLayers ? this.t("Ocultar capa interactiva (L)", "Hide interactive layer (L)") : this.t("Mostrar capa interactiva (L)", "Show interactive layer (L)")}" style="
        background: ${this.showLayers ? "transparent" : "rgba(239, 68, 68, 0.15)"};
        border: none;
        color: ${this.showLayers ? "#ffffff" : "#f87171"};
        cursor: pointer;
        display: flex;
        align-items: center;
        padding: 6px;
        border-radius: 6px;
      ">
        ${this.showLayers ? iconLayers : iconLayersOff}
      </button>

      <!-- Selector de Idiomas + Auto-rotación -->
      <div id="lang-picker-container" style="
        position: relative;
        display: ${hasMultipleLangs ? "flex" : "none"};
        align-items: center;
      ">
        <button id="btn-lang-trigger" type="button" title="${this.t("Cambiar idioma", "Switch language")}" style="
          background: rgba(255, 255, 255, 0.07);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #ffffff;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 8px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 600;
        ">
          <span style="display: flex; align-items: center; color: #9ca3af;">${iconGlobe}</span>
          <span style="letter-spacing: 0.05em;">${this.selectedLang.toUpperCase()}</span>
          <span style="display: flex; align-items: center; color: #9ca3af;">${iconChevronDown}</span>
        </button>

        <div id="lang-menu" style="
          position: absolute;
          bottom: calc(100% + 10px);
          left: 50%;
          transform: translateX(-50%);
          background: rgba(24, 24, 27, 0.96);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 10px;
          padding: 4px;
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.65);
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
                padding: 6px 10px;
                background: ${isSelected ? "rgba(255, 255, 255, 0.12)" : "transparent"};
                border: none;
                border-radius: 6px;
                color: ${isSelected ? "#ffffff" : "#9ca3af"};
                font-size: 11px;
                font-weight: ${isSelected ? "700" : "500"};
                cursor: pointer;
                text-align: left;
                width: 100%;
              ">
                <span>${l.toUpperCase()}</span>
                <span style="display: flex; align-items: center; color: #22c55e; opacity: ${isSelected ? "1" : "0"};">
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
            gap: 8px;
            padding: 6px 10px;
            background: ${this.autoRotateLang ? "rgba(245, 158, 11, 0.15)" : "transparent"};
            border: none;
            border-radius: 6px;
            color: ${this.autoRotateLang ? "#f59e0b" : "#9ca3af"};
            font-size: 10px;
            font-weight: 600;
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

      <!-- Selector de Paletas Nombradas (1.20.0+) -->
      <div id="palette-picker-container" style="
        position: relative;
        display: ${hasPalettes ? "flex" : "none"};
        align-items: center;
      ">
        <button id="btn-palette-trigger" type="button" title="${this.t("Cambiar paleta de color", "Switch color palette")}" style="
          background: rgba(255, 255, 255, 0.07);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #ffffff;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 8px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 600;
        ">
          <span style="display: flex; align-items: center; color: #9ca3af;">${iconPalette}</span>
          <span>${(this.selectedPalette ?? this.t("Auto", "Auto")).toUpperCase()}</span>
          <span style="display: flex; align-items: center; color: #9ca3af;">${iconChevronDown}</span>
        </button>

        <div id="palette-menu" style="
          position: absolute;
          bottom: calc(100% + 10px);
          left: 50%;
          transform: translateX(-50%);
          background: rgba(24, 24, 27, 0.96);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 10px;
          padding: 4px;
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.65);
          display: ${this.openMenu === "palette" ? "flex" : "none"};
          flex-direction: column;
          gap: 2px;
          min-width: 110px;
          z-index: 120;
        ">
          <button class="palette-opt" type="button" data-palette="" style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 6px 10px;
            background: ${this.selectedPalette === null ? "rgba(255, 255, 255, 0.12)" : "transparent"};
            border: none;
            border-radius: 6px;
            color: ${this.selectedPalette === null ? "#ffffff" : "#9ca3af"};
            font-size: 11px;
            font-weight: ${this.selectedPalette === null ? "700" : "500"};
            cursor: pointer;
            width: 100%;
          ">
            <span>${this.t("Automática", "Auto")}</span>
            <span style="display: flex; align-items: center; color: #22c55e; opacity: ${this.selectedPalette === null ? "1" : "0"};">
              ${iconCheck}
            </span>
          </button>
          ${this.palettes
            .map((p) => {
              const isSelected = p === this.selectedPalette;
              return `
              <button class="palette-opt" type="button" data-palette="${p}" style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 6px 10px;
                background: ${isSelected ? "rgba(255, 255, 255, 0.12)" : "transparent"};
                border: none;
                border-radius: 6px;
                color: ${isSelected ? "#ffffff" : "#9ca3af"};
                font-size: 11px;
                font-weight: ${isSelected ? "700" : "500"};
                cursor: pointer;
                width: 100%;
              ">
                <span>${p.toUpperCase()}</span>
                <span style="display: flex; align-items: center; color: #22c55e; opacity: ${isSelected ? "1" : "0"};">
                  ${iconCheck}
                </span>
              </button>
            `;
            })
            .join("")}
        </div>
      </div>

      <div style="width: 1px; height: 16px; background: rgba(255, 255, 255, 0.14);"></div>

      <!-- Ficha Técnica (I) -->
      <div style="position: relative; display: flex; align-items: center;">
        <button id="btn-info" type="button" title="${this.t("Ficha técnica (I)", "Technical specs (I)")}" style="
          background: ${this.openMenu === "info" ? "rgba(255, 255, 255, 0.14)" : "none"};
          border: none;
          color: #ffffff;
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 6px;
          border-radius: 6px;
        ">
          ${iconInfo}
        </button>
        ${this.renderSpecsPopover()}
      </div>

      <!-- Abrir otro archivo (Ctrl+O) -->
      <button id="btn-open-another" type="button" title="${this.t("Abrir otro archivo (Ctrl+O)", "Open another file (Ctrl+O)")}" style="
        background: none;
        border: none;
        color: #ffffff;
        cursor: pointer;
        display: flex;
        align-items: center;
        padding: 6px;
        border-radius: 6px;
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
        border-radius: 6px;
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
      this.openMenu = this.openMenu === "info" ? null : "info";
      this.render();
    });

    this.element.querySelector("#btn-lang-trigger")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.openMenu = this.openMenu === "lang" ? null : "lang";
      this.render();
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
      this.render();
    });

    this.element.querySelectorAll(".palette-opt").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const palette = (btn as HTMLElement).getAttribute("data-palette") || null;
        this.selectedPalette = palette;
        this.openMenu = null;
        this.handlers.onSelectPalette(palette);
        this.render();
      });
    });
  }
}
