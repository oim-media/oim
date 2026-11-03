/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { detectUiLang, renderDropzone } from "./ui/dropzone.js";
import { LibraryModal } from "./ui/libraryModal.js";
import { LibraryClient } from "./library/libraryClient.js";
import { FloatingToolbar } from "./ui/toolbar.js";
import {
  buildSpecsSummary,
  mountOimPlayer,
  pngSize,
  type PlayerInstance,
  type StageSize,
} from "./viewer/playerBridge.js";

// Intercept fetch for remote assets to bypass webview CORS in Tauri
const originalFetch = window.fetch;
window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (typeof url === "string" && (url.includes("assets.oim.media") || url.includes("supabase.co/storage"))) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const rawBytes = await invoke<number[] | Uint8Array>("read_remote_oim_file", { url });
      const bytes = rawBytes instanceof Uint8Array ? rawBytes : new Uint8Array(rawBytes);
      return new Response(bytes as unknown as BodyInit, {
        status: 200,
        headers: { "Content-Type": "image/png" },
      });
    } catch {
      // Fallback
    }
  }
  return originalFetch.call(this, input, init);
};

const app = document.getElementById("app") as HTMLElement;
const uiLang = detectUiLang();
const t = (es: string, en: string) => (uiLang === "es" ? es : en);

let currentPlayer: PlayerInstance | null = null;
let isPlaying = true;
let isLayersVisible = true;
let isLottieEnabled = true;
let isFullscreen = false;
let isAutoRotateLang = false;

const workspaceRow = document.createElement("div");
workspaceRow.id = "viewer-workspace";
workspaceRow.style.cssText =
  "flex: 1; min-width: 0; min-height: 0; width: 100%; height: 100%; position: relative; display: flex; overflow: hidden;";
app.appendChild(workspaceRow);

const stageWrapper = document.createElement("div");
stageWrapper.id = "stage-wrapper";
stageWrapper.style.cssText =
  "flex: 1; min-width: 0; min-height: 0; width: 100%; height: 100%; position: relative; display: flex; align-items: center; justify-content: center; container-type: size; padding: 20px;";
workspaceRow.appendChild(stageWrapper);

const playerFrame = document.createElement("div");
playerFrame.id = "player-frame";
playerFrame.style.cssText =
  "width: 100%; height: 100%; position: relative; display: flex; align-items: center; justify-content: center;";
stageWrapper.appendChild(playerFrame);

const playerContainer = document.createElement("div");
playerContainer.id = "player-container";
playerContainer.style.cssText =
  "position: absolute; inset: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;";
playerFrame.appendChild(playerContainer);


let libraryModal: LibraryModal | null = null;
function openLibraryModal(): void {
  if (!libraryModal) {
    libraryModal = new LibraryModal(
      app,
      {
        onSelectItem: (item, blob) => {
          const title = (uiLang === "en" && item.title_en ? item.title_en : item.title) || item.id;
          void loadBlob(blob, title, { isLibraryItem: true });
        },
      },
      uiLang
    );
  }
  void libraryModal.open();
}

async function checkLibraryUpdates(): Promise<void> {
  try {
    const client = new LibraryClient();
    const result = await client.checkForUpdates();
    if (result.hasNew) {
      hasPendingLibraryUpdates = true;
      toolbar?.setHasLibraryUpdates(true);
    }
  } catch (err) {
    console.warn("[ViewerDesktop] Failed to check library updates:", err);
  }
}

let toolbar: FloatingToolbar | null = null;
let hasPendingLibraryUpdates = false;
let currentStageSize: StageSize | null = null;

/**
 * Applies exact aspect-ratio bounding on `playerFrame` while keeping `playerContainer`
 * at `position: absolute; inset: 0; width: 100%; height: 100%`.
 * This guarantees `<oim-player>` always reads a definite parent `offsetWidth` and `offsetHeight`
 * (preventing 1080x1080 cropping and avoiding any `ResizeObserver` feedback loop).
 */
function applyStageAspectRatio(size: StageSize | null): void {
  currentStageSize = size;
  if (!size) {
    stageWrapper.style.padding = isFullscreen ? "0" : "20px";
    playerFrame.style.width = "100%";
    playerFrame.style.height = "100%";
    playerFrame.style.aspectRatio = "";
    playerFrame.style.borderRadius = "0";
    playerFrame.style.boxShadow = "none";
    playerFrame.style.overflow = "visible";
    return;
  }
  const ratio = Number((size.width / size.height).toFixed(4));
  stageWrapper.style.padding = isFullscreen ? "0" : "20px";
  playerFrame.style.aspectRatio = `${size.width} / ${size.height}`;
  playerFrame.style.width = isFullscreen
    ? `min(100cqw, calc(100cqh * ${ratio}))`
    : `min(calc(100cqw - 24px), calc((100cqh - 24px) * ${ratio}))`;
  playerFrame.style.height = "auto";
  playerFrame.style.borderRadius = isFullscreen ? "0" : "8px";
  playerFrame.style.overflow = "hidden";
  playerFrame.style.boxShadow = isFullscreen
    ? "none"
    : "0 24px 60px -12px rgba(0, 0, 0, 0.72), 0 0 0 1px rgba(255, 255, 255, 0.08)";
}

