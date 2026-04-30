import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export async function startService(): Promise<void> {
  const bundledServiceEntry = resolveBundledServiceEntry();
  const { createAutoBrowserService, createBridgeServer, createHttpApiServer } =
    await import(bundledServiceEntry ?? "@autobrowser/service");
  const service = createAutoBrowserService();
  const httpServer = createHttpApiServer(service);
  const bridgeServer = createBridgeServer(service);
  await httpServer.listen();
  await bridgeServer.listen();
}

function resolveBundledServiceEntry() {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const bundledPath = path.resolve(currentDir, "../../vendor/service/dist/index.js");

  if (!existsSync(bundledPath)) {
    return undefined;
  }

  return pathToFileURL(bundledPath).href;
}
