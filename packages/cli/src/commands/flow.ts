import type { FlowStep } from "@autobrowser/shared";
import type { CliRequestClient, CliRunResult } from "../types/cli.js";

const FLOW_JSON_ERROR = "flow requires a valid JSON array";

export async function runFlowCommand(
  client: CliRequestClient,
  rawSteps: string
): Promise<CliRunResult> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawSteps);
  } catch {
    return {
      exitCode: 1,
      stdout: "",
      stderr: FLOW_JSON_ERROR
    };
  }

  if (!Array.isArray(parsed)) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: FLOW_JSON_ERROR
    };
  }

  const result = await client.request("flow", {
    steps: parsed as FlowStep[]
  });

  return {
    exitCode: 0,
    stdout: JSON.stringify(result, null, 2),
    stderr: ""
  };
}
