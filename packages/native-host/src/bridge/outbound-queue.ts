export function createOutboundQueue() {
  const queue: string[] = [];

  return {
    enqueue(payload: string) {
      queue.push(payload);
    },
    flush(send: (payload: string) => void) {
      while (queue.length > 0) {
        const nextPayload = queue.shift();
        if (nextPayload) {
          send(nextPayload);
        }
      }
    }
  };
}
