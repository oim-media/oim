/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { iconClose, iconSearch } from "./icons.js";
import type { UiLang } from "./dropzone.js";
import {
  type ShowcaseItem,
  LibraryClient,
  globalLibraryCache,
  formatCompactTitle,
} from "../library/libraryClient.js";

export interface LibraryModalHandlers {
  onSelectItem: (item: ShowcaseItem, blob: Blob) => void;
  onClose?: () => void;
}

export class LibraryModal {
  private container: HTMLElement;
  private overlayEl: HTMLElement | null = null;
  private client: LibraryClient;
  private uiLang: UiLang;
  private handlers: LibraryModalHandlers;
  private items: ShowcaseItem[] = [];
  private filteredItems: ShowcaseItem[] = [];
  private selectedCategory = "all";
  private searchQuery = "";
  private isLoading = true;
  private activeLoadingId: string | null = null;
  private lastSeenDate: string | null = null;

  constructor(container: HTMLElement, handlers: LibraryModalHandlers, uiLang: UiLang = "es") {
    this.container = container;
    this.handlers = handlers;
    this.uiLang = uiLang;
    this.client = new LibraryClient(globalLibraryCache);

    if (typeof localStorage !== "undefined") {
      this.lastSeenDate = localStorage.getItem("oim_viewer_library_last_seen");
    }
  }

  private t(es: string, en: string): string {
    return this.uiLang === "es" ? es : en;
  }

  public async open(): Promise<void> {
    if (this.overlayEl) return;
    this.renderOverlay();
    await this.loadItems();
  }

  public close(): void {
    if (!this.overlayEl) return;
    this.overlayEl.style.opacity = "0";
    const panel = this.overlayEl.querySelector("#library-dialog") as HTMLElement | null;
    if (panel) {
      panel.style.transform = "scale(0.98) translateY(6px)";
    }
    window.setTimeout(() => {
      this.overlayEl?.remove();
      this.overlayEl = null;
      this.handlers.onClose?.();
    }, 150);
  }

  public isOpen(): boolean {
    return this.overlayEl !== null;
  }

  private async loadItems(): Promise<void> {
    this.isLoading = true;
    this.renderBody();

    try {
      const items = await this.client.fetchShowcaseItems();
      this.items = items;
      this.applyFilter();
      this.isLoading = false;
      this.renderBody();

      if (items.length > 0) {
        this.client.markAsSeen(items[0].created_at);
      }
    } catch (err) {
      console.error("[LibraryModal] Failed to load showcase items:", err);
      this.isLoading = false;
      this.renderBody(true);
    }
  }

  private applyFilter(): void {
    const q = this.searchQuery.trim().toLowerCase();
    this.filteredItems = this.items.filter((item) => {
      const matchesCategory =
        this.selectedCategory === "all" ||
        (item.category && item.category.toLowerCase().includes(this.selectedCategory.toLowerCase()));

      if (!matchesCategory) return false;
      if (!q) return true;

      const titleMatch =
        (item.title && item.title.toLowerCase().includes(q)) ||
        (item.title_en && item.title_en.toLowerCase().includes(q));
      const tagMatch = item.tags?.some((t) => t.toLowerCase().includes(q));
      const authorMatch = item.author?.username?.toLowerCase().includes(q);

      return titleMatch || tagMatch || authorMatch;
    });

    const countEl = this.overlayEl?.querySelector("#library-item-count");
    if (countEl) {
      countEl.textContent = `${this.filteredItems.length} ${this.t("obras", "items")}`;
    }
  }

