import type {
  AutoBrowserCommand,
  BrowserTransport,
  ClickCommandResultPayload,
  CommandPayloadMap,
  ResultMessage
} from "@autobrowser/shared";
import type { ClickController } from "../click/types.js";

export interface DispatchFailure {
  ok: false;
  error: string;
}

export interface DispatchSuccess<TPayload = unknown> {
  ok: true;
  payload: TPayload;
}

export type DispatchResult<TPayload = unknown> = DispatchSuccess<TPayload> | DispatchFailure;

export interface AutoBrowserService {
  attachTransport(nextTransport: BrowserTransport): void;
  detachTransport(): void;
  getStatus(): {
    connected: boolean;
    pendingRequests: number;
  };
  dispatchCommand<T extends AutoBrowserCommand>(
    command: T,
    payload: CommandPayloadMap[T]
  ): Promise<DispatchResult>;
  handleIncomingMessage(message: unknown): void;
}

export interface AutoBrowserServiceOptions {
  clickController?: ClickController;
}

export type JsonResponsePayload =
  | DispatchResult
  | DispatchResult<ClickCommandResultPayload>
  | ResultMessage
  | {
      ok: boolean;
      error?: string;
    };
