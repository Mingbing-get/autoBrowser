import type { CliRequestClient, CliRunResult } from "../types/cli.js";
import type { DragCommandPayload } from "@autobrowser/shared";

export async function runDragCommand(
  client: CliRequestClient,
  payload: DragCommandPayload
): Promise<CliRunResult> {
  const result = await client.request("drag", payload);

  return {
    exitCode: 0,
    stdout: JSON.stringify(result, null, 2),
    stderr: ""
  };
}