function ensureToolbar(): FloatingToolbar {
  if (!toolbar) {
    toolbar = new FloatingToolbar(
      app,
      {
        onTogglePlay: togglePlay,
        onToggleLayers: toggleLayers,
        onToggleLottie: toggleLottie,
        onToggleFullscreen: () => {
          void toggleFullscreen();
        },
        onSelectLang: (lang) => {
          currentPlayer?.setLang(lang);
        },
        onToggleAutoRotateLang: () => {
          if (!currentPlayer) return;
          isAutoRotateLang = !isAutoRotateLang;
          currentPlayer.setAutoRotateLang(isAutoRotateLang);
          toolbar?.setAutoRotateLang(isAutoRotateLang);
        },
        onSelectPalette: (paletteName) => {
          currentPlayer?.setPalette(paletteName);
        },
        onSelectPaletteOption: (palette) => {
          if (!currentPlayer) return;
          const authorName = palette.id.startsWith("author:")
            ? palette.id.slice("author:".length)
            : null;
          currentPlayer.applyPaletteColors(
            palette.id === "original" ? null : palette.colors,
            authorName
          );
        },
        onOpenFile: () => {
          void openFileDialog();
        },
        onOpenLibrary: () => {
          openLibraryModal();
        },
      },
      uiLang,
      workspaceRow
    );
  }
  if (hasPendingLibraryUpdates) {
    toolbar.setHasLibraryUpdates(true);
  }
  return toolbar;
}

async function loadBlob(blob: Blob, fileName: string, opts?: { isLibraryItem?: boolean }): Promise<void> {
  if (currentPlayer) {
    currentPlayer.destroy();
    currentPlayer = null;
  }
  isPlaying = true;
  isLayersVisible = true;
  isLottieEnabled = true;
  isAutoRotateLang = false;

  const headerBytes = new Uint8Array(
    await blob.slice(0, 24).arrayBuffer().catch(() => new ArrayBuffer(0))
  );
  const stageSize = pngSize(headerBytes);
  applyStageAspectRatio(stageSize);

  currentPlayer = mountOimPlayer(playerContainer, blob, {
    onLoaded: (meta, security, instance) => {
      // If metadata carries explicit canvas dimensions and PNG header did not, apply them
      const canvas = meta?.canvas;
      const metaWidth = Number(meta?.width || canvas?.natural_width || stageSize?.width || 0);
      const metaHeight = Number(meta?.height || canvas?.natural_height || stageSize?.height || 0);
      const resolvedStage =
        metaWidth > 0 && metaHeight > 0 ? { width: metaWidth, height: metaHeight } : stageSize;
      applyStageAspectRatio(resolvedStage);

      const tb = ensureToolbar();
      tb.setChromeVisible(true);
      tb.setSecurityStatus(meta ? security : "no_metadata");
      tb.setLibraryItem(opts?.isLibraryItem ?? false);

      const specs = buildSpecsSummary(meta, fileName, blob.size, resolvedStage);
      const langs =
        instance.getLanguages().length > 0
          ? instance.getLanguages()
          : specs.capabilities.languages;
      const activeLang = instance.getCurrentLang();
      tb.setLanguages(langs, activeLang);

      tb.setPalettes(specs.palettes, specs.defaultPalette);
      tb.setActivePaletteId(
        specs.defaultPalette ? `author:${specs.defaultPalette}` : "original"
      );
      tb.setSpecs(specs);
      tb.setPlaying(isPlaying);
      tb.setLayersVisible(isLayersVisible);
      tb.setAllowLottie(isLottieEnabled);
      tb.setAutoRotateLang(isAutoRotateLang);
      instance.setDisableAnimations(false);
      instance.play();
      tb.show();
    },
    onLangChange: (lang) => {
      if (toolbar && currentPlayer) {
        toolbar.setLanguages(currentPlayer.getLanguages(), lang);
      }
    },
    onError: (_err, security) => {
      if (currentPlayer) {
        currentPlayer.destroy();
        currentPlayer = null;
      }
      applyStageAspectRatio(null);
      const tb = ensureToolbar();
      tb.setSpecs(null);
      tb.setChromeVisible(true);
      tb.setSecurityStatus(security);
      tb.show();

      const msg =
        security === "image_mismatch"
          ? t(
              "La imagen de este archivo fue alterada: no coincide con el sello criptográfico de OIM. Por seguridad no se muestra.",
              "This file's image was altered: it does not match OIM's cryptographic seal. For safety, it is not shown."
            )
          : security === "invalid_signature"
            ? t(
                "Los metadatos de este archivo fueron alterados: su firma criptográfica no es válida. Por seguridad no se muestra.",
                "This file's metadata was altered: its cryptographic signature is invalid. For safety, it is not shown."
              )
            : t(
                "El archivo está corrupto o sus metadatos no superan la validación del esquema OIM.",
                "The file is corrupt or its metadata fails OIM schema validation."
              );

      renderDropzone(playerContainer, () => void openFileDialog(), {
        uiLang,
        errorMessage: msg,
      });
    },
  });
}

