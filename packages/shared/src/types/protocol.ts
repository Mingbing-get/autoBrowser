export type AutoBrowserCommand =
  | "open"
  | "close"
  | "tabs"
  | "query"
  | "search"
  | "searchFromPoint"
  | "summary"
  | "text"
  | "rect"
  | "click"
  | "scroll"
  | "input"
  | "upload"
  | "flow"
  | "clickMapStart"
  | "clickMapFinish"
  | "clickObserve"
  | "clickObserveStart"
  | "clickObserveFinish";

export interface OpenCommandPayload {
  url: string;
}

export interface CloseCommandPayload {
  tabId?: number;
}

export interface TabsCommandPayload {}

export interface QueryCommandPayload {
  selector: string;
  tabId?: number;
}

export interface SearchCommandPayload {
  text: string;
  tabId?: number;
}

export interface SearchFromPointCommandPayload {
  x: number;
  y: number;
  tabId?: number;
}

export interface SummaryCommandPayload {
  tabId?: number;
}

export interface TextCommandPayload {
  selector: string;
  tabId?: number;
}

export interface RectCommandPayload {
  selector: string;
  tabId?: number;
}

export interface ClickCommandPayload {
  selector: string;
  tabId?: number;
}

export interface ObserveCommandOptions {
  minObserveMs?: number;
  maxObserveMs?: number;
  stableWindowMs?: number;
  maxRegions?: number;
  maxItemsPerRegion?: number;
  maxTextLength?: number;
}

export interface ClickObserveCommandPayload {
  selector: string;
  tabId?: number;
  observe?: ObserveCommandOptions;
}

export interface ClickObserveStartCommandPayload {
  selector: string;
  tabId?: number;
  observe?: ObserveCommandOptions;
}

export interface ClickObserveFinishCommandPayload {
  tabId?: number;
  observe?: ObserveCommandOptions;
  awaitStability?: boolean;
}

export interface ScrollCommandPayload {
  deltaX: number;
  deltaY: number;
  tabId?: number;
}

export interface InputCommandPayload {
  selector: string;
  value: string;
  tabId?: number;
}

export interface UploadCommandPayload {
  selector: string;
  filepath: string;
  tabId?: number;
}

export type FlowStep =
  | {
      action: "open";
      url: string;
    }
  | {
      action: "tabs";
    }
  | {
      action: "close";
      tabId?: number;
    }
  | {
      action: "query";
      selector: string;
      tabId?: number;
    }
  | {
      action: "search";
      text: string;
      tabId?: number;
    }
  | {
      action: "search-from-point";
      x: number;
      y: number;
      tabId?: number;
    }
  | {
      action: "summary";
      tabId?: number;
    }
  | {
      action: "text";
      selector: string;
      tabId?: number;
    }
  | {
      action: "rect";
      selector: string;
      tabId?: number;
    }
  | {
      action: "click";
      selector: string;
      tabId?: number;
    }
  | {
      action: "click-observe";
      selector: string;
      tabId?: number;
      observe?: ObserveCommandOptions;
    }
  | {
      action: "scroll";
      deltaX: number;
      deltaY: number;
      tabId?: number;
    }
  | {
      action: "input";
      selector: string;
      value: string;
      tabId?: number;
    }
  | {
      action: "upload";
      selector: string;
      filepath: string;
      tabId?: number;
    };

export interface FlowCommandPayload {
  steps: FlowStep[];
}

export interface ClickMapStartCommandPayload {
  tabId?: number;
}

export interface ClickMapFinishCommandPayload {
  tabId?: number;
}

export type FlowStepResult =
  | {
      index: number;
      action: FlowStep["action"];
      ok: true;
      payload: unknown;
    }
  | {
      index: number;
      action: FlowStep["action"];
      ok: false;
      error: string;
    };

export interface FlowCommandResultPayload {
  results: FlowStepResult[];
  failedIndex?: number;
}

export interface DomNodeState {
  clickable?: boolean;
  editable?: boolean;
  disabled?: boolean;
  checked?: boolean;
  selected?: boolean;
}

