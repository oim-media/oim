/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// @vitest-environment happy-dom

// index.d.ts is hand-written and is what TypeScript users see. These checks fail
// when it drifts from the runtime: a missing or invented export, a default export
// of the wrong shape, or an option the engine reads that the types do not declare.
import { describe, it, expect } from "vitest";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as runtime from "./index";

const dts = join(__dirname, "index.d.ts");
// CRLF in the working copy would break the "\n  }\n" end-of-constructor search.
const read = (rel: string) => readFileSync(join(__dirname, rel), "utf8").replace(/\r\n/g, "\n");

function declared() {
  const program = ts.createProgram([dts], { noEmit: true, strict: true });
  const checker = program.getTypeChecker();
  const file = program.getSourceFile(dts)!;
  // The public API has no symbol for a file's module body; `symbol` is the one TypeScript uses.
  const moduleSymbol: ts.Symbol = (file as unknown as { symbol: ts.Symbol }).symbol;
  const exports = checker.getExportsOfModule(moduleSymbol);
  const find = (name: string) => exports.find((s) => s.name === name)!;
  return { checker, exports, find };
}

describe("published surface: index.d.ts matches the runtime", () => {
  it("declares exactly the runtime value exports", () => {
    const { exports } = declared();
    const values = exports
      .filter((s) => s.flags & (ts.SymbolFlags.Value | ts.SymbolFlags.Alias))
      .map((s) => s.name)
      .sort();
    expect(values).toEqual(Object.keys(runtime).sort());
  });

  it("the default export has the runtime shape (OimPlayer, not a version record)", () => {
    const { checker, find } = declared();
    const type = checker.getTypeOfSymbol(checker.getAliasedSymbol(find("default")));
    const props = checker.getPropertiesOfType(type).map((p) => p.name).sort();
    expect(props).toEqual(Object.keys((runtime as any).default).sort());
  });

  it("OimPlayerOptions declares exactly the options the engine reads", () => {
    const { checker, find } = declared();
    const declaredKeys = checker
      .getPropertiesOfType(checker.getDeclaredTypeOfSymbol(find("OimPlayerOptions")))
      .map((p) => p.name);

    const keysRead = (src: string, re: RegExp) => [...src.matchAll(re)].map((m) => m[1]);
    const fromElement = keysRead(read("./index.ts"), /_oimOptions\.(\w+)/g);
    const engine = read("./engines/ImageEngine.ts");
    const ctorStart = engine.indexOf("constructor(host: HTMLElement, opts?: ImageEngineOptions)");
    expect(ctorStart).toBeGreaterThan(-1);
    const ctor = engine.slice(ctorStart, engine.indexOf("\n  }\n", ctorStart));
    const fromEngine = keysRead(ctor, /\boptions\.(\w+)/g);
    const fromModes = keysRead(read("./render/modes.ts"), /\boptions\.(\w+)/g);

    const usedKeys = new Set([...fromElement, ...fromEngine, ...fromModes]);
    expect([...usedKeys].sort()).toEqual([...declaredKeys].sort());
  });
});
