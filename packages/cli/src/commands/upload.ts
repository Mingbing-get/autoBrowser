import type { CliRequestClient, CliRunResult } from "../types/cli.js";

export async function runUploadCommand(
  client: CliRequestClient,
  selector: string,
  filepath: string,
  tabId?: number
): Promise<CliRunResult> {
  const result = await client.request("upload", {
    selector,
    filepath,
    ...(typeof tabId === "number" ? { tabId } : {})
  });

  return {
    exitCode: 0,
    stdout: JSON.stringify(result, null, 2),
    stderr: ""
  };
}
