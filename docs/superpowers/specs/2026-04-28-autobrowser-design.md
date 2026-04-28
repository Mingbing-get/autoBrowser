# autoBrowser Design

## Goal

Create a `pnpm`-managed monorepo with TypeScript packages for:

- a Node.js CLI named `autoBrowser`
- a long-running Node service
- a Native Messaging host
- a Chrome Manifest V3 extension

The MVP must support:

- `autoBrowser serve`
- `autoBrowser open "<url>"`
- `autoBrowser query "<selector>"`
- bidirectional communication between the browser extension and Node through Native Messaging

## Recommended Architecture

### Packages

- `packages/shared`
  Shared TypeScript types for commands, events, and protocol payloads
- `packages/cli`
  User-facing CLI that sends commands to the local service over HTTP
- `packages/service`
  Long-running local service that manages command routing and browser session state
- `packages/native-host`
  Native Messaging bridge process that speaks Chrome's stdin/stdout framing and forwards messages to the service
- `packages/extension`
  Chrome Manifest V3 extension that connects to the Native Messaging host and executes browser actions

### Why this shape

The desired shell UX is command-oriented:

```bash
autoBrowser open "https://www.baidu.com"
autoBrowser query "#id"
```

That requires a process that can accept commands at any time, so the service should stay alive independently of the browser lifecycle. Native Messaging alone is browser-initiated, so it is not a good primary entrypoint for shell commands.

## Communication Flow

1. Shell runs `autoBrowser open "https://www.baidu.com"`.
2. CLI sends an HTTP request to the local service.
3. Service creates a request id and forwards a command to the connected browser session.
4. Extension receives the command through Native Messaging and performs the action.
5. Extension sends the result back through Native Messaging.
6. Native host forwards the message to the service.
7. Service resolves the pending request and returns the result to the CLI.

## Protocol

### Service API

- `POST /commands/open`
- `POST /commands/query`
- `GET /health`

### Internal command message

```json
{
  "kind": "command",
  "requestId": "req_123",
  "command": "open",
  "payload": {
    "url": "https://www.baidu.com"
  }
}
```

### Internal result message

```json
{
  "kind": "result",
  "requestId": "req_123",
  "ok": true,
  "payload": {
    "url": "https://www.baidu.com"
  }
}
```

## MVP Scope

### In scope

- `pnpm` workspace setup
- TypeScript in every package
- shared protocol types
- CLI to service communication
- service request tracking
- Native Messaging framing logic
- Chrome MV3 extension connection bootstrap
- `open` and `query` end-to-end message handling
- setup docs for loading the extension and installing the native host manifest

### Out of scope

- automatic native host installation
- Firefox support
- advanced page interaction commands
- screenshots
- multiple simultaneous browser clients

## Testing Strategy

- shared protocol unit tests
- CLI parsing and request construction tests
- service routing tests with in-memory transport
- native host framing tests

Browser integration will be scaffolded but not fully automated in the first pass.