export interface DomNodeLocator {
  preferred: string;
  fallbacks?: string[];
}

export interface DomNodeMeta {
  childrenTruncated?: boolean;
  hiddenChildrenCount?: number;
  textTruncated?: boolean;
  originalTextLength?: number;
}

export interface DomNodeSummary {
  tag: string;
  role?: string;
  text?: string;
  attrs?: Record<string, string>;
  state?: DomNodeState;
  locator?: DomNodeLocator;
  children?: DomNodeSummary[];
  meta?: DomNodeMeta;
}

export interface QueryResultMeta {
  depthLimit?: number;
  childLimit?: number;
  siblingLimit: number;
  textLimit: number;
  truncated: boolean;
}

export interface QueryResultPayload {
  found: boolean;
  self?: DomNodeSummary;
  context?: {
    ancestors?: DomNodeSummary[];
    siblings?: DomNodeSummary[];
  };
  meta?: QueryResultMeta;
}

export interface SearchMatchPayload {
  selector: string;
  tag: string;
  text?: string;
  role?: string;
  attrs?: Record<string, string>;
  state?: DomNodeState;
  visible: boolean;
}

export interface SearchResultMeta {
  query: string;
  limit: number;
  totalMatches: number;
  truncated: boolean;
}

export interface SearchResultPayload {
  found: boolean;
  matches: SearchMatchPayload[];
  meta: SearchResultMeta;
}

export interface SearchFromPointMatchPayload {
  level: number;
  selector: string;
  tag: string;
  text?: string;
  role?: string;
  attrs?: Record<string, string>;
  state?: DomNodeState;
  visible: boolean;
  locator?: DomNodeLocator;
  rect: ClientRectPayload & {
    scrollWidth: number;
    scrollHeight: number;
  };
  styles?: {
    zIndex?: string;
    pointerEvents?: string;
    display?: string;
    visibility?: string;
  };
}

export interface SearchFromPointResultPayload {
  found: boolean;
  x: number;
  y: number;
  matches: SearchFromPointMatchPayload[];
}

export interface PageHeadingSummary {
  level: number;
  text: string;
  locator?: DomNodeLocator;
}

export interface PageFormSummary {
  name?: string;
  locator?: DomNodeLocator;
  fields?: DomNodeSummary[];
  actions?: DomNodeSummary[];
  meta?: DomNodeMeta;
}

export interface PageSummaryPayload {
  title: string;
  url: string;
  descendants?: DomNodeSummary[];
  meta?: {
    textLimit: number;
    truncated: boolean;
  };
}

export interface PageTextPayload {
  found: boolean;
  text?: string;
}

