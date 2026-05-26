type CaptureCurrentWhatsAppChatMessage = {
  type: "CAPTURE_CURRENT_WHATSAPP_CHAT";
  businessSenderNames?: string[];
};

type ContentAdapterGlobal = typeof globalThis & {
  WfoWhatsAppDomAdapter?: {
    captureCurrentChat: (businessSenderNames?: string[]) => unknown;
    version: string;
  };
};

const adapter = (globalThis as ContentAdapterGlobal).WfoWhatsAppDomAdapter;

console.info(
  `[WFO Copilot] WhatsApp Web content script loaded. Adapter: ${
    adapter?.version ?? "unavailable"
  }.`
);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const captureMessage = message as CaptureCurrentWhatsAppChatMessage;

  if (captureMessage.type !== "CAPTURE_CURRENT_WHATSAPP_CHAT") {
    return false;
  }

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
    currentAdapter.captureCurrentChat(captureMessage.businessSenderNames ?? [])
  );
  return true;
});
