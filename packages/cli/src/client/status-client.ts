import { request as httpRequest } from "node:http";

export async function requestStatus(baseUrl = "http://127.0.0.1:3210"): Promise<unknown> {
  const url = new URL("/health", baseUrl);

  return await new Promise((resolve, reject) => {
    const request = httpRequest(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "GET"
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
    request.end();
  });
}
