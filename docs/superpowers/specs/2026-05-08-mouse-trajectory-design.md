# Mouse Trajectory Recording Design

## Goal

Add support for recording real user mouse movement trajectories in the browser extension and reusing them for future mouse movements in the local service.

The desired behavior is:

- the extension provides a dedicated `options` page for trajectory recording and management
- each recording session shows two random points inside the visible recording area
- the user moves the cursor from the first point to the second point
- the extension records the full movement path and sends it to the service
- the service stores recorded trajectories in a local file
- when mouse movement is needed, the service first checks whether recorded trajectories exist
- if a trajectory exists, the service picks one at random, transforms it to the requested start and end points, and replays it
- if no recorded trajectory is available, the service falls back to the existing bezier-plus-jitter movement logic

## Recommended Architecture

### Extension UI

Add a dedicated `options` page in `packages/extension` for trajectory recording and management.

The page should contain three areas:

- recording canvas area
- recording status and actions
- trajectory list

The recording canvas is rendered entirely inside the extension page. It does not interact with the real web page DOM and does not require content script injection for recording.

### Extension messaging

The `options` page sends management requests to the background service worker using extension messaging.

The background service worker forwards service-facing requests through Native Messaging to the local service.

The extension should support at least these management operations:

- list trajectories
- create trajectory
- delete trajectory

### Service trajectory subsystem

Add a trajectory repository and a trajectory playback transformer in `packages/service`.

The repository handles:

- loading trajectory records from disk
- saving new trajectory records
- deleting trajectory records
- returning a random usable trajectory

The playback transformer handles:

- taking a stored normalized trajectory
- scaling it to the requested movement distance
- rotating it to the requested movement direction
- translating it to the current real cursor start point
- replaying the resulting points using the existing robot API

The trajectory subsystem should be used by the native click executor so that `click`, `hover`, and `drag` all benefit from the same movement selection behavior.

## Recording Flow

### Recording area

The `options` page shows a dedicated recording area sized to the visible page area.

Each recording session generates two random points inside that visible area.

Rules:

- both points must remain inside the visible area
- each point must keep a minimum margin of `24px` from the edge
- the distance between the two points must be at least `120px`

### Start and end conditions

Recording begins only after the cursor enters the start-point hit area.

This avoids storing unrelated movement while the user is still moving toward the first point.

Once recording has started:

- sample every `mousemove`
- store coordinates relative to the recording area
- store timing information for replay
- finish when the cursor enters the end-point hit area

If the user never enters the first point, recording should remain idle until canceled.

If the user starts recording but does not reach the second point within a timeout, the recording fails and can be retried.

### Status model

The UI should expose these states:

- idle
- waiting-for-start
- recording
- success
- failed

The page should surface short status text for each state and refresh the trajectory list after successful saves.

## Data Model

Recorded trajectories are global screen-level movement templates. They are not scoped to a web page, hostname, tab, viewport scale, or selector.

To make trajectories reusable across arbitrary movements, the service should store them in normalized form instead of absolute screen coordinates.

Recommended stored record shape:

```json
{
  "id": "traj_123",
  "createdAt": "2026-05-08T10:00:00.000Z",
  "durationMs": 742,
  "sourceDistance": 318.2,
  "pointCount": 48,
  "points": [
    { "x": 0, "y": 0, "t": 0 },
    { "x": 6.5, "y": 3.1, "t": 12 },
    { "x": 14.2, "y": 5.8, "t": 27 }
  ]
}
```

Field notes:

- `x` and `y` are offsets relative to the recording start point
- `t` is elapsed milliseconds since recording start
- the first point should be `(0, 0, 0)`
- the last point should correspond to the recorded end point

The service can derive summary values such as `pointCount` when loading, but storing them directly is fine if that simplifies management UI rendering.

## File Storage

Store trajectory records in a local JSON file managed by the service.

Recommended path:

- a service-owned data file under a writable application data directory
- for the initial implementation, a repo-local development path such as `packages/service/.data/mouse-trajectories.json` is acceptable

Persistence requirements:

- create the file on first write if it does not exist
- treat missing file as an empty trajectory list
- reject malformed file content safely and fall back to an empty list or a recoverable error path
- write the full JSON atomically enough for local single-process use

