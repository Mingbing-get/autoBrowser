import { chmod, mkdir, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AutoBrowserCommand, CommandPayloadMap } from "@autobrowser/shared";

export interface CliRequestClient {
  request<T extends AutoBrowserCommand>(
    command: T,
    payload: CommandPayloadMap[T]
  ): Promise<unknown>;
}

export interface CliDependencies extends CliRequestClient {
  startService?: () => Promise<void>;
  installHost?: (extensionId: string) => Promise<string>;
  requestStatus?: () => Promise<unknown>;
}

export interface CliRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  keepAlive?: boolean;
}

export function createCliRunner(client: CliDependencies) {
  return async function run(argv: string[]): Promise<CliRunResult> {
    const [command, value] = argv;

    if (command === "open" && value) {
      const result = await client.request("open", { url: value });
      return {
        exitCode: 0,
        stdout: JSON.stringify(result, null, 2),
        stderr: ""
      };
    }

    if (command === "query" && value) {
      const result = await client.request("query", { selector: value });
      return {
        exitCode: 0,
        stdout: JSON.stringify(result, null, 2),
        stderr: ""
      };
    }

    if (command === "serve") {
      const startService = client.startService ?? defaultStartService;
      await startService();
      return {
        exitCode: 0,
        stdout: "autoBrowser service listening on 127.0.0.1:3210 and bridge 127.0.0.1:3211",
        stderr: "",
        keepAlive: true
      };
    }

    if (command === "install-host" && value) {
      validateExtensionId(value);
      const installHost = client.installHost ?? defaultInstallHost;
      const manifestPath = await installHost(value);
      return {
        exitCode: 0,
        stdout: `Native host manifest installed: ${manifestPath}`,
        stderr: ""
      };
    }

    if (command === "status") {
      const requestStatus = client.requestStatus ?? defaultRequestStatus;
      const result = await requestStatus();
      return {
        exitCode: 0,
        stdout: JSON.stringify(result, null, 2),
        stderr: ""
      };
    }

    return {
      exitCode: 1,
      stdout: "",
      stderr: "Usage: autoBrowser <open|query|serve|install-host|status> <value>"
    };
  };
}

export function createHttpClient(baseUrl = "http://127.0.0.1:3210"): CliRequestClient {
  return {
    async request<T extends AutoBrowserCommand>(
      command: T,
      payload: CommandPayloadMap[T]
    ) {
      const path = command === "open" ? "/commands/open" : "/commands/query";
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

async function getJson(urlString: string): Promise<unknown> {
  const url = new URL(urlString);

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

async function defaultStartService(): Promise<void> {
  const { createAutoBrowserService, createBridgeServer, createHttpApiServer } =
    await import("@autobrowser/service");
  const service = createAutoBrowserService();
  const httpServer = createHttpApiServer(service);
  const bridgeServer = createBridgeServer(service);
  await httpServer.listen();
  await bridgeServer.listen();
}

async function defaultInstallHost(extensionId: string): Promise<string> {
  const supportDir = path.join(
    os.homedir(),
    "Library/Application Support/autoBrowser"
  );
  const manifestPath = path.join(
    os.homedir(),
    "Library/Application Support/Google/Chrome/NativeMessagingHosts/com.autobrowser.host.json"
  );
  const nativeHostPath = resolveNativeHostBinaryPath();
  const launcherPath = path.join(supportDir, "native-host.sh");
  const logPath = path.join(supportDir, "native-host.log");
  const launcherScript = [
    "#!/bin/sh",
    `exec "${process.execPath}" "${nativeHostPath}" 2>>"${logPath}"`
  ].join("\n");
  const manifest = {
    name: "com.autobrowser.host",
    description: "autoBrowser Native Messaging host",
    path: launcherPath,
    type: "stdio",
    allowed_origins: [`chrome-extension://${extensionId}/`]
  };

  await mkdir(supportDir, { recursive: true });
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await chmod(nativeHostPath, 0o755);
  await writeFile(launcherPath, `${launcherScript}\n`, "utf8");
  await chmod(launcherPath, 0o755);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifestPath;
}

async function defaultRequestStatus(): Promise<unknown> {
  return await getJson("http://127.0.0.1:3210/health");
}

function resolveNativeHostBinaryPath(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(currentDir, "../../native-host/dist/bin.js");
}

function validateExtensionId(extensionId: string) {
  if (!/^[a-p]{32}$/.test(extensionId)) {
    throw new Error("Chrome extension ID must be 32 characters using letters a-p.");
  }
}
