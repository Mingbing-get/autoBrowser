export interface NativeHostSocket {
  on(event: "connect", listener: () => void): this;
  on(event: "data", listener: (chunk: string) => void): this;
  on(event: "error", listener: (error: Error) => void): this;
  on(event: "close", listener: () => void): this;
  setEncoding(encoding: BufferEncoding): void;
  write(data: string | Buffer): boolean;
  destroy(): void;
}

export interface NativeHostBridgeOptions {
  connectToService?: (port: number, host: string) => NativeHostSocket;
  stdin?: NodeJS.EventEmitter;
  stdout?: {
    write(data: string | Buffer): void;
  };
  scheduleRetry?: (callback: () => void, delayMs: number) => unknown;
  clearScheduledRetry?: (handle: unknown) => void;
}
