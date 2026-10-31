/**
 * @vitest-environment happy-dom
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Un .oim es un sandbox: abrirlo no conecta con nadie.
 *
 * Decision de producto (24 sept 2026): el archivo se comporta como una imagen
 * cualquiera. La UNICA peticion aceptada es la clave publica que el player no
 * traiga incluida. Cada prueba de aqui cierra una via medida que la rompia;
 * ver docs/superpowers/specs/2026-09-24-player-sandbox-sin-red-design.md.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import * as security from "./security";
import { neutralizeExternalCssUrls, isSandboxImageSrc, sanitizeHtml, securityVerdict } from "./security";

const SRC = path.resolve(__dirname, "..");

function fuentes(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...fuentes(p));
    else if (/\.(ts|js)$/.test(e.name) && !/\.test\.|\.d\.ts$/.test(e.name)) out.push(p);
  }
  return out;
}

describe("ninguna fuente del player pide tipografias a Google", () => {
  it("no queda ninguna referencia a fonts.googleapis.com ni fonts.gstatic.com", () => {
    // El editor incrusta las fuentes. Pedir las que falten a Google revelaba
    // la IP de quien abre el archivo a un tercero.
    const culpables = fuentes(SRC).filter((f) => /fonts\.(googleapis|gstatic)\.com/.test(fs.readFileSync(f, "utf8")));
    expect(culpables.map((f) => path.relative(SRC, f))).toEqual([]);
  });
});

describe("isSandboxImageSrc: una imagen viaja dentro del archivo o no se pinta", () => {
  it("admite data:image y blob:", () => {
    expect(isSandboxImageSrc("data:image/png;base64,AAAA")).toBe(true);
    expect(isSandboxImageSrc("blob:https://oim.media/1234")).toBe(true);
  });

  it("rechaza cualquier URL de red, tambien las nuestras y localhost", () => {
    // Un <img src="https://..."> es un pixel de rastreo: el autor sabria quien
    // mira su obra. Ni siquiera assets.oim.media: el archivo debe bastarse solo.
    for (const src of [
      "https://tracker.example/p.gif",
      "https://assets.oim.media/u/abc.png",
      "http://localhost:3000/a.png",
      "http://127.0.0.1/a.png",
      "//cdn.example/a.png",
      "javascript:alert(1)",
      "",
    ]) {
      expect(isSandboxImageSrc(src), src).toBe(false);
    }
  });
});

describe("neutralizeExternalCssUrls: el CSS del archivo no puede pedir nada fuera", () => {
  it("sustituye url() de red por none, con o sin comillas y en mayusculas", () => {
    expect(neutralizeExternalCssUrls("background:url(https://x.test/p.gif)")).toBe("background:none");
    expect(neutralizeExternalCssUrls('background: url("http://x.test/a")')).toBe("background: none");
    expect(neutralizeExternalCssUrls("background: URL( '//x.test/a' )")).toBe("background: none");
  });

  it("respeta las referencias internas y los data: que genera el propio player", () => {
    expect(neutralizeExternalCssUrls("filter:url(#grano)")).toBe("filter:url(#grano)");
    expect(neutralizeExternalCssUrls('mask:url("data:image/svg+xml,%3Csvg%3E")')).toBe('mask:url("data:image/svg+xml,%3Csvg%3E")');
  });

  it("vale dentro de unos @keyframes completos", () => {
    const kf = "@keyframes a{0%{background-image:url(https://x.test/1.png)}100%{opacity:1}}";
    expect(neutralizeExternalCssUrls(kf)).toBe("@keyframes a{0%{background-image:none}100%{opacity:1}}");
  });
});

describe("sanitizeHtml neutraliza url() de red en los atributos style", () => {
  it("un span con style de fondo remoto conserva el estilo, sin la peticion", () => {
    const html = sanitizeHtml('<span style="color:red;background:url(https://x.test/p.gif)">hola</span>');
    expect(html).not.toContain("x.test");
    expect(html).toContain("color:red");
  });
});

describe("allowed_domains ya no la aplica el player", () => {
  it("verifyDomainLock desaparece del modulo de seguridad", () => {
    expect((security as Record<string, unknown>).verifyDomainLock).toBeUndefined();
  });

  it("un archivo firmado con allowed_domains se verifica igual en cualquier sitio", () => {
    const HASH = "a".repeat(64);
    const metadata = { image_hash: HASH, image_hash_alg: "sha256-idat", allowed_domains: ["otro-sitio.example"] };
    expect(securityVerdict({ isSigned: true, isSigValid: true, metadata, imageHash: HASH } as any)).toBe("verified");
  });
});
