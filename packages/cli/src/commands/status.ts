import type { CliRunResult } from "../types/cli.js";

export async function runStatusCommand(
  requestStatus: () => Promise<unknown>
): Promise<CliRunResult> {
  const result = await requestStatus();
  return {
    exitCode: 0,
    stdout: JSON.stringify(result, null, 2),
    stderr: ""
  };
}
