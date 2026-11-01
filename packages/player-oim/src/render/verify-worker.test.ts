/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect } from "vitest";
import { createWorkerVerifier, WorkerUnavailableError } from "./verify-worker";

function fabrica() {
  const created: any[] = [];
  const make = () => {
    const w: any = { mensajes: [] as any[], terminado: false, onmessage: null, onerror: null,
      postMessage(m: any) { w.mensajes.push(m); }, terminate() { w.terminado = true; } };
    created.push(w);
    return w;
  };
  return { created, make };
}
const responder = (w: any, id: number, extra: object = {}) => w.onmessage({ data: { id, success: true, security: "verified", ...extra } });

describe("verificador compartido", () => {
  it("forty verifications create a single worker", async () => {
    const f = fabrica();
    const v = createWorkerVerifier(f.make);
    const all = Array.from({ length: 40 }, () => v.verify(new Blob(["x"]), "h", "o"));
    f.created[0].mensajes.forEach((m: any) => responder(f.created[0], m.id));
    await Promise.all(all);
    expect(f.created).toHaveLength(1);
  });

  it("the message carries the address of the keys: the worker does not see the page's config", async () => {
    const f = fabrica();
    const v = createWorkerVerifier(f.make);
    v.verify(new Blob(["x"]), "h", "o");
    expect(f.created[0].mensajes[0].keysUrl).toBe("https://api.oim.media/v1/media/keys");
  });

  it("pairs each response with its request even when they arrive in reverse order", async () => {
    const f = fabrica();
    const v = createWorkerVerifier(f.make);
    const a = v.verify(new Blob(["a"]), "h", "o");
    const b = v.verify(new Blob(["b"]), "h", "o");
    const [ma, mb] = f.created[0].mensajes;
    responder(f.created[0], mb.id, { security: "B" });
    responder(f.created[0], ma.id, { security: "A" });
    expect((await a).security).toBe("A");
    expect((await b).security).toBe("B");
  });

  it("if the worker crashes, it rejects the pending ones and the next one creates another", async () => {
    const f = fabrica();
    const v = createWorkerVerifier(f.make);
    const p = v.verify(new Blob(["x"]), "h", "o");
    f.created[0].onerror(new Event("error"));
    await expect(p).rejects.toBeTruthy();
    expect(f.created[0].terminado).toBe(true);
    const q = v.verify(new Blob(["y"]), "h", "o");
    expect(f.created).toHaveLength(2);
    responder(f.created[1], f.created[1].mensajes[0].id);
    await expect(q).resolves.toMatchObject({ success: true });
  });

  it("if it cannot be created (CSP), it rejects and does not try again", async () => {
    let intentos = 0;
    const v = createWorkerVerifier(() => { intentos++; throw new Error("CSP"); });
    await expect(v.verify(new Blob(["x"]), "h", "o")).rejects.toBeInstanceOf(WorkerUnavailableError);
    await expect(v.verify(new Blob(["y"]), "h", "o")).rejects.toBeInstanceOf(WorkerUnavailableError);
    expect(intentos).toBe(1);
  });
});
