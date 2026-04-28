const hostName = "com.autobrowser.host";

export function connectNativePort(onDisconnect: () => void) {
  const port = chrome.runtime.connectNative(hostName);
  port.onDisconnect.addListener(onDisconnect);
  return port;
}
