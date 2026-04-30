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
  copyExtension?: (targetDir: string) => Promise<string>;
  requestStatus?: () => Promise<unknown>;
}

export interface CliRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  keepAlive?: boolean;
}
