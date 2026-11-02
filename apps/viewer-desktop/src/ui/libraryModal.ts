/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { iconClose, iconSearch, iconSparkles } from "./icons.js";
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
  private isSelecting = false;
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
      panel.style.transform = "scale(0.97) translateY(8px)";
    }
    window.setTimeout(() => {
      this.overlayEl?.remove();
      this.overlayEl = null;
      this.handlers.onClose?.();
    }, 180);
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

      // Mark library as seen now that user has opened it
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
  }

  private renderOverlay(): void {
    this.overlayEl = document.createElement("div");
    this.overlayEl.id = "library-modal-overlay";
    this.overlayEl.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(8, 8, 12, 0.82);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      z-index: 200;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      opacity: 0;
      transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      user-select: none;
    `;

    this.overlayEl.innerHTML = `
      <div id="library-dialog" role="dialog" aria-modal="true" style="
        width: 100%;
        max-width: 960px;
        height: 86vh;
        max-height: 800px;
        background: rgba(18, 18, 22, 0.94);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 16px;
        box-shadow: 0 32px 80px -16px rgba(0, 0, 0, 0.85);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transform: scale(0.97) translateY(8px);
        transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        color: #f4f4f5;
      ">
        <!-- Header -->
        <header style="
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-shrink: 0;
        ">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="
              width: 32px;
              height: 32px;
              border-radius: 10px;
              background: rgba(255, 255, 255, 0.06);
              border: 1px solid rgba(255, 255, 255, 0.1);
              display: flex;
              align-items: center;
              justify-content: center;
              color: #f59e0b;
            ">
              ${iconSparkles}
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <h2 style="font-size: 15px; font-weight: 700; color: #ffffff; letter-spacing: -0.01em; margin: 0;">
                  ${this.t("Biblioteca Pública OIM", "OIM Public Library")}
                </h2>
                <span style="
                  font-size: 10px;
                  font-weight: 700;
                  padding: 2px 7px;
                  border-radius: 9999px;
                  background: rgba(34, 197, 94, 0.12);
                  color: #4ade80;
                  border: 1px solid rgba(34, 197, 94, 0.25);
                ">
                  ${this.t("Obras Verificadas", "Verified Artworks")}
                </span>
              </div>
              <p style="font-size: 11px; color: #a1a1aa; margin: 2px 0 0 0;">
                ${this.t(
                  "Explora y reproduce imágenes interactivas en vivo (sin descarga local)",
                  "Explore and run live interactive images in-memory (no local download)"
                )}
              </p>
            </div>
          </div>

          <button id="btn-close-modal" type="button" aria-label="Close" style="
            width: 32px;
            height: 32px;
            border-radius: 8px;
            background: transparent;
            border: 1px solid rgba(255, 255, 255, 0.08);
            color: #a1a1aa;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.15s ease;
          ">
            ${iconClose}
          </button>
        </header>

        <!-- Search & Filter Controls -->
        <div style="
          padding: 12px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          background: rgba(14, 14, 18, 0.4);
          flex-shrink: 0;
        ">
          <!-- Category Chips -->
          <div id="category-chips" style="display: flex; align-items: center; gap: 6px; overflow-x: auto;">
            ${this.renderCategoryChips()}
          </div>

          <!-- Search Input -->
          <div style="
            position: relative;
            display: flex;
            align-items: center;
            min-width: 220px;
          ">
            <span style="
              position: absolute;
              left: 10px;
              color: #71717a;
              display: flex;
              pointer-events: none;
            ">${iconSearch}</span>
            <input id="library-search-input" type="text" placeholder="${this.t("Buscar por título o tag...", "Search title or tag...")}" value="${this.searchQuery}" style="
              width: 100%;
              padding: 6px 12px 6px 32px;
              border-radius: 8px;
              background: rgba(255, 255, 255, 0.05);
              border: 1px solid rgba(255, 255, 255, 0.1);
              color: #ffffff;
              font-size: 12px;
              outline: none;
              transition: border-color 0.15s ease;
            " />
          </div>
        </div>

        <!-- Scrollable Cards Grid Container -->
        <div id="library-dialog-body" style="
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 20px;
          display: flex;
          flex-direction: column;
        ">
        </div>
      </div>
    `;

    this.container.appendChild(this.overlayEl);

    // Fade in
    requestAnimationFrame(() => {
      if (this.overlayEl) {
        this.overlayEl.style.opacity = "1";
        const panel = this.overlayEl.querySelector("#library-dialog") as HTMLElement | null;
        if (panel) {
          panel.style.transform = "scale(1) translateY(0)";
        }
      }
    });

    // Close button
    this.overlayEl.querySelector("#btn-close-modal")?.addEventListener("click", () => this.close());

    // Click outside backdrop
    this.overlayEl.addEventListener("click", (e) => {
      if (e.target === this.overlayEl) this.close();
    });

    // Escape key
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && this.isOpen()) {
        this.close();
        window.removeEventListener("keydown", onKeyDown);
      }
    };
    window.addEventListener("keydown", onKeyDown);

    // Search input handler
    const searchInput = this.overlayEl.querySelector("#library-search-input") as HTMLInputElement | null;
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.searchQuery = (e.target as HTMLInputElement).value;
        this.applyFilter();
        this.renderBody();
      });
    }

    // Category click handler
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
            font-weight: 600;
            cursor: pointer;
            border: 1px solid ${active ? "#ffffff" : "rgba(255, 255, 255, 0.08)"};
            background: ${active ? "#ffffff" : "rgba(255, 255, 255, 0.04)"};
            color: ${active ? "#09090b" : "#d4d4d8"};
            transition: all 0.15s ease;
            white-space: nowrap;
          ">
            ${cat.label}
          </button>
        `;
      })
      .join("");
  }

  private wireCategoryClicks(): void {
    const chipContainer = this.overlayEl?.querySelector("#category-chips");
    if (!chipContainer) return;
    chipContainer.querySelectorAll("button[data-cat]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.selectedCategory = btn.getAttribute("data-cat") || "all";
        chipContainer.innerHTML = this.renderCategoryChips();
        this.wireCategoryClicks();
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
        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: #a1a1aa;">
          <div style="
            width: 24px;
            height: 24px;
            border: 2px solid rgba(255, 255, 255, 0.15);
            border-top-color: #ffffff;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          "></div>
          <span style="font-size: 12px;">${this.t("Cargando galería pública...", "Loading public gallery...")}</span>
          <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
        </div>
      `;
      return;
    }

    if (isError) {
      bodyEl.innerHTML = `
        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: #f87171;">
          <p style="font-size: 13px; font-weight: 600;">
            ${this.t("No se pudo conectar con la biblioteca pública.", "Could not connect to public library.")}
          </p>
          <button id="btn-retry-library" type="button" style="
            background: #ffffff;
            color: #0b0c0e;
            border: none;
            border-radius: 8px;
            padding: 8px 16px;
            font-size: 12px;
            font-weight: 700;
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
        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: #71717a;">
          <span style="font-size: 14px; font-weight: 600; color: #e4e4e7;">
            ${this.t("No se encontraron obras", "No artworks found")}
          </span>
          <span style="font-size: 12px;">
            ${this.t("Intenta buscar con otros términos o cambiar la categoría.", "Try different search terms or select another category.")}
          </span>
        </div>
      `;
      return;
    }

    // Grid of artworks
    bodyEl.innerHTML = `
      <div id="library-cards-grid" style="
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 16px;
        width: 100%;
      ">
        ${this.filteredItems
          .map((item) => {
            const title = (this.uiLang === "en" && item.title_en ? item.title_en : item.title) || item.id;
            const compact = formatCompactTitle(title, 22);
            const isNew =
              this.lastSeenDate && new Date(item.created_at).getTime() > new Date(this.lastSeenDate).getTime();
            const author = item.author?.username || "Xue Studios";

            return `
              <div class="library-card" data-id="${item.id}" role="button" tabindex="0" style="
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 12px;
                overflow: hidden;
                cursor: pointer;
                display: flex;
                flex-direction: column;
                transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.18s ease, box-shadow 0.18s ease;
              ">
                <!-- Thumbnail Container -->
                <div style="
                  width: 100%;
                  aspect-ratio: 16 / 10;
                  background: #121216;
                  position: relative;
                  overflow: hidden;
                ">
                  <img src="${item.thumbnail_url || item.media_url}" alt="${title}" loading="lazy" style="
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    transition: transform 0.25s ease;
                  " />
                  
                  ${
                    isNew
                      ? `<span style="
                          position: absolute;
                          top: 8px;
                          left: 8px;
                          background: #22c55e;
                          color: #0b0c0e;
                          font-size: 9px;
                          font-weight: 800;
                          padding: 2px 6px;
                          border-radius: 4px;
                          letter-spacing: 0.04em;
                        ">${this.t("NUEVO", "NEW")}</span>`
                      : ""
                  }

                  <span style="
                    position: absolute;
                    bottom: 8px;
                    right: 8px;
                    background: rgba(0, 0, 0, 0.65);
                    backdrop-filter: blur(8px);
                    color: #ffffff;
                    font-size: 10px;
                    font-weight: 600;
                    padding: 2px 6px;
                    border-radius: 4px;
                    border: 1px solid rgba(255, 255, 255, 0.12);
                  ">
                    ${item.aspect_ratio || "1:1"}
                  </span>
                </div>

                <!-- Info footer -->
                <div style="padding: 12px; display: flex; flex-direction: column; gap: 6px; flex: 1;">
                  <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                    <span style="
                      font-size: 13px;
                      font-weight: 700;
                      color: #f4f4f5;
                      overflow: hidden;
                      text-overflow: ellipsis;
                      white-space: nowrap;
                    " title="${title}">${compact}</span>
                  </div>

                  <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #71717a;">
                    <span>@${author}</span>
                    <span style="
                      font-size: 10px;
                      padding: 1px 6px;
                      border-radius: 4px;
                      background: rgba(255, 255, 255, 0.05);
                      color: #a1a1aa;
                    ">${item.category || "OIM"}</span>
                  </div>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;

    // Wire card interactions
    bodyEl.querySelectorAll(".library-card").forEach((card) => {
      const cardEl = card as HTMLElement;
      cardEl.addEventListener("mouseenter", () => {
        cardEl.style.transform = "translateY(-3px)";
        cardEl.style.borderColor = "rgba(255, 255, 255, 0.25)";
        cardEl.style.boxShadow = "0 12px 28px -6px rgba(0, 0, 0, 0.6)";
      });
      cardEl.addEventListener("mouseleave", () => {
        cardEl.style.transform = "translateY(0)";
        cardEl.style.borderColor = "rgba(255, 255, 255, 0.08)";
        cardEl.style.boxShadow = "none";
      });

      cardEl.addEventListener("click", async () => {
        const id = cardEl.getAttribute("data-id");
        const item = this.filteredItems.find((i) => i.id === id);
        if (!item || this.isSelecting) return;

        this.isSelecting = true;
        cardEl.style.opacity = "0.6";
        cardEl.style.pointerEvents = "none";

        try {
          const bytes = await this.client.fetchOimBytes(item.media_url);
          const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "image/png" });
          this.close();
          this.handlers.onSelectItem(item, blob);
        } catch (err) {
          console.error("[LibraryModal] Failed to load selected item:", err);
          cardEl.style.opacity = "1";
          cardEl.style.pointerEvents = "auto";
          this.isSelecting = false;
        }
      });
    });
  }
}
