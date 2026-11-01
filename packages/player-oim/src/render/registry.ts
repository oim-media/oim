export interface RenderTask {
  engine: any;
  blob: Blob;
  src: string | Blob;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}

export const OIMRegistry = {
  activeConnections: 0,
  MAX_CONCURRENT_DECOMPRESSIONS: 3,
  queue: [] as RenderTask[],

  requestRender: function (engine: any, blob: Blob, src: string | Blob, resolve: (value: any) => void, reject: (reason: any) => void): void {
    this.queue.push({ engine: engine, blob: blob, src: src, resolve: resolve, reject: reject });
    this.next();
  },

  next: function (): void {
    if (this.queue.length === 0) return;
    if (this.activeConnections >= this.MAX_CONCURRENT_DECOMPRESSIONS) return;

    const task = this.queue.shift();
    if (task) {
      this.executeRender(task);
    }
  },

  executeRender: function (task: RenderTask): void {
    const self = this;
    self.activeConnections++;
    
    task.engine._executeLoad(task.blob, task.src)
      .then(function (result: any) {
        self.activeConnections--;
        task.resolve(result);
        self.next();
      })
      .catch(function (err: any) {
        self.activeConnections--;
        task.reject(err);
        self.next();
      });
  }
};
