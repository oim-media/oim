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
} from "../library/libraryClient.js";

export interface LibraryModalHandlers {
  onSelectItem: (item: ShowcaseItem, blob: Blob) => void;
  onClose?: () => void;
}

const ANCHO_DE_COLUMNA = 270;
const MAX_COLUMNS = 6;

function repartirEnColumnas(items: ShowcaseItem[], numCols: number): ShowcaseItem[][] {
  const columns: ShowcaseItem[][] = Array.from({ length: numCols }, () => []);
  const heights = new Array(numCols).fill(0);

  for (const item of items) {
    const parts = (item.aspect_ratio || "1/1").split("/").map(Number);
    const w = parts[0] || 1;
    const h = parts[1] || 1;
    const proportion = h / w;
    let shortest = 0;
    for (let i = 1; i < numCols; i++) {
      if (heights[i] < heights[shortest]) shortest = i;
    }
    columns[shortest].push(item);
    heights[shortest] += proportion;
  }
  return columns;
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
  private resizeObserver: ResizeObserver | null = null;
  private currentColumns = 4;

  constructor(container: HTMLElement, handlers: LibraryModalHandlers, uiLang: UiLang = "es") {
    this.container = container;
    this.handlers = handlers;
    this.uiLang = uiLang;
    this.client = new LibraryClient(globalLibraryCache);
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
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
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
      background: rgba(0, 0, 0, 0.78);
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
        width: 94vw;
        max-width: 1400px;
        height: 88vh;
        max-height: 900px;
        background: #0f1013;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        box-shadow: 0 28px 72px -12px rgba(0, 0, 0, 0.9);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transform: scale(0.98) translateY(6px);
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        color: #f4f4f5;
      ">
        <style>
          @keyframes lib-spin { 100% { transform: rotate(360deg); } }
          .library-card:hover {
            border-color: rgba(255, 255, 255, 0.24) !important;
            box-shadow: 0 12px 28px -6px rgba(0, 0, 0, 0.7);
          }
          .library-card:hover .card-overlay {
            opacity: 1 !important;
          }
        </style>

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
              ${this.t("Biblioteca", "Library")}
            </h2>
            <span id="library-item-count" style="
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
              font-size: 11px;
              color: #71717a;
            ">
              ${this.items.length > 0 ? `${this.items.length} ${this.t("obras", "items")}` : ""}
            </span>
          </div>

          <div style="display: flex; align-items: center; gap: 12px;">
            <!-- Minimal Search -->
            <div style="
              position: relative;
              display: flex;
              align-items: center;
              width: 220px;
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

        <!-- Minimal Category Tabs Bar -->
        <div style="
          padding: 8px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          gap: 6px;
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
    this.setupResizeObserver();
  }

  private setupResizeObserver(): void {
    const bodyEl = this.overlayEl?.querySelector("#library-dialog-body") as HTMLElement | null;
    if (!bodyEl) return;

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width <= 0) continue;
        const newCols = Math.min(MAX_COLUMNS, Math.max(2, Math.floor(width / ANCHO_DE_COLUMNA)));
        if (newCols !== this.currentColumns) {
          this.currentColumns = newCols;
          this.renderBody();
        }
      }
    });
    this.resizeObserver.observe(bodyEl);
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
            padding: 5px 12px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: ${active ? "600" : "500"};
            cursor: pointer;
            border: 1px solid ${active ? "rgba(255, 255, 255, 0.16)" : "transparent"};
            background: ${active ? "rgba(255, 255, 255, 0.08)" : "transparent"};
            color: ${active ? "#ffffff" : "#8e8e93"};
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
            width: 22px;
            height: 22px;
            border: 2px solid rgba(255, 255, 255, 0.12);
            border-top-color: #ffffff;
            border-radius: 50%;
            animation: lib-spin 0.7s linear infinite;
          "></div>
          <span style="font-size: 11px;">${this.t("Cargando obras...", "Loading artworks...")}</span>
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

    const columns = repartirEnColumnas(this.filteredItems, this.currentColumns);

    bodyEl.innerHTML = `
      <div id="library-masonry-grid" style="
        display: flex;
        align-items: flex-start;
        gap: 10px;
        width: 100%;
      ">
        ${columns
          .map(
            (col) => `
          <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px;">
            ${col
              .map((item) => {
                const isLoadingThis = this.activeLoadingId === item.id;
                const ratio = item.aspect_ratio || "1/1";

                return `
                  <div class="library-card" data-id="${item.id}" role="button" tabindex="0" style="
                    position: relative;
                    width: 100%;
                    aspect-ratio: ${ratio};
                    background: #141519;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 6px;
                    overflow: hidden;
                    cursor: pointer;
                    display: block;
                    contain: paint;
                    transition: border-color 0.15s ease, box-shadow 0.15s ease;
                  ">
                    <img
                      src="${item.thumbnail_url || item.media_url}"
                      alt=""
                      loading="lazy"
                      decoding="async"
                      draggable="false"
                      style="
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                        display: block;
                        pointer-events: none;
                      "
                    />

                    <!-- Pure visual card, no text footer below. Clean hover overlay -->
                    <div class="card-overlay" style="
                      position: absolute;
                      inset: 0;
                      background: rgba(0, 0, 0, 0.38);
                      opacity: 0;
                      transition: opacity 0.16s ease;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      pointer-events: none;
                    ">
                      <span style="
                        font-size: 11px;
                        font-weight: 600;
                        padding: 6px 14px;
                        border-radius: 6px;
                        background: #ffffff;
                        color: #09090b;
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
                        letter-spacing: -0.01em;
                      ">${this.t("Abrir", "Open")}</span>
                    </div>

                    ${
                      isLoadingThis
                        ? `
                      <div style="
                        position: absolute;
                        inset: 0;
                        background: rgba(0, 0, 0, 0.65);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 10;
                      ">
                        <div style="
                          width: 20px;
                          height: 20px;
                          border: 2px solid rgba(255, 255, 255, 0.2);
                          border-top-color: #ffffff;
                          border-radius: 50%;
                          animation: lib-spin 0.6s linear infinite;
                        "></div>
                      </div>
                    `
                        : ""
                    }
                  </div>
                `;
              })
              .join("")}
          </div>
        `
          )
          .join("")}
      </div>
    `;

    this.wireCardClicks();
  }

  private wireCardClicks(): void {
    const cards = this.overlayEl?.querySelectorAll(".library-card");
    cards?.forEach((card) => {
      const clickHandler = async () => {
        const id = card.getAttribute("data-id");
        if (!id || this.activeLoadingId) return;

        const item = this.filteredItems.find((i) => i.id === id);
        if (!item) return;

        this.activeLoadingId = id;
        this.renderBody();

        try {
          const bytes = await this.client.fetchOimBytes(item.media_url);
          const blob = new Blob([bytes as unknown as BlobPart], { type: "image/png" });
          this.close();
          this.handlers.onSelectItem(item, blob);
        } catch (err) {
          console.error("[LibraryModal] Failed to load media:", err);
          alert(this.t("No se pudo cargar la obra seleccionada.", "Could not load selected artwork."));
        } finally {
          this.activeLoadingId = null;
        }
      };

      card.addEventListener("click", () => void clickHandler());
      card.addEventListener("keydown", (e: Event) => {
        if ((e as KeyboardEvent).key === "Enter") {
          void clickHandler();
        }
      });
    });
  }
}
