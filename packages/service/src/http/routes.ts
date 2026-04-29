import type { IncomingMessage, ServerResponse } from "node:http";
import { handleClickRequest } from "./handlers/click-handler.js";
import { handleCloseRequest } from "./handlers/close-handler.js";
import { handleFlowRequest } from "./handlers/flow-handler.js";
import { handleHealthRequest } from "./handlers/health-handler.js";
import { handleOpenRequest } from "./handlers/open-handler.js";
import { handleInputRequest } from "./handlers/input-handler.js";
import { handleQueryRequest } from "./handlers/query-handler.js";
import { handleRectRequest } from "./handlers/rect-handler.js";
import { handleSummaryRequest } from "./handlers/summary-handler.js";
import { handleTabsRequest } from "./handlers/tabs-handler.js";
import { handleTextRequest } from "./handlers/text-handler.js";
import { writeJson } from "./utils/write-json.js";
import type { AutoBrowserService } from "../types/service.js";

export async function handleRequest(
  service: AutoBrowserService,
  request: IncomingMessage,
  response: ServerResponse
) {
  if (request.method === "GET" && request.url === "/health") {
    handleHealthRequest(service, response);
    return;
  }

  if (request.method === "POST" && request.url === "/commands/open") {
    await handleOpenRequest(service, request, response);
    return;
  }

  if (request.method === "POST" && request.url === "/commands/close") {
    await handleCloseRequest(service, request, response);
    return;
  }

  if (request.method === "POST" && request.url === "/commands/tabs") {
    await handleTabsRequest(service, request, response);
    return;
  }

  if (request.method === "POST" && request.url === "/commands/query") {
    await handleQueryRequest(service, request, response);
    return;
  }

  if (request.method === "POST" && request.url === "/commands/summary") {
    await handleSummaryRequest(service, request, response);
    return;
  }

  if (request.method === "POST" && request.url === "/commands/text") {
    await handleTextRequest(service, request, response);
    return;
  }

  if (request.method === "POST" && request.url === "/commands/rect") {
    await handleRectRequest(service, request, response);
    return;
  }

  if (request.method === "POST" && request.url === "/commands/click") {
    await handleClickRequest(service, request, response);
    return;
  }

  if (request.method === "POST" && request.url === "/commands/input") {
    await handleInputRequest(service, request, response);
    return;
  }

  if (request.method === "POST" && request.url === "/commands/flow") {
    await handleFlowRequest(service, request, response);
    return;
  }

  writeJson(response, 404, { ok: false, error: "not found" });
}
