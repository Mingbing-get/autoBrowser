export function scheduleReconnect(connect: () => void, delayMs = 1000) {
  setTimeout(connect, delayMs);
}
