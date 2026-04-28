import { chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createLauncherScript } from "./launcher-script.js";
import {
  getChromeNativeHostManifestPath,
  getSupportDirPath,
  resolveNativeHostBinaryPath
} from "./paths.js";

export async function installNativeHostManifest(extensionId: string): Promise<string> {
  const supportDir = getSupportDirPath();
  const manifestPath = getChromeNativeHostManifestPath();
  const nativeHostPath = resolveNativeHostBinaryPath();
  const launcherPath = path.join(supportDir, "native-host.sh");
  const logPath = path.join(supportDir, "native-host.log");
  const launcherScript = createLauncherScript(nativeHostPath, logPath);
  const manifest = {
    name: "com.autobrowser.host",
    description: "autoBrowser Native Messaging host",
    path: launcherPath,
    type: "stdio",
    allowed_origins: [`chrome-extension://${extensionId}/`]
  };

  await mkdir(supportDir, { recursive: true });
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await chmod(nativeHostPath, 0o755);
  await writeFile(launcherPath, `${launcherScript}\n`, "utf8");
  await chmod(launcherPath, 0o755);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return manifestPath;
}
