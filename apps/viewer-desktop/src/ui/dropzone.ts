/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { iconFolder, iconOimMarca, iconShieldAlert, iconSparkles } from "./icons.js";

export type UiLang = "es" | "en";

export function detectUiLang(): UiLang {
  if (typeof navigator !== "undefined" && typeof navigator.language === "string") {
    return navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
  }
  return "es";
}

export function renderDropzone(
  container: HTMLElement,
  onSelectFile: () => void,
  opts?: { uiLang?: UiLang; errorMessage?: string | null; onOpenLibrary?: () => void }
): void {
  const lang = opts?.uiLang ?? detectUiLang();
  const t = (es: string, en: string) => (lang === "es" ? es : en);
  const errorHtml = opts?.errorMessage
    ? `
      <div id="dropzone-error" style="
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 16px;
        border-radius: 12px;
        background: rgba(239, 68, 68, 0.12);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: #f87171;
        font-size: 12px;
        line-height: 1.45;
        text-align: left;
        max-width: 440px;
        width: 100%;
      ">
        <span style="flex-shrink: 0; display: flex;">${iconShieldAlert}</span>
        <span>${opts.errorMessage}</span>
      </div>
    `
    : "";

  container.innerHTML = `
    <div id="dropzone-area" style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 20px;
      padding: 48px 36px;
      border: 1.5px dashed rgba(255, 255, 255, 0.14);
      border-radius: 20px;
      background: #1e2024;
      max-width: 520px;
      width: 90%;
      text-align: center;
      transition: border-color 0.2s ease, background 0.2s ease;
      box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.6);
    ">
      <div style="
        width: 72px;
        height: 72px;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #f3f4f6;
      ">
        ${iconOimMarca}
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <h2 style="font-size: 19px; font-weight: 700; letter-spacing: -0.02em; color: #f3f4f6;">
          ${t("Arrastra tu archivo OIM aquí", "Drag your OIM file here")}
        </h2>
        <p style="font-size: 13px; color: #9ca3af; line-height: 1.5; max-width: 380px;">
          ${t(
            "Abre una imagen interactiva (.oim o .oim.png) para reproducir sus capas dinámicas y verificar su firma criptográfica.",
            "Open an interactive image (.oim or .oim.png) to play its dynamic layers and verify its cryptographic signature."
          )}
        </p>
      </div>

      <div style="display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap;">
        <button id="btn-open-file" type="button" style="
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #ffffff;
          color: #0b0c0e;
          border: none;
          border-radius: 10px;
          padding: 10px 18px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 0.15s ease;
        ">
          ${iconFolder}
          <span>${t("Abrir archivo (Ctrl+O)", "Open file (Ctrl+O)")}</span>
        </button>

        <button id="btn-open-library" type="button" style="
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 255, 255, 0.08);
          color: #f3f4f6;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 10px;
          padding: 10px 18px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease;
        ">
          <span style="color: #f59e0b; display: flex; align-items: center;">${iconSparkles}</span>
          <span>${t("Explorar biblioteca pública", "Explore public library")}</span>
        </button>
      </div>

      ${errorHtml}
    </div>
  `;

  const btn = container.querySelector("#btn-open-file");
  if (btn) {
    btn.addEventListener("click", onSelectFile);
  }

  const libBtn = container.querySelector("#btn-open-library");
  if (libBtn && opts?.onOpenLibrary) {
    libBtn.addEventListener("click", opts.onOpenLibrary);
  }
}
