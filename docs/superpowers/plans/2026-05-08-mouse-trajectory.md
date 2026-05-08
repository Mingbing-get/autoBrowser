# Mouse Trajectory Recording Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add extension-side mouse trajectory recording and management plus service-side trajectory-backed mouse replay with bezier fallback.

**Architecture:** Extend the shared protocol with explicit trajectory management commands, add a dedicated extension `options` page that records trajectories in its own DOM, and add a service repository plus trajectory transformer that the native mouse executor consults before falling back to the existing human-like movement path. Keep persistence owned by the service and thread new commands through the existing background/native-host/service dispatch layers.

**Tech Stack:** TypeScript, pnpm workspace, Vitest, Chrome Manifest V3 extension APIs, Node.js file IO, `robotjs`

---

### Task 1: Shared Protocol For Trajectory Management

**Files:**
- Modify: `packages/shared/src/types/protocol.ts`
- Modify: `packages/shared/src/guards/is-command-message.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/index.d.ts`
- Test: `packages/shared/test/protocol.test.ts`

- [ ] **Step 1: Write failing shared protocol tests for `mouseTrajectoryList`, `mouseTrajectoryCreate`, and `mouseTrajectoryDelete`.**
- [ ] **Step 2: Run `pnpm --filter @autobrowser/shared test` and confirm the new tests fail because the commands are unsupported.**
- [ ] **Step 3: Add the minimal command, payload, and result types plus command guard coverage and exports.**
- [ ] **Step 4: Re-run `pnpm --filter @autobrowser/shared test` and keep it green.**

### Task 2: Service Repository And Trajectory Replay

**Files:**
- Create: `packages/service/src/trajectory/types.ts`
- Create: `packages/service/src/trajectory/file-trajectory-repository.ts`
- Create: `packages/service/src/trajectory/transform-trajectory.ts`
- Modify: `packages/service/src/click/human-mouse.ts`
- Modify: `packages/service/src/click/native-click-executor.ts`
- Modify: `packages/service/src/click/types.ts`
- Modify: `packages/service/src/types/service.ts`
- Modify: `packages/service/src/app/auto-browser-service.ts`
- Test: `packages/service/test/human-mouse.test.ts`
- Test: `packages/service/test/service.test.ts`

- [ ] **Step 1: Write failing service tests for repository persistence, transformed trajectory replay, and bezier fallback when no valid trajectory exists.**
- [ ] **Step 2: Run the focused service tests and verify failures are in the missing trajectory support.**
- [ ] **Step 3: Implement the repository, normalization, transform-and-replay helpers, and executor integration with fallback.**
- [ ] **Step 4: Re-run the focused service tests and keep them green.**

### Task 3: Service Command And HTTP Management Surface

**Files:**
- Create: `packages/service/src/http/handlers/mouse-trajectory-list-handler.ts`
- Create: `packages/service/src/http/handlers/mouse-trajectory-create-handler.ts`
- Create: `packages/service/src/http/handlers/mouse-trajectory-delete-handler.ts`
- Modify: `packages/service/src/http/routes.ts`
- Test: `packages/service/test/service.test.ts`

- [ ] **Step 1: Write failing service tests for dispatching list, create, and delete trajectory commands.**
- [ ] **Step 2: Run the focused tests and confirm dispatch fails because the commands and routes do not exist yet.**
- [ ] **Step 3: Add minimal service dispatch handling plus matching HTTP handlers and routes.**
- [ ] **Step 4: Re-run the focused tests and keep them green.**

### Task 4: Extension Background And Options Page

**Files:**
- Modify: `packages/extension/manifest.json`
- Modify: `packages/extension/scripts/prepare-dist.mjs`
- Modify: `packages/extension/src/background.ts`
- Create: `packages/extension/options.html`
- Create: `packages/extension/src/options.ts`
- Create: `packages/extension/src/options.css`
- Test: `packages/extension/test/handlers.test.ts`

- [ ] **Step 1: Write failing extension tests for background forwarding and pure helpers used by the options page recording flow.**
- [ ] **Step 2: Run `pnpm --filter @autobrowser/extension test` and verify the failures are in the missing options-page support.**
- [ ] **Step 3: Add the options page, random point generation, recording state machine, list/delete/create messaging, and dist asset copying.**
- [ ] **Step 4: Re-run `pnpm --filter @autobrowser/extension test` and keep it green.**

### Task 5: Verification

**Files:**
- Test: `packages/shared/test/protocol.test.ts`
- Test: `packages/service/test/human-mouse.test.ts`
- Test: `packages/service/test/service.test.ts`
- Test: `packages/extension/test/handlers.test.ts`

- [ ] **Step 1: Run focused package tests for `shared`, `service`, and `extension`.**
- [ ] **Step 2: Run package typechecks for `service` and `extension`.**
- [ ] **Step 3: Review the final diff for duplicated trajectory helpers or overgrown files and trim before wrapping up.**
