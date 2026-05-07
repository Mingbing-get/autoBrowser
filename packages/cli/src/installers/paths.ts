import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

type PathOptions = {
  platform?: NodeJS.Platform;
  homedir?: string;
  appData?: string | undefined;
};

function getPathModule(platform: NodeJS.Platform) {
  return platform === "win32" ? path.win32 : path;
}

export function getSupportDirPath(options: PathOptions = {}) {
  const platform = options.platform ?? os.platform();
  const homeDir = options.homedir ?? os.homedir();
  const appData = options.appData ?? process.env.APPDATA;
  const pathModule = getPathModule(platform);

  if (platform === "win32") {
    return pathModule.join(appData ?? pathModule.join(homeDir, "AppData", "Roaming"), "autoBrowser");
  }

  if (platform === "linux") {
    return pathModule.join(homeDir, ".config", "autoBrowser");
  }

  return pathModule.join(homeDir, "Library/Application Support/autoBrowser");
}

export function getChromeNativeHostManifestPath(options: PathOptions = {}) {
  const platform = options.platform ?? os.platform();
  const homeDir = options.homedir ?? os.homedir();
  const appData = options.appData ?? process.env.APPDATA;
  const pathModule = getPathModule(platform);

  if (platform === "win32") {
    return pathModule.join(
      appData ?? pathModule.join(homeDir, "AppData", "Roaming"),
      "autoBrowser",
      "com.autobrowser.host.json"
    );
  }

  if (platform === "linux") {
    return pathModule.join(
      homeDir,
      ".config",
      "google-chrome",
      "NativeMessagingHosts",
      "com.autobrowser.host.json"
    );
  }

  return pathModule.join(
    homeDir,
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
