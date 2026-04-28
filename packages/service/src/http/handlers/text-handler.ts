import type { IncomingMessage, ServerResponse } from "node:http";
import type { CommandPayloadMap } from "@autobrowser/shared";
import { readJsonBody } from "../utils/read-json-body.js";
import { writeJson } from "../utils/write-json.js";
import type { AutoBrowserService } from "../../types/service.js";

export async function handleTextRequest(
  service: AutoBrowserService,
  request: IncomingMessage,
  response: ServerResponse
) {
  const body = await readJsonBody<CommandPayloadMap["text"]>(request);
  const result = await service.dispatchCommand("text", body);
  writeJson(response, result.ok ? 200 : 503, result);
}
