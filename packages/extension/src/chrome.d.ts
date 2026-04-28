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
    function create(createProperties: { url: string }): Promise<{ id?: number; url?: string }>;
    function query(queryInfo: { active: boolean; lastFocusedWindow: boolean }): Promise<Array<{ id?: number }>>;
  }

  namespace scripting {
    function executeScript(options: {
      target: { tabId: number };
      func: (selector: string) => unknown;
      args: string[];
    }): Promise<Array<{ result: unknown }>>;
  }
}
