/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from "vitest";

describe("the worker returns the id of each request", () => {
  it("also when the file is not a .oim", async () => {
    const enviados: any[] = [];
    (globalThis as any).postMessage = vi.fn((m: any) => enviados.push(m));
    await import("./worker");
    await (globalThis as any).onmessage({ data: { id: 7, blob: new Blob(["no es un png"]), hostname: "", origin: "" } });
    await (globalThis as any).onmessage({ data: { id: 8, blob: new Blob([]), hostname: "", origin: "" } });
    expect(enviados.map((m) => m.id)).toEqual([7, 8]);
  });
});
