import { execFile as execFileCallback } from "node:child_process";
import { chmod, cp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { createLauncherScript } from "./launcher-script.js";
import {
  getChromeNativeHostManifestPath,
  getSupportDirPath,
  resolveNativeHostBinaryPath
} from "./paths.js";

const execFile = promisify(execFileCallback);
const WINDOWS_REGISTRY_KEY = "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.autobrowser.host";

type InstallNativeHostOptions = {
  platform?: NodeJS.Platform;
  supportDir?: string;
  manifestPath?: string;
  nativeHostPath?: string;
  cp?: typeof cp;
  mkdir?: typeof mkdir;
  chmod?: typeof chmod;
  writeFile?: typeof writeFile;
  execFile?: (file: string, args: string[]) => Promise<unknown>;
};

export async function installNativeHostManifest(
  extensionId: string,
  options: InstallNativeHostOptions = {}
): Promise<string> {
  const platform = options.platform ?? process.platform;
  const pathModule = platform === "win32" ? path.win32 : path;
  const supportDir = options.supportDir ?? getSupportDirPath({ platform });
  const manifestPath = options.manifestPath ?? getChromeNativeHostManifestPath({ platform });
  const nativeHostPath = options.nativeHostPath ?? resolveNativeHostBinaryPath();
  const nativeHostDistPath = pathModule.dirname(nativeHostPath);
  const stagedNativeHostDir = pathModule.join(supportDir, "native-host");
  const stagedNativeHostDistPath = pathModule.join(stagedNativeHostDir, "dist");
  const launcherFileName = platform === "win32" ? "native-host.cmd" : "native-host.sh";
  const launcherPath = pathModule.join(supportDir, launcherFileName);
  const logPath = pathModule.join(supportDir, "native-host.log");
  const launcherTargetPath =
    platform === "win32" ? "native-host\\dist\\bin.js" : nativeHostPath;
  const launcherLogPath =
    platform === "win32" ? "native-host.log" : logPath;
  const launcherScript = createLauncherScript(launcherTargetPath, launcherLogPath, platform);
  const cpFn = options.cp ?? cp;
  const mkdirFn = options.mkdir ?? mkdir;
  const chmodFn = options.chmod ?? chmod;
  const writeFileFn = options.writeFile ?? writeFile;
  const execFileFn = options.execFile ?? execFile;
  const manifest = {
    name: "com.autobrowser.host",
    description: "autoBrowser Native Messaging host",
    path: platform === "win32" ? launcherFileName : launcherPath,
    type: "stdio",
    allowed_origins: [`chrome-extension://${extensionId}/`]
  };

  await mkdirFn(supportDir, { recursive: true });
  await mkdirFn(pathModule.dirname(manifestPath), { recursive: true });
  if (platform !== "win32") {
    await chmodFn(nativeHostPath, 0o755);
  }
  if (platform === "win32") {
    await mkdirFn(stagedNativeHostDir, { recursive: true });
    await cpFn(nativeHostDistPath, stagedNativeHostDistPath, { recursive: true });
    await writeFileFn(
      pathModule.join(stagedNativeHostDir, "package.json"),
      `${JSON.stringify({ type: "module" }, null, 2)}\n`,
      "utf8"
    );
  }
  await writeFileFn(launcherPath, `${launcherScript}\n`, "utf8");
  if (platform !== "win32") {
    await chmodFn(launcherPath, 0o755);
  }
  await writeFileFn(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  if (platform === "win32") {
    await execFileFn("reg", [
      "add",
      WINDOWS_REGISTRY_KEY,
      "/ve",
      "/t",
      "REG_SZ",
      "/d",
      manifestPath,
      "/f"
    ]);
  }

  return manifestPath;
}