function fileNameFromPath(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || "file.oim.png";
}

async function loadFromNativePath(path: string): Promise<void> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const rawBytes = await invoke<number[] | Uint8Array>("read_oim_file", { path });
    const bytes = new Uint8Array(rawBytes);
    const blob = new Blob([bytes], { type: "image/png" });
    await loadBlob(blob, fileNameFromPath(path));
  } catch (err) {
    console.error("[ViewerDesktop] Error reading native path:", err);
  }
}

function togglePlay(): void {
  if (!currentPlayer) return;
  isPlaying = !isPlaying;
  currentPlayer.setDisableAnimations(!isPlaying);
  if (isPlaying) {
    currentPlayer.play();
  } else {
    currentPlayer.pause();
  }
  toolbar?.setPlaying(isPlaying);
}

function toggleLayers(): void {
  if (!currentPlayer) return;
  isLayersVisible = !isLayersVisible;
  currentPlayer.toggleSlots(isLayersVisible);
  toolbar?.setLayersVisible(isLayersVisible);
}

function toggleLottie(): void {
  if (!currentPlayer) return;
  isLottieEnabled = !isLottieEnabled;
  currentPlayer.setAllowLottie(isLottieEnabled);
  toolbar?.setAllowLottie(isLottieEnabled);
}

async function setFullscreenState(targetFullscreen: boolean): Promise<void> {
  // Yield execution tick to allow any in-flight mouseup/click event to resolve
  await new Promise((resolve) => setTimeout(resolve, 30));

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const isFs = await invoke<boolean>("set_window_fullscreen", { fullscreen: targetFullscreen });
    isFullscreen = isFs;
    applyStageAspectRatio(currentStageSize);
    toolbar?.setFullscreen(isFullscreen);
    return;
  } catch (err) {
    console.warn("[ViewerDesktop] Custom set_window_fullscreen failed, falling back to window API:", err);
  }

  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = getCurrentWindow();
    await win.setFullscreen(targetFullscreen);
    try {
      await win.setCursorVisible(true);
      await win.setFocus();
    } catch {}
    isFullscreen = targetFullscreen;
    applyStageAspectRatio(currentStageSize);
    toolbar?.setFullscreen(isFullscreen);
    return;
  } catch {
    // Fallback for standard web browser outside Tauri
  }

  if (targetFullscreen && !document.fullscreenElement) {
    await document.documentElement.requestFullscreen().catch(() => {});
    isFullscreen = Boolean(document.fullscreenElement);
  } else if (!targetFullscreen && document.fullscreenElement) {
    await document.exitFullscreen().catch(() => {});
    isFullscreen = false;
  } else {
    isFullscreen = targetFullscreen;
  }
  applyStageAspectRatio(currentStageSize);
  toolbar?.setFullscreen(isFullscreen);
}

async function toggleFullscreen(): Promise<void> {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = getCurrentWindow();
    const current = await win.isFullscreen();
    await setFullscreenState(!current);
    return;
  } catch {
    await setFullscreenState(!isFullscreen);
  }
}

async function openFileDialog(): Promise<void> {
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      multiple: false,
      filters: [{ name: "OIM Interactive Image", extensions: ["oim", "png"] }],
    });

    if (selected && typeof selected === "string") {
      await loadFromNativePath(selected);
    }
  } catch {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".oim,.png";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) void loadBlob(file, file.name);
    };
    input.click();
  }
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    togglePlay();
  } else if (e.code === "KeyL") {
    e.preventDefault();
    toggleLayers();
  } else if (e.code === "KeyI") {
    e.preventDefault();
    toolbar?.toggleInfoPopover();
  } else if (e.key === "F11") {
    e.preventDefault();
    void toggleFullscreen();
  } else if (e.code === "KeyO" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    void openFileDialog();
  } else if (e.key === "Escape" && isFullscreen) {
    e.preventDefault();
    void setFullscreenState(false);
  }
});

// Browser Drag & Drop fallback
window.addEventListener("dragover", (e) => {
  e.preventDefault();
});

window.addEventListener("drop", (e) => {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  if (file) {
    void loadBlob(file, file.name);
  }
});

// Tauri native events: initial CLI file, single-instance `open-file`, and native `tauri://drag-drop`
async function initTauriBridge(): Promise<void> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const { listen } = await import("@tauri-apps/api/event");

    await listen<string>("open-file", (event) => {
      if (typeof event.payload === "string" && event.payload.trim()) {
        void loadFromNativePath(event.payload);
      }
    });

    await listen<{ paths?: string[] }>("tauri://drag-drop", (event) => {
      const firstPath = event.payload?.paths?.[0];
      if (firstPath) {
        void loadFromNativePath(firstPath);
      }
    });

    const initialPath = await invoke<string | null>("take_initial_file");
    if (initialPath) {
      await loadFromNativePath(initialPath);
    }
  } catch {
    // Running in a standard browser outside Tauri
  }
}

renderDropzone(playerContainer, () => void openFileDialog(), { uiLang, onOpenLibrary: openLibraryModal });
void initTauriBridge();
void checkLibraryUpdates();
