import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { resolveExtensionDistPath } from "./paths.js";

export async function copyExtensionBundle(targetDir: string): Promise<string> {
  const resolvedTargetDir = path.resolve(targetDir);
  const sourceDir = resolveExtensionDistPath();

  await mkdir(path.dirname(resolvedTargetDir), { recursive: true });
  await cp(sourceDir, resolvedTargetDir, {
    recursive: true,
    force: true
  });

  return resolvedTargetDir;
}
