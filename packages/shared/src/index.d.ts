export type AutoBrowserCommand = "open" | "close" | "tabs" | "query" | "summary" | "text" | "selector";
export interface OpenCommandPayload {
    url: string;
}
export interface CloseCommandPayload {
    tabId?: number;
}
export interface TabsCommandPayload {
}
export interface QueryCommandPayload {
    selector: string;
    tabId?: number;
}
export interface SummaryCommandPayload {
    tabId?: number;
}
export interface TextCommandPayload {
    selector: string;
    tabId?: number;
}
export interface SelectorCommandPayload {
    selector: string;
    tabId?: number;
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
export interface PageTextPayload {
    found: boolean;
    text?: string;
}
export interface DomRectPayload {
    found: boolean;
    rect?: {
        x: number;
        y: number;
        top: number;
        left: number;
        right: number;
        bottom: number;
        width: number;
        height: number;
    };
}
export interface BrowserTabPayload {
    tabId: number;
    url: string | null;
    title: string | null;
    active: boolean;
}
export interface CommandPayloadMap {
    open: OpenCommandPayload;
    close: CloseCommandPayload;
    tabs: TabsCommandPayload;
    query: QueryCommandPayload;
    summary: SummaryCommandPayload;
    text: TextCommandPayload;
    selector: SelectorCommandPayload;
}
export type AnyCommandPayload = CommandPayloadMap[AutoBrowserCommand];
export type CommandMessage<T extends AutoBrowserCommand = AutoBrowserCommand> = Extract<{
    [K in AutoBrowserCommand]: {
        kind: "command";
        requestId: string;
        command: K;
        payload: CommandPayloadMap[K];
    };
}[AutoBrowserCommand], {
    command: T;
}>;
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
