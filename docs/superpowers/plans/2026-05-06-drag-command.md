# Drag Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `ab drag` so the CLI can drag an element to a target selector anchor or viewport coordinate, then return a post-drag observation summary.

**Architecture:** Extend the shared protocol and CLI with a single `drag` command shape that supports either `targetSelector + direction` or viewport `x/y`. Reuse the service's click calibration and visibility logic to resolve browser points, then perform a native `mouseDown -> curved move -> mouseUp` sequence and wrap it with the existing observe start/finish browser commands.

**Tech Stack:** TypeScript, pnpm workspace, Vitest, Chrome extension scripting APIs, `robotjs`

---

### Task 1: Shared Protocol And CLI Surface

**Files:**
- Modify: `packages/shared/src/types/protocol.ts`
- Modify: `packages/shared/src/guards/is-command-message.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/index.d.ts`
- Test: `packages/shared/test/protocol.test.ts`
- Modify: `packages/cli/src/index.ts`
- Create: `packages/cli/src/commands/drag.ts`
- Modify: `packages/cli/src/client/http-client.ts`
- Test: `packages/cli/test/cli.test.ts`

- [ ] **Step 1: Write failing shared and CLI tests for `drag`**
- [ ] **Step 2: Run the focused tests and confirm they fail because `drag` is unsupported**
- [ ] **Step 3: Add the minimal protocol, command parsing, and HTTP routing support**
- [ ] **Step 4: Re-run the focused tests and keep them green**

### Task 2: Service Drag Orchestration

**Files:**
- Modify: `packages/service/src/types/service.ts`
- Modify: `packages/service/src/app/auto-browser-service.ts`
- Modify: `packages/service/src/click/types.ts`
- Modify: `packages/service/src/click/native-click-executor.ts`
- Test: `packages/service/test/service.test.ts`

- [ ] **Step 1: Write failing service tests for selector-anchor drags, viewport-coordinate drags, and invalid viewport targets**
- [ ] **Step 2: Run the focused service tests and verify the failures are in missing drag support**
- [ ] **Step 3: Implement the minimal drag orchestration, target resolution, native mouse down/up, and observation wrapping**
- [ ] **Step 4: Re-run the focused service tests and keep them green**

### Task 3: Service HTTP Surface

**Files:**
- Create: `packages/service/src/http/handlers/drag-handler.ts`
- Modify: `packages/service/src/http/routes.ts`

- [ ] **Step 1: Add the HTTP handler and route for `/commands/drag`**
- [ ] **Step 2: Keep the route shape aligned with the other command handlers**

### Task 4: Verification

**Files:**
- Test: `packages/shared/test/protocol.test.ts`
- Test: `packages/cli/test/cli.test.ts`
- Test: `packages/service/test/service.test.ts`

- [ ] **Step 1: Run focused tests for `shared`, `cli`, and `service`**
- [ ] **Step 2: Run the package test suites for the touched packages**
- [ ] **Step 3: Review the diff for duplication in click and drag helpers and trim it**
