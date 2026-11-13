/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// How the upgrade guarantees that nothing is lost in silence. A converter
// never reads a 1.x object directly: it `take`s the key, which also marks it
// as converted. When the upgrade ends, every key of every registered object
// that was neither taken nor retired is reported as unhandled.

import type { Layer } from "../schema.js";

export type V1Object = Record<string, unknown>;
/** A 1.x slot with its aliases already resolved. */
export type V1Slot = { raw: V1Object; style: V1Object; type: string };
export type DraftLayer = Layer;

export type UpgradeContext = {
  canvas: { width: number; height: number };
  /** The main language: the one a bare string of content belongs to. */
  language: string;
  /** Whether the document's palettes define this colour role. */
  hasRole(role: string): boolean;
  /** Lets `finish` see this object. `label` prefixes its keys in the reports. */
  register(owner: V1Object, label: string): void;
  /** Reads a key AND marks it as converted. */
  take<T = unknown>(owner: V1Object, key: string): T | undefined;
  /** Marks a key as dropped on purpose. */
  retire(owner: V1Object, key: string): void;
  /** Reports something that could not be converted, with its reason. */
  note(path: string): void;
  finish(): { retired: string[]; unhandled: string[] };
};

export function createContext(
  canvas: { width: number; height: number },
  language: string,
  roles: ReadonlySet<string> = new Set(),
): UpgradeContext {
  const labels = new Map<V1Object, string>();
  const taken = new Map<V1Object, Set<string>>();
  const retired = new Set<string>();
  const notes = new Set<string>();

  const mark = (owner: V1Object, key: string) => {
    let keys = taken.get(owner);
    if (!keys) taken.set(owner, (keys = new Set()));
    keys.add(key);
  };

  return {
    canvas,
    language,
    hasRole: (role) => roles.has(role),
    register(owner, label) {
      labels.set(owner, label);
    },
    take<T>(owner: V1Object, key: string) {
      mark(owner, key);
      return owner[key] as T | undefined;
    },
    retire(owner, key) {
      mark(owner, key);
      if (owner[key] !== undefined) retired.add(`${labels.get(owner) ?? "?"}.${key}`);
    },
    note(path) {
      notes.add(path);
    },
    finish() {
      const unhandled = new Set(notes);
      for (const [owner, label] of labels) {
        const keys = taken.get(owner);
        for (const key of Object.keys(owner)) {
          if (owner[key] !== undefined && !keys?.has(key)) unhandled.add(`${label}.${key}`);
        }
      }
      return { retired: [...retired].sort(), unhandled: [...unhandled].sort() };
    },
  };
}

/** A plain object, or nothing. */
export function asObject(value: unknown): V1Object | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as V1Object) : undefined;
}
