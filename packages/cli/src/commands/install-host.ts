import type { CliRunResult } from "../types/cli.js";
import { validateExtensionId } from "../utils/validate-extension-id.js";

export async function runInstallHostCommand(
  installHost: (extensionId: string) => Promise<string>,
  extensionId: string
): Promise<CliRunResult> {
  validateExtensionId(extensionId);
  const manifestPath = await installHost(extensionId);
  return {
    exitCode: 0,
    stdout: `Native host manifest installed: ${manifestPath}`,
    stderr: ""
  };
}
