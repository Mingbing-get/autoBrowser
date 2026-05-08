# Mouse Trajectory Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mini trajectory trend preview to every saved trajectory row in the extension options page.

**Architecture:** Extend the trajectory list payload to include normalized point data, then render each row with a compact SVG sparkline-like path generated from the stored points. Keep the preview math in a small pure helper so service behavior and UI rendering can be tested independently.

**Tech Stack:** TypeScript, Vitest, Chrome extension options UI, shared protocol types

---

### Task 1: Expand list payload to include trajectory points

**Files:**
- Modify: `packages/shared/src/types/protocol.ts`
- Modify: `packages/service/src/app/auto-browser-service.ts`
- Modify: `packages/service/test/service.test.ts`

- [ ] **Step 1: Write the failing test**

Add a service test asserting `mouseTrajectoryList` returns full trajectory records including `points`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @autobrowser/service test`
Expected: FAIL because the list command still maps records to summaries.

- [ ] **Step 3: Write minimal implementation**

Return repository list records directly from the list command and update the shared list payload type accordingly.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @autobrowser/service test`
Expected: PASS for the updated list behavior.

### Task 2: Add preview path generation helper

**Files:**
- Modify: `packages/extension/src/options/recording.ts`
- Test: `packages/extension/test/options-recording.test.ts`

- [ ] **Step 1: Write the failing test**

Add tests for converting trajectory points into a padded mini-preview SVG path that preserves the overall movement shape.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @autobrowser/extension test`
Expected: FAIL because the helper does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Add a pure helper that computes bounds, scales points into a fixed preview box, and returns an SVG path string plus dimensions.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @autobrowser/extension test`
Expected: PASS for the new helper.

### Task 3: Render mini previews in the trajectory list

**Files:**
- Modify: `packages/extension/src/options.ts`
- Modify: `packages/extension/options.css`

- [ ] **Step 1: Write the failing test**

If needed, extend helper-focused tests or add DOM-level assertions around the generated row markup.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @autobrowser/extension test`
Expected: FAIL because rows do not include preview markup.

- [ ] **Step 3: Write minimal implementation**

Render a compact SVG preview beside each trajectory summary and adjust row layout/styles for desktop and mobile.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @autobrowser/extension test`
Expected: PASS with the preview visible for each row.

### Task 4: Verify the full change set

**Files:**
- No code changes required unless verification uncovers issues

- [ ] **Step 1: Run focused verification**

Run:
- `pnpm --filter @autobrowser/service test`
- `pnpm --filter @autobrowser/extension test`

Expected: PASS.

- [ ] **Step 2: Run typechecks if needed**

Run:
- `pnpm --filter @autobrowser/service typecheck`
- `pnpm --filter @autobrowser/extension typecheck`

Expected: PASS.
