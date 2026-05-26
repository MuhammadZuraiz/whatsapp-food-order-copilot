type WfoChromeTab = {
  id?: number;
  url?: string;
  title?: string;
};

type WfoChromeRuntimeError = {
  message?: string;
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
};
