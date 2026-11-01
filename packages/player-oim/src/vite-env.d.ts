/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="vite/client" />

// Vite inline worker imports (e.g. `import OimWorker from './worker.js?worker&inline'`)
declare module '*?worker&inline' {
  const workerConstructor: new () => Worker;
  export default workerConstructor;
}
