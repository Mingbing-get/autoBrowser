declare namespace chrome {
  namespace runtime {
    const lastError: {
      message?: string;
    } | undefined;

    interface Port {
      postMessage(message: unknown): void;
      onMessage: {
        addListener(callback: (message: unknown) => void): void;
      };
      onDisconnect: {
        addListener(callback: () => void): void;
      };
    }

    function connectNative(application: string): Port;
    function sendMessage<TResponse = unknown>(message: unknown): Promise<TResponse>;
    const onMessage: {
      addListener(
        callback: (
          message: unknown,
          sender: unknown,
          sendResponse: (response: unknown) => void
        ) => boolean | void
      ): void;
    };
  }

  namespace tabs {
    interface Tab {
      id?: number;
      url?: string;
      status?: "loading" | "complete";
      title?: string;
      active?: boolean;
      windowId?: number;
    }

    function create(createProperties: { url: string }): Promise<Tab>;
    function get(tabId: number): Promise<Tab>;
    function query(queryInfo: { active?: boolean; lastFocusedWindow?: boolean }): Promise<Tab[]>;
    function remove(tabId: number): Promise<void>;
    function update(tabId: number, updateProperties: { active?: boolean }): Promise<Tab>;
    const onUpdated: {
      addListener(
        callback: (tabId: number, changeInfo: { status?: "loading" | "complete" }, tab: Tab) => void
      ): void;
      removeListener(
        callback: (tabId: number, changeInfo: { status?: "loading" | "complete" }, tab: Tab) => void
      ): void;
    };
  }

  namespace windows {
    function update(windowId: number, updateInfo: { focused?: boolean }): Promise<void>;
  }

  namespace webRequest {
    interface RequestFilter {
      urls: string[];
    }

    interface RequestDetails {
      tabId: number;
      requestId: string;
    }

    interface RequestEvent {
      addListener(callback: (details: RequestDetails) => void, filter: RequestFilter): void;
      removeListener(callback: (details: RequestDetails) => void): void;
    }

    const onBeforeRequest: RequestEvent;
    const onCompleted: RequestEvent;
    const onErrorOccurred: RequestEvent;
  }

  namespace scripting {
    function executeScript(options: {
      target: { tabId: number };
      func: (...args: unknown[]) => unknown;
      args: unknown[];
    }): Promise<Array<{ result: unknown }>>;
  }
}