The repository interface should stay small and synchronous in behavior from the caller perspective even if file IO is asynchronous internally.

## Playback and Fallback Rules

### Selection

When the service needs to move the mouse:

1. read available trajectories
2. filter out invalid or unusable records
3. pick one usable record at random
4. transform and replay it

If no usable record exists, immediately fall back to the current human-like bezier movement.

### Transform

For a chosen trajectory:

1. get the current real cursor position from the robot API
2. compute the desired target vector
3. compute scale ratio as `targetDistance / sourceDistance`
4. compute rotation angle from stored trajectory direction to target direction
5. apply rotation and scaling to every recorded point
6. translate every point by the current real cursor start position

The replayed final point must be clamped to the requested target point so accumulated rounding error does not miss the target.

### Timing

Replay should preserve the original temporal feel as much as possible.

Recommended first version:

- use the recorded elapsed timestamps or point-to-point delays
- allow minor randomization only if needed later
- always ensure monotonic forward time

### Fallback cases

Fallback to the existing bezier-plus-jitter movement when any of these are true:

- the trajectory file is empty
- the chosen trajectory has fewer than a minimum number of points
- `sourceDistance` is zero or invalid
- transformed points contain invalid numbers
- replay cannot safely complete

Fallback should be silent and should preserve current functionality.

## Protocol and API Changes

### Shared protocol

Extend `packages/shared/src/types/protocol.ts` with trajectory management command types and payloads.

Command names:

- `mouseTrajectoryList`
- `mouseTrajectoryCreate`
- `mouseTrajectoryDelete`

Payloads:

- list: empty payload
- create: raw recorded points plus metadata from the `options` page; normalization happens in the service
- delete: trajectory `id`

Results:

- list result: trajectory summaries or full records as needed by the UI
- create result: saved trajectory summary or record
- delete result: deleted `id` and success flag

### Extension background routing

The background worker should:

- receive `options` page requests
- forward service commands over native messaging
- return responses back to the page

This keeps file storage out of the extension and maintains a single source of truth in the service.

### Service HTTP layer

The first version should expose HTTP endpoints for trajectory management so the service has one consistent API surface for both extension-initiated management and possible future CLI access.

The service needs command handlers and matching HTTP routes for:

- list trajectories
- create trajectory
- delete trajectory

## Code Changes

### `packages/extension`

- add an `options` page entrypoint and HTML shell
- add recording canvas UI and state management
- add random point generation constrained to the visible area
- add cursor hit detection for start and end points
- add mousemove sampling and timeout handling
- add extension messaging for list, create, and delete operations
- add trajectory list rendering and refresh behavior
- update `manifest.json` to register `options_page`

### `packages/shared`

- add command names for trajectory management
- add payload and result types
- update exports and protocol tests

### `packages/service`

- add a trajectory repository module
- add file-based persistence
- add trajectory validation helpers
- add transform-and-replay logic
- update native click executor to prefer recorded trajectories
- expose management command handlers through the service dispatch path
- update tests for repository behavior and replay selection

## Error Handling

- surface recording timeout and invalid recording failures in the `options` page
- reject create requests with too few points or invalid timing
- reject delete requests for unknown ids with a clear error or a no-op success policy
- ignore malformed stored trajectories during playback selection
- never let trajectory failures break existing click, hover, or drag commands if fallback is possible

## Testing Strategy

### Service tests

- repository loads empty when file is missing
- repository persists create and delete operations
- invalid records are filtered out
- transformed trajectory reaches the requested target
- replay uses recorded trajectory when available
- fallback uses bezier movement when no valid trajectory exists

### Shared tests

- protocol typing covers new command payloads and results

### Extension tests

- random point generation stays within visible bounds
- recordings start only after entering the first point
- recordings finish when entering the second point
- timeout transitions to failed state
- list rendering refreshes after save and delete

## Open Decisions Resolved

- trajectories are global and not page-specific
- recording happens only inside the extension `options` page
- the two points are generated randomly on every recording session
- both points must stay inside the visible recording area
- the service remains the owner of persistent trajectory storage
