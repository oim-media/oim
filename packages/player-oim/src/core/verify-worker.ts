/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import OimWorker from './worker.js?worker&inline';
import { keysEndpoint } from './keys.js';

export interface WorkerReply {
  id?: number;
  success?: boolean;
  refused?: boolean;
  security?: string;
  metadata?: any;
  error?: string;
}

export interface WorkerLike {
  postMessage(message: any): void;
  terminate(): void;
  onmessage: ((e: MessageEvent) => void) | null;
  onerror: ((e: any) => void) | null;
}

/** The page cannot run workers (usually a CSP): the caller verifies on the main thread. */
export class WorkerUnavailableError extends Error {
  constructor(public readonly reason: unknown) {
    super('Web Worker unavailable');
    this.name = 'WorkerUnavailableError';
  }
}

/**
 * One verification worker per page instead of one per file.
 *
 * Creating the worker re-evaluates its whole inlined code (PNG parser, signature
 * crypto, blocklist), and a gallery of 40 different files used to do it 40
 * times. Requests carry an id so concurrent replies cannot be crossed; the
 * registry already caps concurrent decompressions at 3.
 */
export function createWorkerVerifier(makeWorker: () => WorkerLike) {
  let worker: WorkerLike | null = null;
  let unavailable: unknown = null;
  let nextId = 1;
  const pending = new Map<number, { resolve: (r: WorkerReply) => void; reject: (e: unknown) => void }>();

  function failAll(err: unknown): void {
    const all = [...pending.values()];
    pending.clear();
    all.forEach((p) => p.reject(err));
  }

  function ensureWorker(): WorkerLike {
    if (worker) return worker;
    const w = makeWorker(); // throws when a CSP forbids workers
    w.onmessage = (e: MessageEvent) => {
      const reply = e.data as WorkerReply;
      const entry = reply && typeof reply.id === 'number' ? pending.get(reply.id) : undefined;
      if (!entry) return;
      pending.delete(reply.id as number);
      entry.resolve(reply);
    };
    w.onerror = (err: any) => {
      // A crashed worker is discarded; the next request creates a fresh one.
      try { w.terminate(); } catch { /* already gone */ }
      if (worker === w) worker = null;
      failAll(err);
    };
    worker = w;
    return w;
  }

  return {
    verify(blob: Blob, hostname: string, origin: string): Promise<WorkerReply> {
      if (unavailable) return Promise.reject(new WorkerUnavailableError(unavailable));
      let w: WorkerLike;
      try {
        w = ensureWorker();
      } catch (err) {
        // Remembered: 40 players must not each retry a worker the page forbids.
        unavailable = err || true;
        return Promise.reject(new WorkerUnavailableError(err));
      }
      const id = nextId++;
      return new Promise<WorkerReply>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        // The worker has no `window`: without this it would always ask the
        // default endpoint, whatever the page configured.
        w.postMessage({ id, blob, hostname, origin, keysUrl: keysEndpoint() });
      });
    },
    stats() {
      return { alive: worker !== null, pending: pending.size };
    },
  };
}

let shared: ReturnType<typeof createWorkerVerifier> | null = null;

export function verifyInWorker(blob: Blob, hostname: string, origin: string): Promise<WorkerReply> {
  if (!shared) shared = createWorkerVerifier(() => new OimWorker() as unknown as WorkerLike);
  return shared.verify(blob, hostname, origin);
}
