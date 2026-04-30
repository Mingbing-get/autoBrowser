import type { CliRunResult } from "../types/cli.js";

export async function runExtensionCommand(
  copyExtension: (targetDir: string) => Promise<string>,
  targetDir: string
): Promise<CliRunResult> {
  const copiedPath = await copyExtension(targetDir);

  return {
    exitCode: 0,
    stdout: [
      `Chrome extension copied to: ${copiedPath}`,
      "Load this directory in Chrome as an unpacked extension, then run:",
      "ab install-host <chrome-extension-id>"
    ].join("\n"),
    stderr: ""
  };
}
