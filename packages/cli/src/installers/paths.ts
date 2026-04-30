import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function getSupportDirPath() {
  return path.join(os.homedir(), "Library/Application Support/autoBrowser");
}

export function getChromeNativeHostManifestPath() {
  return path.join(
    os.homedir(),
    "Library/Application Support/Google/Chrome/NativeMessagingHosts/com.autobrowser.host.json"
  );
}

export function resolveNativeHostBinaryPath(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));

  const bundledPath = path.resolve(currentDir, "../../vendor/native-host/dist/bin.js");
  if (existsSync(bundledPath)) {
    return bundledPath;
  }

  return path.resolve(currentDir, "../../../native-host/dist/bin.js");
}

export function resolveExtensionDistPath(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));

  const bundledPath = path.resolve(currentDir, "../../vendor/extension/dist");
  if (existsSync(bundledPath)) {
    return bundledPath;
  }

  return path.resolve(currentDir, "../../../extension/dist");
}
