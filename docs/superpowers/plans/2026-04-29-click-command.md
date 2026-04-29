# Click Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `autoBrowser click <selector> [--tabId]` that resolves a tab, calibrates browser-to-screen coordinates when needed, and performs a human-like native click via `robotjs`.

**Architecture:** Extend the shared command protocol with `click` and mapping-related payloads, let the browser extension provide element rects plus overlay-based calibration data, and let the local service orchestrate the flow. Native cursor motion and per-tab coordinate cache live in a focused service-side native click executor module so the service can coordinate browser and OS steps in one request path.

**Tech Stack:** TypeScript, pnpm workspace, Vitest, Chrome extension scripting APIs, `robotjs`

---

### Task 1: Protocol And CLI Surface

**Files:**
- Modify: `packages/shared/src/types/protocol.ts`
- Modify: `packages/shared/src/guards/is-command-message.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/index.d.ts`
- Test: `packages/shared/test/protocol.test.ts`
- Modify: `packages/cli/src/index.ts`
- Create: `packages/cli/src/commands/click.ts`
- Modify: `packages/cli/src/client/http-client.ts`
- Test: `packages/cli/test/cli.test.ts`

- [ ] **Step 1: Write failing shared and CLI tests for `click`**
- [ ] **Step 2: Run focused tests to verify the failures are for missing `click` support**
- [ ] **Step 3: Add minimal protocol and CLI support**
- [ ] **Step 4: Re-run focused tests and keep them green**

### Task 2: Extension Mapping Commands

**Files:**
- Modify: `packages/extension/src/adapters/scripting.ts`
- Modify: `packages/extension/src/handlers/handle-command.ts`
- Create: `packages/extension/src/handlers/click-command.ts`
- Test: `packages/extension/test/handlers.test.ts`

- [ ] **Step 1: Write failing extension tests for calibration start/finish and click payload retrieval**
- [ ] **Step 2: Run focused extension tests to verify the new command path fails correctly**
- [ ] **Step 3: Implement minimal extension handlers and injected overlay helpers**
- [ ] **Step 4: Re-run focused extension tests and keep them green**

### Task 3: Service Click Orchestration And Native Execution

**Files:**
- Modify: `packages/service/src/types/service.ts`
- Modify: `packages/service/src/app/auto-browser-service.ts`
- Create: `packages/service/src/click/native-click-executor.ts`
- Create: `packages/service/src/click/human-mouse.ts`
- Create: `packages/service/src/click/types.ts`
- Modify: `packages/service/test/service.test.ts`

- [ ] **Step 1: Write failing service tests for click orchestration with and without cached mappings**
- [ ] **Step 2: Run focused service tests to verify the orchestration is missing**
- [ ] **Step 3: Implement the minimal executor, cache, coordinate translation, and service orchestration**
- [ ] **Step 4: Re-run focused service tests and keep them green**

### Task 4: Verification

**Files:**
- Test: `packages/shared/test/protocol.test.ts`
- Test: `packages/cli/test/cli.test.ts`
- Test: `packages/extension/test/handlers.test.ts`
- Test: `packages/service/test/service.test.ts`

- [ ] **Step 1: Run focused package tests for the touched packages**
- [ ] **Step 2: Run workspace build or package builds for changed packages**
- [ ] **Step 3: Review the diff for unnecessary complexity and trim it**
