/**
 * @vitest-environment happy-dom
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A .oim is a sandbox: opening it does not connect to anyone.
 *
 * Product decision: the file behaves like any ordinary image. The ONLY request
 * accepted is the public key that the player does not already include. Each
 * test here closes a measured route that used to break this rule.
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
    // The editor embeds its fonts. Requesting missing ones from Google would
    // reveal the IP address of whoever opens the file to a third party.
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
    // An <img src="https://..."> is a tracking pixel: the author would learn who
    // is viewing their work. Not even assets.oim.media: the file must be
    // self-contained.
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
