import type { CliRequestClient, CliRunResult } from "../types/cli.js";

export async function runOpenCommand(
  client: CliRequestClient,
  value: string
): Promise<CliRunResult> {
  const result = await client.request("open", { url: value });
  return {
    exitCode: 0,
    stdout: JSON.stringify(result, null, 2),
    stderr: ""
  };
}
