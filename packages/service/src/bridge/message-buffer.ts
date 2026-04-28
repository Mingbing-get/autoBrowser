export function createLineMessageBuffer() {
  let buffer = "";

  return {
    push(chunk: string) {
      buffer += chunk;
      const messages = buffer.split("\n");
      buffer = messages.pop() ?? "";

      return messages.filter((message) => message.trim());
    }
  };
}
