export type AutoBrowserCommand = "open" | "query";

export interface OpenCommandPayload {
  url: string;
}

export interface QueryCommandPayload {
  selector: string;
}

export interface CommandPayloadMap {
  open: OpenCommandPayload;
  query: QueryCommandPayload;
}

export type AnyCommandPayload = CommandPayloadMap[AutoBrowserCommand];

export type CommandMessage<T extends AutoBrowserCommand = AutoBrowserCommand> = Extract<
  {
    [K in AutoBrowserCommand]: {
      kind: "command";
      requestId: string;
      command: K;
      payload: CommandPayloadMap[K];
    };
  }[AutoBrowserCommand],
  { command: T }
>;

export interface ResultMessage<TPayload = unknown> {
  kind: "result";
  requestId: string;
  ok: boolean;
  payload?: TPayload;
  error?: string;
}

export type ProtocolMessage = CommandMessage | ResultMessage;

export interface BrowserTransport {
  send(message: CommandMessage): void;
}

export function createCommandMessage<T extends AutoBrowserCommand>(
  requestId: string,
  command: T,
  payload: CommandPayloadMap[T]
): CommandMessage<T> {
  return {
    kind: "command",
    requestId,
    command,
    payload
  } as CommandMessage<T>;
}

export function isCommandMessage(value: unknown): value is CommandMessage {
  return (
    isRecord(value) &&
    value.kind === "command" &&
    typeof value.requestId === "string" &&
    (value.command === "open" || value.command === "query") &&
    isRecord(value.payload)
  );
}

export function isResultMessage(value: unknown): value is ResultMessage {
  return (
    isRecord(value) &&
    value.kind === "result" &&
    typeof value.requestId === "string" &&
    typeof value.ok === "boolean"
  );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
