/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect, vi, afterEach } from "vitest";

afterEach(() => vi.unstubAllGlobals());

describe("el elemento escucha prefers-color-scheme y lo suelta al desconectarse", () => {
  it("adds and removes the change listener", async () => {
    await import("../index");
    const add = vi.fn();
    const remove = vi.fn();
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: add, removeEventListener: remove })));
    vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
    const el = document.createElement("oim-player");
    document.body.appendChild(el);
    expect(add).toHaveBeenCalledWith("change", expect.any(Function));
    const listener = add.mock.calls[0][1];
    el.remove();
    expect(remove).toHaveBeenCalledWith("change", listener);
  });
});
