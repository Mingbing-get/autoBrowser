import type { MouseTrajectorySummaryPayload } from "@autobrowser/shared";
import {
  createRandomPointPair,
  isPointWithinHitRadius,
  MAX_RECORDING_DURATION_MS,
  toRelativePoint,
  type Point
} from "./options/recording.js";
import type { MouseTrajectoryApiRequest, MouseTrajectoryApiResponse } from "./runtime/mouse-trajectory-api.js";

type RecordingStatus = "idle" | "waiting-for-start" | "recording" | "success" | "failed";

interface RecordingSample extends Point {
  t: number;
}

interface AppState {
  status: RecordingStatus;
  pair: { start: Point; end: Point } | null;
  samples: RecordingSample[];
  startTimestamp: number | null;
  timeoutHandle: number | null;
}

const state: AppState = {
  status: "idle",
  pair: null,
  samples: [],
  startTimestamp: null,
  timeoutHandle: null
};

const canvas = getRequiredElement<HTMLDivElement>("recording-canvas");
const statusText = getRequiredElement<HTMLParagraphElement>("status-text");
const startButton = getRequiredElement<HTMLButtonElement>("start-recording");
const cancelButton = getRequiredElement<HTMLButtonElement>("cancel-recording");
const refreshButton = getRequiredElement<HTMLButtonElement>("refresh-trajectories");
const trajectoryList = getRequiredElement<HTMLUListElement>("trajectory-list");

startButton.addEventListener("click", () => {
  void beginRecording();
});

cancelButton.addEventListener("click", () => {
  resetRecording("idle", "已取消录制。");
});

refreshButton.addEventListener("click", () => {
  void loadTrajectories();
});

window.addEventListener("mousemove", (event) => {
  void handleMouseMove(event);
});

void loadTrajectories();
setStatus("idle", "点击开始录制后，将在画布内随机生成两个点。");

async function beginRecording() {
  const rect = canvas.getBoundingClientRect();
  state.pair = createRandomPointPair({
    width: rect.width,
    height: rect.height
  });
  state.samples = [];
  state.startTimestamp = null;
  clearRecordingTimeout();
  renderMarkers();
  setStatus("waiting-for-start", "先进入起点，再移动到终点。");
}

async function handleMouseMove(event: MouseEvent) {
  if (!state.pair || (state.status !== "waiting-for-start" && state.status !== "recording")) {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const point = toRelativePoint(
    { clientX: event.clientX, clientY: event.clientY },
    { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
  );

  if (!point) {
    return;
  }

  if (state.status === "waiting-for-start") {
    if (!isPointWithinHitRadius(point, state.pair.start)) {
      return;
    }

    state.samples = [{ x: point.x, y: point.y, t: 0 }];
    state.startTimestamp = event.timeStamp;
    state.status = "recording";
    state.timeoutHandle = window.setTimeout(() => {
      resetRecording("failed", "录制超时，请重试。");
    }, MAX_RECORDING_DURATION_MS);
    setStatus("recording", "正在录制轨迹，继续移动到终点。");
    return;
  }

  if (state.startTimestamp === null) {
    return;
  }

  state.samples.push({
    x: point.x,
    y: point.y,
    t: Math.max(0, Math.round(event.timeStamp - state.startTimestamp))
  });

  if (!isPointWithinHitRadius(point, state.pair.end)) {
    return;
  }

  clearRecordingTimeout();
  await saveRecording(state.samples);
}

async function saveRecording(points: RecordingSample[]) {
  try {
    const result = await sendApiRequest({
      kind: "mouseTrajectoryApi",
      action: "create",
      payload: {
        points
      }
    });

    if (!result.ok) {
      resetRecording("failed", result.error);
      return;
    }

    state.pair = null;
    state.samples = [];
    state.startTimestamp = null;
    canvas.innerHTML = "";
    setStatus("success", "录制成功，轨迹已保存。");
    await loadTrajectories();
  } catch (error) {
    resetRecording("failed", error instanceof Error ? error.message : "保存轨迹失败。");
  }
}

async function loadTrajectories() {
  const result = await sendApiRequest({
    kind: "mouseTrajectoryApi",
    action: "list"
  });

  if (!result.ok) {
    trajectoryList.innerHTML = `<li class="trajectory-empty">加载失败：${escapeHtml(result.error)}</li>`;
    return;
  }

  renderTrajectoryList(
    (result.payload as { trajectories: MouseTrajectorySummaryPayload[] }).trajectories
  );
}

function renderTrajectoryList(trajectories: MouseTrajectorySummaryPayload[]) {
  if (trajectories.length === 0) {
    trajectoryList.innerHTML = '<li class="trajectory-empty">还没有录制轨迹。</li>';
    return;
  }

  trajectoryList.innerHTML = "";

  for (const trajectory of trajectories) {
    const item = document.createElement("li");
    item.className = "trajectory-item";
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(trajectory.id)}</strong>
        <div class="trajectory-meta">
          ${trajectory.pointCount} 点 · ${trajectory.durationMs} ms · ${Math.round(trajectory.sourceDistance)} px
        </div>
      </div>
    `;

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "删除";
    button.addEventListener("click", () => {
      void deleteTrajectory(trajectory.id);
    });

    item.appendChild(button);
    trajectoryList.appendChild(item);
  }
}

async function deleteTrajectory(id: string) {
  const result = await sendApiRequest({
    kind: "mouseTrajectoryApi",
    action: "delete",
    payload: { id }
  });

  if (!result.ok) {
    setStatus("failed", `删除失败：${result.error}`);
    return;
  }

  setStatus("success", "轨迹已删除。");
  await loadTrajectories();
}

function renderMarkers() {
  canvas.innerHTML = "";
  if (!state.pair) {
    return;
  }

  canvas.appendChild(createMarker(state.pair.start, "起点", "start"));
  canvas.appendChild(createMarker(state.pair.end, "终点", "end"));
}

function createMarker(point: Point, label: string, variant: "start" | "end") {
  const marker = document.createElement("div");
  marker.className = `marker marker-${variant}`;
  marker.style.left = `${point.x}px`;
  marker.style.top = `${point.y}px`;
  marker.setAttribute("aria-label", label);
  marker.textContent = label;
  return marker;
}

function setStatus(status: RecordingStatus, message: string) {
  state.status = status;
  statusText.textContent = message;
  canvas.dataset.status = status;
}

function resetRecording(status: RecordingStatus, message: string) {
  clearRecordingTimeout();
  state.pair = null;
  state.samples = [];
  state.startTimestamp = null;
  canvas.innerHTML = "";
  setStatus(status, message);
}

function clearRecordingTimeout() {
  if (state.timeoutHandle !== null) {
    window.clearTimeout(state.timeoutHandle);
    state.timeoutHandle = null;
  }
}

async function sendApiRequest(request: MouseTrajectoryApiRequest) {
  return await chrome.runtime.sendMessage<MouseTrajectoryApiResponse>(request);
}

function getRequiredElement<TElement extends HTMLElement>(id: string) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`missing element: ${id}`);
  }
  return element as TElement;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
