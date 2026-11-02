/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { iconFolder, iconOimMarca, iconShieldAlert } from "./icons.js";

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
        border-radius: 10px;
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.25);
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
      border: 1px dashed rgba(255, 255, 255, 0.12);
      border-radius: 16px;
      background: #141519;
      max-width: 480px;
      width: 90%;
      text-align: center;
      transition: border-color 0.15s ease;
      box-shadow: 0 16px 36px -8px rgba(0, 0, 0, 0.6);
    ">
      <div style="
        width: 64px;
        height: 64px;
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #f4f4f5;
      ">
        ${iconOimMarca}
      </div>
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <h2 style="font-size: 17px; font-weight: 600; letter-spacing: -0.01em; color: #f4f4f5; margin: 0;">
          ${t("Arrastra tu archivo OIM aquí", "Drag your OIM file here")}
        </h2>
        <p style="font-size: 12px; color: #8e8e93; line-height: 1.5; max-width: 340px; margin: 0;">
          ${t(
            "Abre una imagen interactiva (.oim o .oim.png) para reproducir sus capas dinámicas y verificar su firma criptográfica.",
            "Open an interactive image (.oim or .oim.png) to play its dynamic layers and verify its cryptographic signature."
          )}
        </p>
      </div>

      <div style="display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap;">
        <button id="btn-open-file" type="button" style="
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #ffffff;
          color: #09090b;
          border: none;
          border-radius: 8px;
          padding: 8px 16px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.12s ease;
        ">
          ${iconFolder}
          <span>${t("Abrir archivo (Ctrl+O)", "Open file (Ctrl+O)")}</span>
        </button>

        <button id="btn-open-library" type="button" style="
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(255, 255, 255, 0.05);
          color: #d4d4d8;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 8px 16px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.12s ease, border-color 0.12s ease;
        ">
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
