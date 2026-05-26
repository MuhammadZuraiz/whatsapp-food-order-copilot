type AdapterCaptureSuccess = {
  ok: true;
  chatName: string;
  rawText: string;
  messageCount: number;
  adapterVersion: string;
  warnings: string[];
};

type AdapterCaptureFailure = {
  ok: false;
  error: string;
  adapterVersion: string;
};

type AdapterCaptureResult = AdapterCaptureSuccess | AdapterCaptureFailure;

type WhatsAppAdapterGlobal = typeof globalThis & {
  WfoWhatsAppDomAdapter?: {
    captureCurrentChat: (businessSenderNames?: string[]) => AdapterCaptureResult;
    version: string;
  };
};

const WHATSAPP_DOM_ADAPTER_VERSION = "2026-05-visible-chat-v1";
const LAYOUT_CHANGED_MESSAGE =
  "WhatsApp layout changed or no chat is open. Open a chat and try again.";

const selectors = {
  chatRoot: "#main",
  chatTitles: [
    "#main header span[title]",
    "#main header [data-testid='conversation-info-header-chat-title']",
    "#main header [role='button'] span[title]",
    "header span[title]"
  ],
  messageWithMetadata: "#main [data-pre-plain-text]",
  fallbackMessages: [
    "#main .message-in",
    "#main .message-out",
    "#main [class*='message-in']",
    "#main [class*='message-out']"
  ],
  selectableText: "span.selectable-text.copyable-text, span[dir='auto'], span[dir='ltr']"
};

function cleanText(value: string | null | undefined) {
  return (value ?? "").replace(/\u200e|\u200f/g, "").replace(/\s+\n/g, "\n").trim();
}

