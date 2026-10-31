/// <reference types="vite/client" />

// Vite inline worker imports (e.g. `import OimWorker from './worker.js?worker&inline'`)
declare module '*?worker&inline' {
  const workerConstructor: new () => Worker;
  export default workerConstructor;
}
