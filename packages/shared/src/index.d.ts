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
export interface CommandMessage<T extends AutoBrowserCommand = AutoBrowserCommand> {
    kind: "command";
    requestId: string;
    command: T;
    payload: CommandPayloadMap[T];
}
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
export declare function createCommandMessage<T extends AutoBrowserCommand>(requestId: string, command: T, payload: CommandPayloadMap[T]): CommandMessage<T>;
export declare function isCommandMessage(value: unknown): value is CommandMessage;
export declare function isResultMessage(value: unknown): value is ResultMessage;
export declare function isRecord(value: unknown): value is Record<string, unknown>;
