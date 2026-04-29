import type { CliRequestClient, CliRunResult } from "../types/cli.js";

export async function runRectCommand(
  client: CliRequestClient,
  value: string,
  tabId?: number
): Promise<CliRunResult> {
  const result = await client.request("rect", {
    selector: value,
    ...(typeof tabId === "number" ? { tabId } : {})
  });

  return {
    exitCode: 0,
    stdout: JSON.stringify(result, null, 2),
    stderr: ""
  };
}
