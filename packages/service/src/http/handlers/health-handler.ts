import type { ServerResponse } from "node:http";
import { writeJson } from "../utils/write-json.js";
import type { AutoBrowserService } from "../../types/service.js";

export function handleHealthRequest(service: AutoBrowserService, response: ServerResponse) {
  writeJson(response, 200, {
    ok: true,
    ...service.getStatus()
  });
}
