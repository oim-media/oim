/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { detectUiLang, renderDropzone } from "./ui/dropzone.js";
import { FloatingToolbar } from "./ui/toolbar.js";
import {
  buildSpecsSummary,
  mountOimPlayer,
  pngSize,
  type PlayerInstance,
  type StageSize,
} from "./viewer/playerBridge.js";

const app = document.getElementById("app") as HTMLElement;
const uiLang = detectUiLang();
const t = (es: string, en: string) => (uiLang === "es" ? es : en);

let currentPlayer: PlayerInstance | null = null;
let isPlaying = true;
let isLayersVisible = true;
let isFullscreen = false;
let isAutoRotateLang = false;

const stageWrapper = document.createElement("div");
stageWrapper.id = "stage-wrapper";
stageWrapper.style.cssText =
  "width: 100%; height: 100%; position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; container-type: size; padding: 16px;";
app.appendChild(stageWrapper);

const playerContainer = document.createElement("div");
playerContainer.id = "player-container";
playerContainer.style.cssText =
  "width: 100%; height: 100%; position: relative; display: flex; align-items: center; justify-content: center;";
stageWrapper.appendChild(playerContainer);

let toolbar: FloatingToolbar | null = null;

function applyStageAspectRatio(size: StageSize | null): void {
  if (!size) {
    playerContainer.style.width = "100%";
    playerContainer.style.height = "100%";
    playerContainer.style.aspectRatio = "";
    return;
  }
  const ratio = Number((size.width / size.height).toFixed(4));
  playerContainer.style.aspectRatio = `${size.width} / ${size.height}`;
  playerContainer.style.width = `min(calc(100cqw - 24px), calc((100cqh - 24px) * ${ratio}))`;
  playerContainer.style.height = "auto";
}

function ensureToolbar(): FloatingToolbar {
  if (!toolbar) {
    toolbar = new FloatingToolbar(
      app,
      {
        onTogglePlay: togglePlay,
        onToggleLayers: toggleLayers,
        onToggleFullscreen: toggleFullscreen,
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
        onOpenFile: () => {
          void openFileDialog();
        },
      },
      uiLang
    );
  }
  return toolbar;
}

async function loadBlob(blob: Blob, fileName: string): Promise<void> {
  if (currentPlayer) {
    currentPlayer.destroy();
    currentPlayer = null;
  }
  isPlaying = true;
  isLayersVisible = true;
  isAutoRotateLang = false;

  const headerBytes = new Uint8Array(await blob.slice(0, 24).arrayBuffer().catch(() => new ArrayBuffer(0)));
  const stageSize = pngSize(headerBytes);
  applyStageAspectRatio(stageSize);

  currentPlayer = mountOimPlayer(playerContainer, blob, {
    onLoaded: (meta, security, instance) => {
      const tb = ensureToolbar();
      tb.setSecurityStatus(meta ? security : "no_metadata");

      const langs = instance.getLanguages();
      const activeLang = instance.getCurrentLang();
      tb.setLanguages(langs, activeLang);

      const specs = buildSpecsSummary(meta, fileName, blob.size, stageSize);
      tb.setPalettes(specs.palettes, specs.defaultPalette);
      tb.setSpecs(specs);
      tb.setPlaying(isPlaying);
      tb.setLayersVisible(isLayersVisible);
      tb.setAutoRotateLang(isAutoRotateLang);
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

async function toggleFullscreen(): Promise<void> {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen().catch(() => {});
    isFullscreen = true;
  } else {
    await document.exitFullscreen().catch(() => {});
    isFullscreen = false;
  }
  toolbar?.setFullscreen(isFullscreen);
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
  } else if (e.key === "Escape" && document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
    isFullscreen = false;
    toolbar?.setFullscreen(false);
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

renderDropzone(playerContainer, () => void openFileDialog(), { uiLang });
void initTauriBridge();
