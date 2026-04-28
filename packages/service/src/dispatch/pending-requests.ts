import type { DispatchResult } from "../types/service.js";

export interface PendingRequest {
  resolve: (result: DispatchResult) => void;
}

export function createPendingRequestStore() {
  const pending = new Map<string, PendingRequest>();

  return {
    get size() {
      return pending.size;
    },
    set(requestId: string, request: PendingRequest) {
      pending.set(requestId, request);
    },
    take(requestId: string) {
      const entry = pending.get(requestId);
      if (!entry) {
        return null;
      }
      pending.delete(requestId);
      return entry;
    }
  };
}
