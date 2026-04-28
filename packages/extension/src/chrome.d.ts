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
  }

  namespace tabs {
    interface Tab {
      id?: number;
      url?: string;
      status?: "loading" | "complete";
      title?: string;
    }

    function create(createProperties: { url: string }): Promise<Tab>;
    function get(tabId: number): Promise<Tab>;
    function query(queryInfo: { active: boolean; lastFocusedWindow: boolean }): Promise<Tab[]>;
    const onUpdated: {
      addListener(
        callback: (tabId: number, changeInfo: { status?: "loading" | "complete" }, tab: Tab) => void
      ): void;
      removeListener(
        callback: (tabId: number, changeInfo: { status?: "loading" | "complete" }, tab: Tab) => void
      ): void;
    };
  }

  namespace scripting {
    function executeScript(options: {
      target: { tabId: number };
      func: (...args: unknown[]) => unknown;
      args: unknown[];
    }): Promise<Array<{ result: unknown }>>;
  }
}
