type CaptureCurrentWhatsAppChatMessage = {
  type: "CAPTURE_CURRENT_WHATSAPP_CHAT";
  businessSenderNames?: string[];
};

type InsertReplyIntoWhatsAppComposerMessage = {
  type: "INSERT_REPLY_INTO_WHATSAPP_COMPOSER";
  text: string;
  forceReplace?: boolean;
};

type ContentMessage =
  | CaptureCurrentWhatsAppChatMessage
  | InsertReplyIntoWhatsAppComposerMessage;

type ContentAdapterGlobal = typeof globalThis & {
  WfoWhatsAppDomAdapter?: {
    captureCurrentChat: (businessSenderNames?: string[]) => unknown;
    version: string;
  };
  WfoWhatsAppComposerAdapter?: {
    insertReply: (text: string, forceReplace?: boolean) => Promise<unknown>;
    version: string;
  };
};

const adapter = (globalThis as ContentAdapterGlobal).WfoWhatsAppDomAdapter;
const composerAdapter = (globalThis as ContentAdapterGlobal)
  .WfoWhatsAppComposerAdapter;

console.info(
  `[WFO Copilot] WhatsApp Web content script loaded. Chat adapter: ${
    adapter?.version ?? "unavailable"
  }. Composer adapter: ${composerAdapter?.version ?? "unavailable"}.`
);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const contentMessage = message as ContentMessage;

  if (
    contentMessage.type !== "CAPTURE_CURRENT_WHATSAPP_CHAT" &&
    contentMessage.type !== "INSERT_REPLY_INTO_WHATSAPP_COMPOSER"
  ) {
    return false;
  }

  if (contentMessage.type === "CAPTURE_CURRENT_WHATSAPP_CHAT") {
    const currentAdapter = (globalThis as ContentAdapterGlobal)
      .WfoWhatsAppDomAdapter;

    if (!currentAdapter) {
      sendResponse({
        ok: false,
        error: "WhatsApp adapter was not loaded. Rebuild and reload the extension.",
        adapterVersion: "unavailable"
      });
      return true;
    }

    sendResponse(
      currentAdapter.captureCurrentChat(contentMessage.businessSenderNames ?? [])
    );
    return true;
  }

  const currentComposerAdapter = (globalThis as ContentAdapterGlobal)
    .WfoWhatsAppComposerAdapter;

  if (!currentComposerAdapter) {
    sendResponse({
      ok: false,
      error: "WhatsApp composer adapter was not loaded. Rebuild and reload the extension.",
      composerAdapterVersion: "unavailable"
    });
    return true;
  }

  void currentComposerAdapter
    .insertReply(contentMessage.text, contentMessage.forceReplace ?? false)
    .then(sendResponse)
    .catch((error: unknown) => {
      sendResponse({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not insert reply into WhatsApp composer.",
        reason: "insert_failed",
        composerAdapterVersion: currentComposerAdapter.version
      });
    });
  return true;
});
