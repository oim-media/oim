/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Runs pnpm without `shell: true`, which Node deprecates (DEP0190) because the
// arguments are concatenated, not escaped. Inside a pnpm script `npm_execpath`
// points at pnpm: a JS entry point runs under this Node, a native binary runs
// directly. Outside a script, Windows finds pnpm only as a .cmd shim, which
// cmd.exe has to launch.
import { execFileSync } from "node:child_process";

export function pnpm(args, options = {}) {
  const cli = process.env.npm_execpath;
  if (cli && /\.[cm]?js$/.test(cli)) return execFileSync(process.execPath, [cli, ...args], options);
  if (cli) return execFileSync(cli, args, options);
  if (process.platform === "win32") return execFileSync("cmd.exe", ["/d", "/s", "/c", "pnpm", ...args], options);
  return execFileSync("pnpm", args, options);
}
