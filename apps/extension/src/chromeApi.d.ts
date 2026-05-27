type WfoChromeTab = {
  id?: number;
  url?: string;
  title?: string;
};

type WfoChromeRuntimeError = {
  message?: string;
};

type WfoChromeStorageArea = {
  get: (
    keys: string | string[] | Record<string, unknown> | null,
    callback: (items: Record<string, unknown>) => void
  ) => void;
  set: (items: Record<string, unknown>, callback?: () => void) => void;
  remove: (keys: string | string[], callback?: () => void) => void;
};

declare const chrome: {
  runtime: {
    lastError?: WfoChromeRuntimeError;
    onMessage: {
      addListener: (
        callback: (
          message: unknown,
          sender: unknown,
          sendResponse: (response: unknown) => void
        ) => boolean | void
      ) => void;
    };
  };
  tabs: {
    query: (
      queryInfo: { active: boolean; currentWindow: boolean },
      callback: (tabs: WfoChromeTab[]) => void
    ) => void;
    sendMessage: (
      tabId: number,
      message: unknown,
      callback: (response: unknown) => void
    ) => void;
  };
  storage?: {
    local?: WfoChromeStorageArea;
    session?: WfoChromeStorageArea;
  };
};
