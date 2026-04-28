import type { CliRunResult } from "../types/cli.js";

export async function runServeCommand(
  startService: () => Promise<void>
): Promise<CliRunResult> {
  await startService();
  return {
    exitCode: 0,
    stdout: "autoBrowser service listening on 127.0.0.1:3210 and bridge 127.0.0.1:3211",
    stderr: "",
    keepAlive: true
  };
}
