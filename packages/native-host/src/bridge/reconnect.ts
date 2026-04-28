export function createReconnectController(
  scheduleRetry: (callback: () => void, delayMs: number) => unknown,
  clearScheduledRetry: (handle: unknown) => void
) {
  let retryHandle: unknown = null;

  return {
    clear() {
      if (retryHandle !== null) {
        clearScheduledRetry(retryHandle);
        retryHandle = null;
      }
    },
    schedule(callback: () => void) {
      if (retryHandle !== null) {
        return;
      }
      retryHandle = scheduleRetry(() => {
        retryHandle = null;
        callback();
      }, 1000);
    }
  };
}
