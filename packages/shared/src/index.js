export function createCommandMessage(requestId, command, payload) {
    return {
        kind: "command",
        requestId,
        command,
        payload
    };
}
export function isCommandMessage(value) {
    return (isRecord(value) &&
        value.kind === "command" &&
        typeof value.requestId === "string" &&
        ((value.command === "open" ||
            value.command === "close" ||
            value.command === "tabs" ||
            value.command === "query" ||
            value.command === "search" ||
            value.command === "searchFromPoint" ||
            value.command === "summary" ||
            value.command === "text" ||
            value.command === "rect" ||
            value.command === "click" ||
            value.command === "drag" ||
            value.command === "clickObserve" ||
            value.command === "clickObserveStart" ||
            value.command === "clickObserveFinish" ||
            value.command === "scroll" ||
            value.command === "input" ||
            value.command === "upload" ||
            value.command === "flow" ||
            value.command === "clickMapStart" ||
            value.command === "clickMapFinish")) &&
        isRecord(value.payload));
}
export function isResultMessage(value) {
    return (isRecord(value) &&
        value.kind === "result" &&
        typeof value.requestId === "string" &&
        typeof value.ok === "boolean");
}
export function isRecord(value) {
    return typeof value === "object" && value !== null;
}
