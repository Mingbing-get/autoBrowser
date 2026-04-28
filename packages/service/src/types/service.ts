import type {
  AutoBrowserCommand,
  BrowserTransport,
  CommandPayloadMap,
  ResultMessage
} from "@autobrowser/shared";

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

export type JsonResponsePayload =
  | DispatchResult
  | ResultMessage
  | {
      ok: boolean;
      error?: string;
    };
