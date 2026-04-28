export type AutoBrowserCommand = "open" | "query" | "summary";
export interface OpenCommandPayload {
    url: string;
}
export interface QueryCommandPayload {
    selector: string;
}
export interface SummaryCommandPayload {
}
export interface DomNodeState {
    clickable?: boolean;
    editable?: boolean;
    disabled?: boolean;
    checked?: boolean;
    selected?: boolean;
}
export interface DomNodeLocator {
    preferred: string;
    fallbacks?: string[];
}
export interface DomNodeMeta {
    childrenTruncated?: boolean;
    hiddenChildrenCount?: number;
    textTruncated?: boolean;
    originalTextLength?: number;
}
export interface DomNodeSummary {
    tag: string;
    role?: string;
    text?: string;
    attrs?: Record<string, string>;
    state?: DomNodeState;
    locator?: DomNodeLocator;
    children?: DomNodeSummary[];
    meta?: DomNodeMeta;
}
export interface QueryResultMeta {
    depthLimit?: number;
    childLimit?: number;
    siblingLimit: number;
    textLimit: number;
    truncated: boolean;
}
export interface QueryResultPayload {
    found: boolean;
    self?: DomNodeSummary;
    context?: {
        ancestors?: DomNodeSummary[];
        siblings?: DomNodeSummary[];
    };
    meta?: QueryResultMeta;
}
export interface PageHeadingSummary {
    level: number;
    text: string;
    locator?: DomNodeLocator;
}
export interface PageFormSummary {
    name?: string;
    locator?: DomNodeLocator;
    fields?: DomNodeSummary[];
    actions?: DomNodeSummary[];
    meta?: DomNodeMeta;
}
export interface PageSummaryPayload {
    title: string;
    url: string;
    descendants?: DomNodeSummary[];
    meta?: {
        textLimit: number;
        truncated: boolean;
    };
}
export interface CommandPayloadMap {
    open: OpenCommandPayload;
    query: QueryCommandPayload;
    summary: SummaryCommandPayload;
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
