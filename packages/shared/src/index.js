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
        (value.command === "open" || value.command === "query" || value.command === "summary" || value.command === "text") &&
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