export interface ClientRectPayload {
  x: number;
  y: number;
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface ViewportPayload {
  innerWidth: number;
  innerHeight: number;
  scrollX: number;
  scrollY: number;
}

export interface ScrollableAncestorPayload {
  tag: string;
  id?: string;
  isRootScroller?: boolean;
  rect: ClientRectPayload;
  scrollLeft: number;
  scrollTop: number;
  scrollWidth: number;
  scrollHeight: number;
  clientWidth: number;
  clientHeight: number;
}

export interface DomRectPayload {
  found: boolean;
  viewport?: ViewportPayload;
  rect?: ClientRectPayload & {
    scrollWidth: number;
    scrollHeight: number;
  };
  scrollableAncestors?: ScrollableAncestorPayload[];
}

export interface BrowserTabPayload {
  tabId: number;
  url: string | null;
  title: string | null;
  active: boolean;
}

export interface ClickCommandResultPayload {
  clicked: boolean;
  tabId: number;
}

export interface MeaningfulNodeSnapshot {
  key: string;
  tag: string;
  role?: string;
  text?: string;
  attrs?: Record<string, string>;
  state?: DomNodeState;
  locator?: DomNodeLocator;
  visible?: boolean;
  children?: MeaningfulNodeSnapshot[];
}

export interface ChangedNodePayload {
  key: string;
  change:
    | "added"
    | "removed"
    | "text-updated"
    | "state-updated"
    | "became-visible"
    | "became-hidden"
    | "layout-updated";
  before?: MeaningfulNodeSnapshot;
  after?: MeaningfulNodeSnapshot;
}

export interface ObservedRegionPayload {
  key: string;
  role?: string;
  locator?: DomNodeLocator;
  confidence: number;
  reasons: string[];
  changedNodes: ChangedNodePayload[];
}

export interface PostClickObservationPayload {
  primaryEffect:
    | "overlay"
    | "inline-expand"
    | "navigation"
    | "content-update"
    | "focus-shift"
    | "selection-change"
    | "no-visible-change";
  regions: ObservedRegionPayload[];
  activeElement?: MeaningfulNodeSnapshot;
  navigation?: {
    from: string;
    to: string;
    changed: boolean;
  };
  meta: {
    durationMs: number;
    endedBy: "stabilized" | "max-timeout" | "navigation" | "no-change";
    networkEvents: number;
    meaningfulMutations: number;
    debugSource?: string;
  };
}

export interface ClickObserveCommandResultPayload {
  clicked: boolean;
  tabId: number;
  observation: PostClickObservationPayload;
}

export interface ClickObserveStartResultPayload {
  started: boolean;
  tabId: number;
}

export interface ClickObserveFinishResultPayload {
  tabId: number;
  observation: PostClickObservationPayload;
}

export interface ScrollCommandResultPayload {
  scrolled: boolean;
  tabId: number;
  deltaX: number;
  deltaY: number;
}

export interface InputSourceInfo {
  kind: "keyboardLayout" | "inputMode" | "inputMethod" | "unknown";
  id?: string;
  localizedName?: string;
}

export interface InputCommandResultPayload {
  typed: boolean;
  tabId: number;
  strategy: "keystroke" | "paste";
  inputSource?: InputSourceInfo;
}

export interface UploadCommandResultPayload {
  uploaded: boolean;
  tabId: number;
  strategy: "native-dialog";
}

export interface ClickMapStartResultPayload {
  tabId: number;
  zoom: number;
  rect: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  window: {
    screenLeft: number;
    screenTop: number;
    innerWidth: number;
    innerHeight: number;
    outerWidth: number;
    outerHeight: number;
    devicePixelRatio: number;
  };
}

export interface ClickMapFinishResultPayload {
  tabId: number;
  points: Array<{
    x: number;
    y: number;
  }>;
}

export interface CommandPayloadMap {
  open: OpenCommandPayload;
  close: CloseCommandPayload;
  tabs: TabsCommandPayload;
  query: QueryCommandPayload;
  search: SearchCommandPayload;
  searchFromPoint: SearchFromPointCommandPayload;
  summary: SummaryCommandPayload;
  text: TextCommandPayload;
  rect: RectCommandPayload;
  click: ClickCommandPayload;
  scroll: ScrollCommandPayload;
  input: InputCommandPayload;
  upload: UploadCommandPayload;
  flow: FlowCommandPayload;
  clickMapStart: ClickMapStartCommandPayload;
  clickMapFinish: ClickMapFinishCommandPayload;
  clickObserve: ClickObserveCommandPayload;
  clickObserveStart: ClickObserveStartCommandPayload;
  clickObserveFinish: ClickObserveFinishCommandPayload;
}

export type AnyCommandPayload = CommandPayloadMap[AutoBrowserCommand];

export type CommandMessage<T extends AutoBrowserCommand = AutoBrowserCommand> = Extract<
  {
    [K in AutoBrowserCommand]: {
      kind: "command";
      requestId: string;
      command: K;
      payload: CommandPayloadMap[K];
    };
  }[AutoBrowserCommand],
  { command: T }
>;

export interface ResultMessage<TPayload = unknown> {
  kind: "result";
  requestId: string;
  ok: boolean;
  payload?: TPayload;
  error?: string;
}

export type ProtocolMessage = CommandMessage | ResultMessage;

export interface BrowserTransport {
  send(message: CommandMessage): void;
}
