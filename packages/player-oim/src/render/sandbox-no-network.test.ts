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

function fontList(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...fontList(p));
    else if (/\.(ts|js)$/.test(e.name) && !/\.test\.|\.d\.ts$/.test(e.name)) out.push(p);
  }
  return out;
}

describe("no player source requests typefaces from Google", () => {
  it("there is no remaining reference to fonts.googleapis.com or fonts.gstatic.com", () => {
    // The editor embeds its fonts. Requesting missing ones from Google would
    // reveal the IP address of whoever opens the file to a third party.
    const offenders = fontList(SRC).filter((f) => /fonts\.(googleapis|gstatic)\.com/.test(fs.readFileSync(f, "utf8")));
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });
});

describe("isSandboxImageSrc: an image travels inside the file or is not painted", () => {
  it("admite data:image y blob:", () => {
    expect(isSandboxImageSrc("data:image/png;base64,AAAA")).toBe(true);
    expect(isSandboxImageSrc("blob:https://oim.media/1234")).toBe(true);
  });

  it("rejects any network URL, including ours and localhost", () => {
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

describe("neutralizeExternalCssUrls: the file's CSS cannot request anything outside", () => {
  it("replaces network url() with none, with or without quotes and in uppercase", () => {
    expect(neutralizeExternalCssUrls("background:url(https://x.test/p.gif)")).toBe("background:none");
    expect(neutralizeExternalCssUrls('background: url("http://x.test/a")')).toBe("background: none");
    expect(neutralizeExternalCssUrls("background: URL( '//x.test/a' )")).toBe("background: none");
  });

  it("respects internal references and the data: URIs the player itself generates", () => {
    expect(neutralizeExternalCssUrls("filter:url(#grano)")).toBe("filter:url(#grano)");
    expect(neutralizeExternalCssUrls('mask:url("data:image/svg+xml,%3Csvg%3E")')).toBe('mask:url("data:image/svg+xml,%3Csvg%3E")');
  });

  it("works inside complete @keyframes", () => {
    const kf = "@keyframes a{0%{background-image:url(https://x.test/1.png)}100%{opacity:1}}";
    expect(neutralizeExternalCssUrls(kf)).toBe("@keyframes a{0%{background-image:none}100%{opacity:1}}");
  });
});

describe("sanitizeHtml neutralizes network url() in style attributes", () => {
  it("a span with a remote background style keeps the style, without the request", () => {
    const html = sanitizeHtml('<span style="color:red;background:url(https://x.test/p.gif)">hola</span>');
    expect(html).not.toContain("x.test");
    expect(html).toContain("color:red");
  });
});

describe("the player no longer enforces allowed_domains", () => {
  it("verifyDomainLock disappears from the security module", () => {
    expect((security as Record<string, unknown>).verifyDomainLock).toBeUndefined();
  });

  it("a file signed with allowed_domains is verified the same everywhere", () => {
    const HASH = "a".repeat(64);
    const metadata = { image_hash: HASH, image_hash_alg: "sha256-idat", allowed_domains: ["otro-sitio.example"] };
    expect(securityVerdict({ isSigned: true, isSigValid: true, metadata, imageHash: HASH } as any)).toBe("verified");
  });
});