function normalizeName(value: string) {
  return value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function businessSenderLabel(businessSenderNames: string[]) {
  return (
    businessSenderNames.find((name) => normalizeName(name) === "you") ??
    businessSenderNames[0] ??
    "You"
  );
}

function isWhatsAppWeb() {
  return window.location.hostname === "web.whatsapp.com";
}

function getChatRoot() {
  return document.querySelector<HTMLElement>(selectors.chatRoot);
}

function getChatName() {
  for (const selector of selectors.chatTitles) {
    const element = document.querySelector<HTMLElement>(selector);
    const title = cleanText(element?.getAttribute("title") ?? element?.textContent);

    if (title && !/^(search|menu|profile details)$/i.test(title)) {
      return title;
    }
  }

  const documentTitle = cleanText(document.title).replace(/\s*-\s*WhatsApp$/, "");

  return documentTitle && documentTitle !== "WhatsApp" ? documentTitle : "WhatsApp Chat";
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatDate(date: Date) {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function formatTime(date: Date) {
  let hour = date.getHours();
  const minute = pad(date.getMinutes());
  const period = hour >= 12 ? "PM" : "AM";

  hour %= 12;

  return `${hour || 12}:${minute} ${period}`;
}

function fallbackDateTime() {
  const now = new Date();

  return {
    datePart: formatDate(now),
    timePart: formatTime(now)
  };
}

function looksLikeTime(value: string) {
  return /\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?\b/i.test(value);
}

function normalizeDatePart(value: string) {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);

  if (!match) {
    return null;
  }

  const [, firstText, secondText, yearText] = match;
  const first = Number(firstText);
  const second = Number(secondText);
  const year = yearText.length === 2 ? `20${yearText}` : yearText;

  if (first > 12) {
    return `${pad(first)}/${pad(second)}/${year}`;
  }

  if (second > 12) {
    return `${pad(second)}/${pad(first)}/${year}`;
  }

  return `${pad(first)}/${pad(second)}/${year}`;
}

function parseDataPrePlainText(value: string | null) {
  const match = value?.match(/^\[([^\]]+)\]\s*([^:]+):\s*$/);

  if (!match) {
    return null;
  }

  const [, metadata, senderName] = match;
  const parts = metadata.split(",").map((part) => part.trim()).filter(Boolean);

  if (parts.length < 2) {
    return null;
  }

  const [first, second] = parts;
  const datePart = looksLikeTime(first) ? normalizeDatePart(second) : normalizeDatePart(first);
  const timePart = looksLikeTime(first) ? first : second;

  if (!datePart || !timePart) {
    return null;
  }

  return {
    datePart,
    timePart,
    senderName: cleanText(senderName)
  };
}

function isOutgoingMessage(element: Element) {
  const messageElement = element.closest<HTMLElement>(
    ".message-out, [class*='message-out']"
  );

  if (messageElement) {
    return true;
  }

  return Boolean(
    element.closest<HTMLElement>("[data-testid='msg-dblcheck'], [aria-label*='Read'], [aria-label*='Delivered']")
  );
}

function textFromMessageElement(element: Element) {
  const selectableTexts = [...element.querySelectorAll<HTMLElement>(selectors.selectableText)]
    .map((child) => cleanText(child.textContent))
    .filter(Boolean);

  if (selectableTexts.length > 0) {
    return selectableTexts.join("\n");
  }

  return cleanText(element.textContent);
}

function formatExportLine(
  datePart: string,
  timePart: string,
  senderName: string,
  text: string
) {
  return `${datePart}, ${timePart} - ${senderName}: ${text}`;
}

function uniqueKey(parts: string[]) {
  return parts.join("::").toLocaleLowerCase();
}

function captureFromMetadata(
  businessSenderNames: string[],
  warnings: string[]
) {
  const businessLabel = businessSenderLabel(businessSenderNames);
  const messages: string[] = [];
  const seen = new Set<string>();
  let approximateTimestampCount = 0;

  for (const element of document.querySelectorAll<HTMLElement>(
    selectors.messageWithMetadata
  )) {
    const text = textFromMessageElement(element);

    if (!text) {
      continue;
    }

    const parsed = parseDataPrePlainText(element.getAttribute("data-pre-plain-text"));
    const timestamp = parsed ?? fallbackDateTime();
    const senderName = isOutgoingMessage(element)
      ? businessLabel
      : parsed?.senderName || "Customer";
    const key = uniqueKey([timestamp.datePart, timestamp.timePart, senderName, text]);

    if (seen.has(key)) {
      continue;
    }

    if (!parsed) {
      approximateTimestampCount += 1;
    }

    seen.add(key);
    messages.push(
      formatExportLine(timestamp.datePart, timestamp.timePart, senderName, text)
    );
  }

  if (approximateTimestampCount > 0) {
    warnings.push(
      `${approximateTimestampCount} visible message timestamp(s) were approximated because WhatsApp metadata was unavailable.`
    );
  }

  return messages;
}

function captureFromFallbackContainers(
  businessSenderNames: string[],
  warnings: string[]
) {
  const businessLabel = businessSenderLabel(businessSenderNames);
  const messages: string[] = [];
  const seen = new Set<string>();
  const timestamp = fallbackDateTime();

  for (const selector of selectors.fallbackMessages) {
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      const text = textFromMessageElement(element);

      if (!text) {
        continue;
      }

      const senderName = isOutgoingMessage(element) ? businessLabel : "Customer";
      const key = uniqueKey([senderName, text]);

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      messages.push(
        formatExportLine(timestamp.datePart, timestamp.timePart, senderName, text)
      );
    }
  }

  if (messages.length > 0) {
    warnings.push(
      "Message timestamps were approximated because WhatsApp message metadata was not available."
    );
  }

  return messages;
}

function captureCurrentChat(
  businessSenderNames: string[] = []
): AdapterCaptureResult {
  if (!isWhatsAppWeb()) {
    return {
      ok: false,
      error: "Open web.whatsapp.com and select a chat before analyzing.",
      adapterVersion: WHATSAPP_DOM_ADAPTER_VERSION
    };
  }

  if (!getChatRoot()) {
    return {
      ok: false,
      error: LAYOUT_CHANGED_MESSAGE,
      adapterVersion: WHATSAPP_DOM_ADAPTER_VERSION
    };
  }

  const warnings: string[] = [];
  let messages = captureFromMetadata(businessSenderNames, warnings);

  if (messages.length === 0) {
    messages = captureFromFallbackContainers(businessSenderNames, warnings);
  }

  if (messages.length === 0) {
    return {
      ok: false,
      error: LAYOUT_CHANGED_MESSAGE,
      adapterVersion: WHATSAPP_DOM_ADAPTER_VERSION
    };
  }

  warnings.push("Only visible loaded messages were captured. Older messages were not scrolled or loaded automatically.");

  return {
    ok: true,
    chatName: getChatName(),
    rawText: messages.join("\n"),
    messageCount: messages.length,
    adapterVersion: WHATSAPP_DOM_ADAPTER_VERSION,
    warnings
  };
}

(globalThis as WhatsAppAdapterGlobal).WfoWhatsAppDomAdapter = {
  captureCurrentChat,
  version: WHATSAPP_DOM_ADAPTER_VERSION
};