  private renderOverlay(): void {
    this.overlayEl = document.createElement("div");
    this.overlayEl.id = "library-modal-overlay";
    this.overlayEl.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.76);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      z-index: 200;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      opacity: 0;
      transition: opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1);
      user-select: none;
    `;

    this.overlayEl.innerHTML = `
      <div id="library-dialog" role="dialog" aria-modal="true" style="
        width: 92vw;
        max-width: 960px;
        height: 84vh;
        max-height: 740px;
        background: #0f1013;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 14px;
        box-shadow: 0 24px 64px -12px rgba(0, 0, 0, 0.85);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transform: scale(0.98) translateY(6px);
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        color: #f4f4f5;
      ">
        <!-- Quiet Header -->
        <header style="
          padding: 14px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-shrink: 0;
        ">
          <div style="display: flex; align-items: baseline; gap: 8px;">
            <h2 style="font-size: 14px; font-weight: 600; color: #f4f4f5; letter-spacing: -0.01em; margin: 0;">
              ${this.t("Biblioteca Pública", "Public Library")}
            </h2>
            <span id="library-item-count" style="
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
              font-size: 11px;
              color: #71717a;
            ">
              ${this.items.length > 0 ? `${this.items.length} ${this.t("obras", "items")}` : ""}
            </span>
          </div>

          <div style="display: flex; align-items: center; gap: 10px;">
            <!-- Live Search -->
            <div style="
              position: relative;
              display: flex;
              align-items: center;
              width: 200px;
            ">
              <span style="
                position: absolute;
                left: 9px;
                color: #71717a;
                display: flex;
                pointer-events: none;
              ">${iconSearch}</span>
              <input id="library-search-input" type="text" placeholder="${this.t("Buscar obra...", "Search artwork...")}" value="${this.searchQuery}" style="
                width: 100%;
                height: 30px;
                padding: 0 10px 0 28px;
                border-radius: 6px;
                background: rgba(255, 255, 255, 0.04);
                border: 1px solid rgba(255, 255, 255, 0.08);
                color: #f4f4f5;
                font-size: 12px;
                outline: none;
                transition: border-color 0.15s ease;
              " />
            </div>

            <!-- Close Button -->
            <button id="btn-close-modal" type="button" aria-label="Close" style="
              width: 28px;
              height: 28px;
              border-radius: 6px;
              background: transparent;
              border: 1px solid transparent;
              color: #a1a1aa;
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              transition: color 0.15s ease, background 0.15s ease;
            ">
              ${iconClose}
            </button>
          </div>
        </header>

        <!-- Segmented Filter Bar -->
        <div style="
          padding: 10px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          gap: 4px;
          overflow-x: auto;
          flex-shrink: 0;
        ">
          ${this.renderCategoryChips()}
        </div>

        <!-- Scrollable Artwork Grid Container -->
        <div id="library-dialog-body" style="
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 16px 20px 24px 20px;
          display: flex;
          flex-direction: column;
        ">
        </div>
      </div>
    `;

    this.container.appendChild(this.overlayEl);

    requestAnimationFrame(() => {
      if (this.overlayEl) {
        this.overlayEl.style.opacity = "1";
        const panel = this.overlayEl.querySelector("#library-dialog") as HTMLElement | null;
        if (panel) {
          panel.style.transform = "scale(1) translateY(0)";
        }
      }
    });

    this.overlayEl.querySelector("#btn-close-modal")?.addEventListener("click", () => this.close());

    this.overlayEl.addEventListener("click", (e) => {
      if (e.target === this.overlayEl) this.close();
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && this.isOpen()) {
        this.close();
        window.removeEventListener("keydown", onKeyDown);
      }
    };
    window.addEventListener("keydown", onKeyDown);

    const searchInput = this.overlayEl.querySelector("#library-search-input") as HTMLInputElement | null;
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.searchQuery = (e.target as HTMLInputElement).value;
        this.applyFilter();
        this.renderBody();
      });
    }

    this.wireCategoryClicks();
  }

  private renderCategoryChips(): string {
    const categories = [
      { id: "all", label: this.t("Todas", "All") },
      { id: "ui", label: "UI & Dashboards" },
      { id: "marketing", label: "Marketing" },
      { id: "arte", label: this.t("Arte", "Art") },
      { id: "tipografia", label: this.t("Tipografía", "Typography") },
    ];

    return categories
      .map((cat) => {
        const active = this.selectedCategory === cat.id;
        return `
          <button type="button" data-cat="${cat.id}" style="
            padding: 4px 10px;
            border-radius: 9999px;
            font-size: 11px;
            font-weight: ${active ? "600" : "500"};
            cursor: pointer;
            border: 1px solid ${active ? "#ffffff" : "transparent"};
            background: ${active ? "#ffffff" : "transparent"};
            color: ${active ? "#09090b" : "#a1a1aa"};
            transition: all 0.12s ease;
            white-space: nowrap;
          ">
            ${cat.label}
          </button>
        `;
      })
      .join("");
  }

  private wireCategoryClicks(): void {
    const chipButtons = this.overlayEl?.querySelectorAll("button[data-cat]");
    chipButtons?.forEach((btn) => {
      btn.addEventListener("click", () => {
        this.selectedCategory = btn.getAttribute("data-cat") || "all";
        const parent = btn.parentElement;
        if (parent) {
          parent.innerHTML = this.renderCategoryChips();
          this.wireCategoryClicks();
        }
        this.applyFilter();
        this.renderBody();
      });
    });
  }

  private renderBody(isError = false): void {
    const bodyEl = this.overlayEl?.querySelector("#library-dialog-body");
    if (!bodyEl) return;

    if (this.isLoading) {
      bodyEl.innerHTML = `
        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: #71717a;">
          <div style="
            width: 20px;
            height: 20px;
            border: 2px solid rgba(255, 255, 255, 0.12);
            border-top-color: #ffffff;
            border-radius: 50%;
            animation: spin 0.7s linear infinite;
          "></div>
          <span style="font-size: 11px;">${this.t("Cargando obras...", "Loading artworks...")}</span>
          <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
        </div>
      `;
      return;
    }

    if (isError) {
      bodyEl.innerHTML = `
        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: #f87171;">
          <span style="font-size: 12px; font-weight: 500;">
            ${this.t("No se pudo conectar con la biblioteca pública.", "Could not connect to public library.")}
          </span>
          <button id="btn-retry-library" type="button" style="
            background: #ffffff;
            color: #09090b;
            border: none;
            border-radius: 6px;
            padding: 6px 14px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
          ">
            ${this.t("Reintentar", "Retry")}
          </button>
        </div>
      `;
      bodyEl.querySelector("#btn-retry-library")?.addEventListener("click", () => void this.loadItems());
      return;
    }

    if (this.filteredItems.length === 0) {
      bodyEl.innerHTML = `
        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: #71717a;">
          <span style="font-size: 13px; font-weight: 500; color: #a1a1aa;">
            ${this.t("Sin resultados", "No results")}
          </span>
          <span style="font-size: 11px;">
            ${this.t("Intenta buscar con otros términos.", "Try different search terms.")}
          </span>
        </div>
      `;
      return;
    }

    bodyEl.innerHTML = `
      <div id="library-cards-grid" style="
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
        gap: 14px;
        width: 100%;
      ">
        ${this.filteredItems
          .map((item) => {
            const title = (this.uiLang === "en" && item.title_en ? item.title_en : item.title) || item.id;
            const compact = formatCompactTitle(title, 24);
            const isNew =
              this.lastSeenDate && new Date(item.created_at).getTime() > new Date(this.lastSeenDate).getTime();
            const author = item.author?.username || "Xue Studios";
            const isLoadingThis = this.activeLoadingId === item.id;

            return `
              <div class="library-card" data-id="${item.id}" role="button" tabindex="0" style="
                background: #141519;
                border: 1px solid rgba(255, 255, 255, 0.06);
                border-radius: 10px;
                overflow: hidden;
                cursor: pointer;
                display: flex;
                flex-direction: column;
                position: relative;
                transition: border-color 0.15s ease;
              ">
                <!-- Preview Canvas -->
                <div style="
                  width: 100%;
                  aspect-ratio: 16 / 10;
                  background: #0b0c0e;
                  position: relative;
                  overflow: hidden;
                ">
                  <img src="${item.thumbnail_url || item.media_url}" alt="${title}" loading="lazy" style="
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                  " />

                  ${
                    isNew
                      ? `<span style="
                          position: absolute;
                          top: 8px;
                          left: 8px;
                          background: rgba(34, 197, 94, 0.9);
                          color: #0b0c0e;
                          font-size: 9px;
                          font-weight: 700;
                          padding: 1px 5px;
                          border-radius: 3px;
                          letter-spacing: 0.03em;
                        ">${this.t("NUEVO", "NEW")}</span>`
                      : ""
                  }

                  <span style="
                    position: absolute;
                    bottom: 6px;
                    right: 6px;
                    background: rgba(0, 0, 0, 0.72);
                    backdrop-filter: blur(4px);
                    color: #a1a1aa;
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                    font-size: 9px;
                    padding: 2px 5px;
                    border-radius: 4px;
                  ">
                    ${item.aspect_ratio || "1:1"}
                  </span>

                  <!-- Loading Overlay -->
                  <div class="card-loading-mask" style="
                    position: absolute;
                    inset: 0;
                    background: rgba(14, 15, 18, 0.88);
                    display: ${isLoadingThis ? "flex" : "none"};
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    color: #f4f4f5;
                  ">
                    <div style="
                      width: 18px;
                      height: 18px;
                      border: 2px solid rgba(255, 255, 255, 0.15);
                      border-top-color: #ffffff;
                      border-radius: 50%;
                      animation: spin 0.7s linear infinite;
                    "></div>
                    <span style="font-size: 11px; font-weight: 500;">
                      ${this.t("Cargando obra...", "Loading artwork...")}
                    </span>
                  </div>
                </div>

                <!-- Clean Meta Footer -->
                <div style="padding: 10px 12px; display: flex; flex-direction: column; gap: 3px;">
                  <span style="
                    font-size: 12px;
                    font-weight: 500;
                    color: #f4f4f5;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                  " title="${title}">${compact}</span>

                  <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #71717a;">
                    <span>@${author}</span>
                    <span>${item.category || "OIM"}</span>
                  </div>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;

    bodyEl.querySelectorAll(".library-card").forEach((card) => {
      const cardEl = card as HTMLElement;
      cardEl.addEventListener("mouseenter", () => {
        if (!this.activeLoadingId) {
          cardEl.style.borderColor = "rgba(255, 255, 255, 0.2)";
        }
      });
      cardEl.addEventListener("mouseleave", () => {
        if (!this.activeLoadingId) {
          cardEl.style.borderColor = "rgba(255, 255, 255, 0.06)";
        }
      });

      cardEl.addEventListener("click", async () => {
        const id = cardEl.getAttribute("data-id");
        const item = this.filteredItems.find((i) => i.id === id);
        if (!item || this.activeLoadingId) return;

        this.activeLoadingId = id;
        const mask = cardEl.querySelector(".card-loading-mask") as HTMLElement | null;
        if (mask) mask.style.display = "flex";

        try {
          const bytes = await this.client.fetchOimBytes(item.media_url);
          const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
          const cleanBuffer = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
          const blob = new Blob([cleanBuffer], { type: "image/png" });

          this.close();
          this.handlers.onSelectItem(item, blob);
        } catch (err) {
          console.error("[LibraryModal] Failed to load selected item:", err);
          if (mask) mask.style.display = "none";
          this.activeLoadingId = null;
        }
      });
    });
  }
}
