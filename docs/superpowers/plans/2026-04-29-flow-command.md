# Flow Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `autoBrowser flow '<json-array>'` so the CLI can execute multiple browser actions sequentially with a random `500ms` to `2000ms` delay between successful steps.

**Architecture:** Extend the shared protocol with a first-class `flow` command and step/result types, let the CLI parse the raw JSON array argument and send `POST /commands/flow`, and keep orchestration in the local service by reusing existing single-command dispatch paths. The service will execute steps in order, stop on the first failure, and insert a service-side randomized delay between successful non-final steps.

**Tech Stack:** TypeScript, pnpm workspace, Vitest, existing CLI HTTP client, service command dispatcher

---

## File Map

- Modify: `packages/shared/src/types/protocol.ts`
  Add `flow`, step payload types, and flow result types.
- Modify: `packages/shared/src/index.ts`
  Re-export new flow types.
- Modify: `packages/shared/src/index.d.ts`
  Re-export new flow types for consumers.
- Test: `packages/shared/test/protocol.test.ts`
  Cover protocol factories and typing-oriented runtime payload expectations for flow.
- Modify: `packages/cli/src/index.ts`
  Route `flow` and return clear usage errors.
- Create: `packages/cli/src/commands/flow.ts`
  Parse the JSON array and call the HTTP client.
- Modify: `packages/cli/src/client/http-client.ts`
  Add `/commands/flow`.
- Test: `packages/cli/test/cli.test.ts`
  Cover flow CLI parsing, invalid JSON, and request construction.
- Modify: `packages/service/src/http/routes.ts`
  Add `POST /commands/flow`.
- Create: `packages/service/src/http/handlers/flow-handler.ts`
  Validate request shape and invoke service dispatch.
- Modify: `packages/service/src/types/service.ts`
  Extend typed service result unions for flow.
- Modify: `packages/service/src/app/auto-browser-service.ts`
  Orchestrate flow execution and randomized delays.
- Test: `packages/service/test/service.test.ts`
  Cover successful flow, failure short-circuiting, and inter-step delay behavior.

### Task 1: Shared Protocol Support

**Files:**
- Modify: `packages/shared/src/types/protocol.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/index.d.ts`
- Test: `packages/shared/test/protocol.test.ts`

- [ ] **Step 1: Write the failing shared protocol test**

```ts
it("creates flow command payloads with ordered steps", () => {
  const payload = {
    steps: [
      { action: "open", url: "https://example.com" },
      { action: "click", selector: "#submit" }
    ]
  };

  expect(payload.steps[0]).toEqual({ action: "open", url: "https://example.com" });
});
```

- [ ] **Step 2: Run the focused shared test and verify it fails for missing flow support**

Run: `pnpm --filter @autobrowser/shared exec vitest run test/protocol.test.ts`
Expected: FAIL with missing `flow` protocol support or missing exports.

- [ ] **Step 3: Add minimal flow protocol support**

```ts
export type FlowStep =
  | { action: "open"; url: string }
  | { action: "click"; selector: string; tabId?: number };

export interface FlowCommandPayload {
  steps: FlowStep[];
}
```

- [ ] **Step 4: Re-run the shared test and keep it green**

Run: `pnpm --filter @autobrowser/shared exec vitest run test/protocol.test.ts`
Expected: PASS

### Task 2: CLI Flow Surface

**Files:**
- Modify: `packages/cli/src/index.ts`
- Create: `packages/cli/src/commands/flow.ts`
- Modify: `packages/cli/src/client/http-client.ts`
- Test: `packages/cli/test/cli.test.ts`

- [ ] **Step 1: Write failing CLI tests for `flow`**

```ts
it("sends parsed flow steps to the client", async () => {
  const request = vi.fn().mockResolvedValue({ ok: true, results: [] });
  const runner = createCliRunner({ request });

  await runner([
    "flow",
    '[{"action":"open","url":"https://example.com"},{"action":"click","selector":"#go"}]'
  ]);

  expect(request).toHaveBeenCalledWith("flow", {
    steps: [
      { action: "open", url: "https://example.com" },
      { action: "click", selector: "#go" }
    ]
  });
});
```

- [ ] **Step 2: Run the focused CLI tests and verify the failure is due to missing `flow` handling**

Run: `pnpm --filter @autobrowser/cli exec vitest run test/cli.test.ts`
Expected: FAIL with unsupported command or missing HTTP path.

- [ ] **Step 3: Implement minimal `flow` parsing and request routing**

```ts
if (command === "flow" && args[0]) {
  return await runFlowCommand(client, args[0]);
}
```

- [ ] **Step 4: Re-run the focused CLI tests and keep them green**

Run: `pnpm --filter @autobrowser/cli exec vitest run test/cli.test.ts`
Expected: PASS

### Task 3: Service Flow HTTP And Orchestration

**Files:**
- Modify: `packages/service/src/http/routes.ts`
- Create: `packages/service/src/http/handlers/flow-handler.ts`
- Modify: `packages/service/src/types/service.ts`
- Modify: `packages/service/src/app/auto-browser-service.ts`
- Test: `packages/service/test/service.test.ts`

- [ ] **Step 1: Write failing service tests for sequential flow execution**

```ts
it("waits between successful non-final flow steps", async () => {
  const dispatch = vi.fn()
    .mockResolvedValueOnce({ ok: true, payload: { tabId: 1 } })
    .mockResolvedValueOnce({ ok: true, payload: { clicked: true, tabId: 1 } });
  const sleep = vi.fn().mockResolvedValue(undefined);
  const randomDelay = vi.fn().mockReturnValue(750);

  // invoke flow dispatch
  expect(sleep).toHaveBeenCalledWith(750);
});
```

- [ ] **Step 2: Run the focused service tests and verify the failure is due to missing `flow` orchestration**

Run: `pnpm --filter @autobrowser/service exec vitest run test/service.test.ts`
Expected: FAIL with missing `flow` command handling.

- [ ] **Step 3: Implement minimal flow orchestration and HTTP route**

```ts
for (let index = 0; index < payload.steps.length; index += 1) {
  const step = payload.steps[index];
  const result = await dispatchSingleStep(step);
  results.push(result);
  if (!result.ok) return failure;
  if (index < payload.steps.length - 1) {
    await sleep(randomDelay());
  }
}
```

- [ ] **Step 4: Re-run the focused service tests and keep them green**

Run: `pnpm --filter @autobrowser/service exec vitest run test/service.test.ts`
Expected: PASS

### Task 4: Full Verification

**Files:**
- Test: `packages/shared/test/protocol.test.ts`
- Test: `packages/cli/test/cli.test.ts`
- Test: `packages/service/test/service.test.ts`

- [ ] **Step 1: Run focused tests for touched packages**

Run: `pnpm --filter @autobrowser/shared exec vitest run test/protocol.test.ts && pnpm --filter @autobrowser/cli exec vitest run test/cli.test.ts && pnpm --filter @autobrowser/service exec vitest run test/service.test.ts`
Expected: PASS

- [ ] **Step 2: Run build for the workspace**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 3: Review the diff for unnecessary complexity and trim it**

Run: `git diff -- packages/shared packages/cli packages/service`
Expected: Only flow-related changes and tests
