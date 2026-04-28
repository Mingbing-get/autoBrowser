import { request as httpRequest } from "node:http";
import type { AutoBrowserCommand, CommandPayloadMap } from "@autobrowser/shared";
import type { CliRequestClient } from "../types/cli.js";

export function createHttpClient(baseUrl = "http://127.0.0.1:3210"): CliRequestClient {
  return {
    async request<T extends AutoBrowserCommand>(
      command: T,
      payload: CommandPayloadMap[T]
    ) {
      const path =
        command === "open"
          ? "/commands/open"
          : command === "query"
            ? "/commands/query"
            : "/commands/summary";
      return await postJson(`${baseUrl}${path}`, payload);
    }
  };
}

async function postJson(urlString: string, payload: unknown): Promise<unknown> {
  const url = new URL(urlString);

  return await new Promise((resolve, reject) => {
    const request = httpRequest(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "POST",
        headers: {
          "content-type": "application/json"
        }
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          resolve(JSON.parse(body));
        });
      }
    );

    request.on("error", reject);
    request.write(JSON.stringify(payload));
    request.end();
  });
}
