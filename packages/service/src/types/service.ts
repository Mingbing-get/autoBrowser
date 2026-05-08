import type {
  AutoBrowserCommand,
  BrowserTransport,
  ClickCommandResultPayload,
  DragCommandResultPayload,
  CommandPayloadMap,
  FlowCommandResultPayload,
  InputCommandResultPayload,
  ScrollCommandResultPayload,
  UploadCommandResultPayload,
  ResultMessage
} from "@autobrowser/shared";
import type { ClickController } from "../click/types.js";
import type { KeyboardController } from "../input/types.js";
import type { MouseTrajectoryRepository } from "../trajectory/types.js";

export interface DispatchFailure {
  ok: false;
  error: string;
  payload?: unknown;
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
  keyboardController?: KeyboardController;
  trajectoryRepository?: MouseTrajectoryRepository;
  getFlowDelayMs?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export type JsonResponsePayload =
  | DispatchResult
  | DispatchResult<ClickCommandResultPayload>
  | DispatchResult<DragCommandResultPayload>
  | DispatchResult<ScrollCommandResultPayload>
  | DispatchResult<InputCommandResultPayload>
  | DispatchResult<UploadCommandResultPayload>
  | DispatchResult<import("@autobrowser/shared").MouseTrajectoryListResultPayload>
  | DispatchResult<import("@autobrowser/shared").MouseTrajectoryCreateResultPayload>
  | DispatchResult<import("@autobrowser/shared").MouseTrajectoryDeleteResultPayload>
  | DispatchResult<FlowCommandResultPayload>
  | ResultMessage
  | {
      ok: boolean;
      error?: string;
    };
