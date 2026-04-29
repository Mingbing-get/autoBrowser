# Flow Command Design

## Goal

Add a high-level `flow` command so the CLI can execute multiple browser actions in sequence from a single JSON array argument.

Example:

```bash
autoBrowser flow '[{"action":"open","url":"https://www.baidu.com"},{"action":"input","selector":"#kw","value":"自动化测试"},{"action":"click","selector":"#su"}]'
```

## Recommended Approach

Implement `flow` as a first-class command in the shared protocol, CLI, and local service.

- The CLI parses the trailing JSON array argument and sends it to the local service as a `flow` command.
- The local service validates and executes steps sequentially by reusing existing single-action command dispatch paths such as `open`, `input`, `click`, `query`, `text`, `summary`, and `close`.
- The browser extension stays focused on single browser actions. It does not need to understand `flow`.

This keeps orchestration in one place and avoids duplicating sequencing logic in the CLI.

## Input Format

`flow` accepts one required positional argument: a JSON array string.

Supported step shapes:

```json
[
  { "action": "open", "url": "https://www.baidu.com" },
  { "action": "click", "selector": "#login" },
  { "action": "input", "selector": "#kw", "value": "自动化测试" },
  { "action": "query", "selector": ".result" },
  { "action": "text", "selector": "h1" },
  { "action": "summary" },
  { "action": "close", "tabId": 123 }
]
```

Initial supported actions:

- `open`: requires `url`
- `click`: requires `selector`, optional `tabId`
- `input`: requires `selector` and `value`, optional `tabId`
- `query`: requires `selector`, optional `tabId`
- `text`: requires `selector`, optional `tabId`
- `summary`: optional `tabId`
- `close`: optional `tabId`

## Execution Rules

The service executes steps in array order.

- After each successful step, wait for a random delay between `500ms` and `2000ms` before starting the next step.
- Do not wait after the last successful step.
- If any step fails, stop immediately and return the partial results plus the failure.
- Step-level `tabId` is passed through directly to the underlying command when provided.

The random delay should be generated service-side so the behavior is consistent across CLI entrypoints.

## Response Shape

Recommended HTTP and CLI response:

```json
{
  "ok": true,
  "results": [
    { "index": 0, "action": "open", "ok": true, "payload": {} },
    { "index": 1, "action": "input", "ok": true, "payload": {} },
    { "index": 2, "action": "click", "ok": true, "payload": {} }
  ]
}
```

On failure:

```json
{
  "ok": false,
  "failedIndex": 1,
  "error": "selector not found: #kw",
  "results": [
    { "index": 0, "action": "open", "ok": true, "payload": {} },
    { "index": 1, "action": "input", "ok": false, "error": "selector not found: #kw" }
  ]
}
```

## Code Changes

### Shared protocol

Modify `packages/shared/src/types/protocol.ts`:

- add `flow` to `AutoBrowserCommand`
- add `FlowStep` union types
- add `FlowCommandPayload`
- add `FlowCommandResultPayload`
- extend `CommandPayloadMap`

Update exports and protocol tests in the shared package.

### CLI

Modify `packages/cli/src/index.ts`:

- add `flow` command routing
- treat `args[0]` as the raw JSON array string
- return a usage error when the argument is missing or JSON parsing fails

Create `packages/cli/src/commands/flow.ts`:

- parse JSON
- verify the top-level value is an array
- call `client.request("flow", { steps })`

Modify `packages/cli/src/client/http-client.ts`:

- add `/commands/flow`

Update CLI tests for parsing, invalid JSON, and request construction.

### Service HTTP layer

Modify `packages/service/src/http/routes.ts`:

- add `POST /commands/flow`

Create `packages/service/src/http/handlers/flow-handler.ts`:

- read JSON body
- validate `steps` exists and is an array
- call `service.dispatchCommand("flow", { steps })`
- write the JSON response

### Service orchestration

Modify `packages/service/src/types/service.ts`:

- allow typed `flow` results in the service response unions

Modify `packages/service/src/app/auto-browser-service.ts`:

- intercept `flow` in `dispatchCommand`
- execute each step by calling the existing dispatch path
- insert `await delay(randomMsBetween500And2000())` between successful steps
- return structured per-step results and failure metadata

Add or update service tests for:

- full successful flow
- failure stops execution
- random wait is applied between steps but not after the last step
- step payloads are forwarded correctly

## Error Handling

- Reject malformed JSON in the CLI with a clear usage error.
- Reject non-array top-level JSON values in the CLI.
- Reject unsupported `action` values in the service.
- Return the exact failing step index and error to simplify debugging.

## Testing Strategy

- CLI tests for `flow` argument parsing and HTTP request construction
- shared protocol tests for `flow` payload typing coverage
- service tests for sequential execution, failure short-circuiting, and delay behavior

No extension changes are required for the first version.
