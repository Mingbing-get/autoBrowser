export function createSocketLineBuffer(onMessage: (message: string) => void) {
  let socketBuffer = "";

  return {
    push(chunk: string) {
      socketBuffer += chunk;
      const messages = socketBuffer.split("\n");
      socketBuffer = messages.pop() ?? "";

      for (const message of messages) {
        if (message.trim()) {
          onMessage(message);
        }
      }
    }
  };
}
