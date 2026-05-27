type PopupCaptureSuccess = {
  ok: true;
  chatName: string;
  rawText: string;
  messageCount: number;
  adapterVersion: string;
  warnings: string[];
};

type PopupCaptureFailure = {
  ok: false;
  error: string;
  adapterVersion: string;
};

type PopupCaptureResponse = PopupCaptureSuccess | PopupCaptureFailure;

type PopupInsertSuccess = {
  ok: true;
  insertedLength: number;
  matchedSelector?: string;
  originalDraftPreview?: string;
  beforeDraftPreview?: string;
  afterDeletePreview?: string;
  afterClearPreview?: string;
  finalDraftPreview?: string;
  afterDraftPreview?: string;
  currentDraftPreview?: string;
  strategy?: string;
  strategiesTried?: string[];
  clearSucceeded?: boolean;
  insertSucceeded?: boolean;
  selectionInsideComposer?: boolean;
  deleteCommandResult?: boolean;
  insertCommandResult?: boolean;
  restoredOriginal?: boolean;
  clearedAfterFailure?: boolean;
  composerTagName?: string;
  composerRole?: string;
  composerContentEditable?: string;
  composerDataTab?: string;
  composerAriaLabel?: string;
  composerChildCount?: number;
  activeElementSummary?: string;
  selectionAnchorInsideComposer?: boolean;
  composerAdapterVersion: string;
};

type PopupInsertFailure = {
  ok: false;
  error: string;
  reason?:
    | "clear_failed"
    | "draft_not_empty"
    | "composer_not_found"
    | "duplicate_insert_detected"
    | "insert_failed"
    | "not_whatsapp"
    | "selection_failed";
  currentDraftPreview?: string;
  originalDraftPreview?: string;
  beforeDraftPreview?: string;
  afterDeletePreview?: string;
  afterClearPreview?: string;
  finalDraftPreview?: string;
  afterDraftPreview?: string;
  matchedSelector?: string;
  insertedLength?: number;
  strategy?: string;
  strategiesTried?: string[];
  clearSucceeded?: boolean;
  insertSucceeded?: boolean;
  selectionInsideComposer?: boolean;
  deleteCommandResult?: boolean;
  insertCommandResult?: boolean;
  restoredOriginal?: boolean;
  clearedAfterFailure?: boolean;
  composerTagName?: string;
  composerRole?: string;
  composerContentEditable?: string;
  composerDataTab?: string;
  composerAriaLabel?: string;
  composerChildCount?: number;
  activeElementSummary?: string;
  selectionAnchorInsideComposer?: boolean;
  composerAdapterVersion: string;
};

type PopupInsertResponse = PopupInsertSuccess | PopupInsertFailure;

type SuggestedReply = {
  text: string;
  type: string;
  reason: string;
};

type AnalyzerResponse = {
  analysis: {
    source: "rule_based" | "ai_assisted" | "ai_fallback";
    customerSummary: string | null;
    customerMemoryUsed?: boolean;
    customerMemorySummary?: string | null;
    intent: string;
    orderLikely: boolean;
    order: {
      summary: string;
      missingFields: string[];
    };
    suggestedReplies: SuggestedReply[];
    warnings: string[];
  };
};

const apiBaseUrl = "http://localhost:4000";
const defaultBusinessSenderNames = "My Business, Business, You";

let activeTab: WfoChromeTab | null = null;
let apiConnected = false;
let lastCaptureWarnings: string[] = [];

function parseBusinessSenderNames(value: string) {
  return value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

function isWhatsAppTab(tab: WfoChromeTab | null) {
  return Boolean(tab?.url?.startsWith("https://web.whatsapp.com/"));
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function statusClass(ok: boolean) {
  return ok ? "status-ok" : "status-error";
}

function getElement<T extends HTMLElement>(selector: string) {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Missing popup element: ${selector}`);
  }

  return element;
}

function setText(selector: string, text: string) {
  getElement(selector).textContent = text;
}

function setStatus(selector: string, ok: boolean, text: string) {
  const element = getElement(selector);
  element.textContent = text;
  element.className = `status-pill ${statusClass(ok)}`;
}

function queryActiveTab() {
  return new Promise<WfoChromeTab | null>((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0] ?? null);
    });
  });
}

function sendCaptureMessage(tabId: number, businessSenderNames: string[]) {
  return new Promise<PopupCaptureResponse>((resolve, reject) => {
    chrome.tabs.sendMessage(
      tabId,
      {
        type: "CAPTURE_CURRENT_WHATSAPP_CHAT",
        businessSenderNames
      },
      (response) => {
        const error = chrome.runtime.lastError;

        if (error?.message) {
          reject(new Error(error.message));
          return;
        }

        resolve(response as PopupCaptureResponse);
      }
    );
  });
}

function sendInsertMessage(
  tabId: number,
  text: string,
  forceReplace: boolean
) {
  return new Promise<PopupInsertResponse>((resolve, reject) => {
    chrome.tabs.sendMessage(
      tabId,
      {
        type: "INSERT_REPLY_INTO_WHATSAPP_COMPOSER",
        text,
        forceReplace
      },
      (response) => {
        const error = chrome.runtime.lastError;

        if (error?.message) {
          reject(new Error(error.message));
          return;
        }

        resolve(response as PopupInsertResponse);
      }
    );
  });
}

async function checkApiHealth() {
  try {
    const response = await fetch(`${apiBaseUrl}/health`);
    apiConnected = response.ok;
  } catch {
    apiConnected = false;
  }

  setStatus(
    "#api-status",
    apiConnected,
    apiConnected ? "API connected" : "API not connected. Start pnpm dev:api first."
  );
  updateAnalyzeButton();
}

async function checkCurrentPage() {
  activeTab = await queryActiveTab();
  setStatus(
    "#page-status",
    isWhatsAppTab(activeTab),
    isWhatsAppTab(activeTab)
      ? "WhatsApp Web detected"
      : "Open web.whatsapp.com and select a chat."
  );
  updateAnalyzeButton();
}

function updateAnalyzeButton() {
  const button = getElement<HTMLButtonElement>("#analyze-button");
  button.disabled = !apiConnected || !isWhatsAppTab(activeTab);
}

function renderWarnings(warnings: string[]) {
  const container = getElement("#warnings");

  if (warnings.length === 0) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <section class="panel warning-panel">
      <h2>Warnings</h2>
      <ul>${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>
    </section>
  `;
}

function renderCapturePreview(capture: PopupCaptureSuccess | null) {
  const container = getElement("#capture-preview");

  if (!capture) {
    container.innerHTML = "";
    return;
  }

  const lines = capture.rawText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const firstLines = lines.slice(0, 2);
  const lastLines = lines.slice(-3);
  const previewLines =
    lines.length <= 5
      ? lines
      : [...firstLines, "...", ...lastLines];

  container.innerHTML = `
    <section class="panel preview-panel">
      <h2>Captured Chat Preview</h2>
      <dl class="preview-meta">
        <div><dt>Chat</dt><dd>${escapeHtml(capture.chatName)}</dd></div>
        <div><dt>Messages</dt><dd>${capture.messageCount}</dd></div>
        <div><dt>Adapter</dt><dd>${escapeHtml(capture.adapterVersion)}</dd></div>
      </dl>
      <pre>${previewLines.map(escapeHtml).join("\n")}</pre>
      ${
        capture.warnings.length > 0
          ? `<ul class="preview-warnings">${capture.warnings
              .map((warning) => `<li>${escapeHtml(warning)}</li>`)
              .join("")}</ul>`
          : ""
      }
    </section>
  `;
}

function hasGeneralChatWarning(analysis: AnalyzerResponse["analysis"]) {
  return analysis.warnings.some((warning) =>
    warning.includes("Current visible chat does not appear to contain a food order yet.")
  );
}

function updateInsertButtonState() {
  const allowGeneralInsert =
    document.querySelector<HTMLInputElement>("#allow-general-insert")?.checked ??
    false;

  for (const button of document.querySelectorAll<HTMLButtonElement>(".insert-button")) {
    button.disabled =
      button.dataset.generalChat === "true" && !allowGeneralInsert;
  }
}

function setInsertStatus(message: string, ok: boolean) {
  const container = document.querySelector<HTMLElement>("#insert-status");

  if (!container) {
    return;
  }

  container.textContent = message;
  container.className = ok ? "insert-status status-ok" : "insert-status status-error";
}

function insertFailureMessage(response: PopupInsertFailure) {
  return [
    response.error,
    response.reason ? `Reason: ${response.reason}` : null,
    `Adapter: ${response.composerAdapterVersion}`,
    response.matchedSelector ? `Selector: ${response.matchedSelector}` : null,
    response.strategy ? `Strategy: ${response.strategy}` : null,
    response.strategiesTried?.length
      ? `Strategies tried: ${response.strategiesTried.join(", ")}`
      : null,
    response.composerTagName ? `Composer: ${response.composerTagName}` : null,
    response.composerRole ? `Role: ${response.composerRole}` : null,
    response.composerContentEditable
      ? `Contenteditable: ${response.composerContentEditable}`
      : null,
    response.composerDataTab ? `Data tab: ${response.composerDataTab}` : null,
    response.composerAriaLabel
      ? `Aria label: ${response.composerAriaLabel}`
      : null,
    typeof response.composerChildCount === "number"
      ? `Child count: ${response.composerChildCount}`
      : null,
    response.activeElementSummary
      ? `Active element: ${response.activeElementSummary}`
      : null,
    typeof response.selectionAnchorInsideComposer === "boolean"
      ? `Selection inside composer: ${response.selectionAnchorInsideComposer}`
      : null,
    typeof response.selectionInsideComposer === "boolean"
      ? `Selection scoped to composer: ${response.selectionInsideComposer}`
      : null,
    typeof response.deleteCommandResult === "boolean"
      ? `Delete command result: ${response.deleteCommandResult}`
      : null,
    typeof response.insertCommandResult === "boolean"
      ? `Insert command result: ${response.insertCommandResult}`
      : null,
    response.originalDraftPreview
      ? `Original: ${response.originalDraftPreview}`
      : null,
    response.beforeDraftPreview
      ? `Before: ${response.beforeDraftPreview}`
      : null,
    response.afterDeletePreview
      ? `After delete: ${response.afterDeletePreview}`
      : null,
    response.afterClearPreview
      ? `After clear: ${response.afterClearPreview}`
      : null,
    response.finalDraftPreview ? `Final draft: ${response.finalDraftPreview}` : null,
    response.afterDraftPreview ? `After: ${response.afterDraftPreview}` : null,
    typeof response.clearSucceeded === "boolean"
      ? `Clear succeeded: ${response.clearSucceeded}`
      : null,
    typeof response.insertSucceeded === "boolean"
      ? `Insert succeeded: ${response.insertSucceeded}`
      : null,
    typeof response.restoredOriginal === "boolean"
      ? `Restored original: ${response.restoredOriginal}`
      : null,
    typeof response.clearedAfterFailure === "boolean"
      ? `Cleared after failure: ${response.clearedAfterFailure}`
      : null,
    response.currentDraftPreview
      ? `Current draft: ${response.currentDraftPreview}`
      : null
  ]
    .filter(Boolean)
    .join("\n");
}

function renderDraftConfirmation(
  reply: SuggestedReply,
  replyIndex: number,
  response: PopupInsertFailure,
  analysis: AnalyzerResponse["analysis"]
) {
  const container = document.querySelector<HTMLElement>(
    `#draft-confirmation-${replyIndex}`
  );

  if (!container) {
    return;
  }

  container.innerHTML = `
    <div class="draft-confirmation">
      <p>WhatsApp input already has text. Replace it?</p>
      ${
        response.currentDraftPreview
          ? `<p class="draft-preview">${escapeHtml(response.currentDraftPreview)}</p>`
          : ""
      }
      <div class="reply-actions">
        <button class="secondary replace-button" data-reply-index="${replyIndex}">
          Replace Draft
        </button>
        <button class="secondary cancel-replace-button" data-reply-index="${replyIndex}">
          Cancel
        </button>
      </div>
    </div>
  `;

  container
    .querySelector<HTMLButtonElement>(".replace-button")
    ?.addEventListener("click", () => {
      setInsertStatus("Replacing draft...", true);
      void insertSuggestedReply(reply, replyIndex, analysis, true);
    });
  container
    .querySelector<HTMLButtonElement>(".cancel-replace-button")
    ?.addEventListener("click", () => {
      container.innerHTML = "";
      setInsertStatus("Draft replacement canceled. Existing WhatsApp text was kept.", true);
    });
}

async function insertSuggestedReply(
  reply: SuggestedReply,
  replyIndex: number,
  analysis: AnalyzerResponse["analysis"],
  forceReplace = false
) {
  try {
    const tab = await queryActiveTab();

    if (!tab?.id || !isWhatsAppTab(tab)) {
      throw new Error("Open web.whatsapp.com and select a chat before inserting.");
    }

    if (hasGeneralChatWarning(analysis)) {
      const allowed = getElement<HTMLInputElement>(
        "#allow-general-insert"
      ).checked;

      if (!allowed) {
        throw new Error(
          "Insertion is disabled for general chats until you explicitly allow it."
        );
      }
    }

    const response = await sendInsertMessage(tab.id, reply.text, forceReplace);

    if (!response.ok) {
      if (response.reason === "draft_not_empty") {
        renderDraftConfirmation(reply, replyIndex, response, analysis);
        setInsertStatus(insertFailureMessage(response), false);
        return;
      }

      throw new Error(insertFailureMessage(response));
    }

    const confirmation = document.querySelector<HTMLElement>(
      `#draft-confirmation-${replyIndex}`
    );

    if (confirmation) {
      confirmation.innerHTML = "";
    }

    setInsertStatus(
      "Reply inserted into WhatsApp input. Review it before sending manually.",
      true
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not insert this reply.";
    setInsertStatus(message, false);
  }
}

function renderError(message: string) {
  getElement("#result").innerHTML = "";
  renderWarnings([message]);
}

function renderResult(result: AnalyzerResponse) {
  const analysis = result.analysis;
  const generalChat = hasGeneralChatWarning(analysis);
  const missingFields =
    analysis.order.missingFields.length > 0
      ? analysis.order.missingFields.join(", ")
      : "none";
  const memorySummary =
    analysis.customerMemoryUsed && analysis.customerMemorySummary
      ? `<div class="memory"><strong>Customer memory:</strong> ${escapeHtml(
          analysis.customerMemorySummary
        )}</div>`
      : "";

  getElement("#result").innerHTML = `
    <section class="panel">
      <div class="result-meta">
        <span>${escapeHtml(analysis.source)}</span>
        <span>${escapeHtml(analysis.intent)}</span>
      </div>
      <h2>Order Summary</h2>
      <p>${escapeHtml(analysis.order.summary)}</p>
      <p><strong>Missing:</strong> ${escapeHtml(missingFields)}</p>
      ${memorySummary}
    </section>
    <section class="panel">
      <h2>Suggested Replies</h2>
      <p class="safety-note">
        Insertion only fills the WhatsApp text box. You still review and send manually.
      </p>
      ${
        generalChat
          ? `<label class="checkbox-field general-insert-toggle">
              <input id="allow-general-insert" type="checkbox" />
              <span>Allow inserting general-chat replies</span>
            </label>`
          : ""
      }
      <div id="insert-status" class="insert-status"></div>
      <div class="reply-list">
        ${analysis.suggestedReplies
          .map(
            (reply, index) => `
              <article class="reply">
                <p>${escapeHtml(reply.text)}</p>
                <div class="reply-meta">${escapeHtml(reply.type)} · ${escapeHtml(
                  reply.reason
                )}</div>
                <div class="reply-actions">
                  <button class="secondary copy-button" data-reply-index="${index}">
                    Copy Reply
                  </button>
                  <button
                    class="secondary insert-button"
                    data-reply-index="${index}"
                    data-general-chat="${generalChat}"
                    ${generalChat ? "disabled" : ""}
                  >
                    Insert Reply
                  </button>
                </div>
                <div id="draft-confirmation-${index}"></div>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;

  document
    .querySelector<HTMLInputElement>("#allow-general-insert")
    ?.addEventListener("change", updateInsertButtonState);

  for (const button of document.querySelectorAll<HTMLButtonElement>(".copy-button")) {
    button.addEventListener("click", async () => {
      const index = Number(button.dataset.replyIndex);
      const reply = analysis.suggestedReplies[index];

      if (!reply) {
        return;
      }

      try {
        await navigator.clipboard.writeText(reply.text);
        button.textContent = "Copied";
        window.setTimeout(() => {
          button.textContent = "Copy Reply";
        }, 1200);
      } catch {
        renderWarnings([
          ...lastCaptureWarnings,
          ...analysis.warnings,
          "Could not copy reply to clipboard. Select and copy the text manually."
        ]);
      }
    });
  }

  for (const button of document.querySelectorAll<HTMLButtonElement>(".insert-button")) {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.replyIndex);
      const reply = analysis.suggestedReplies[index];

      if (!reply) {
        return;
      }

      void insertSuggestedReply(reply, index, analysis);
    });
  }

  updateInsertButtonState();
  renderWarnings([...lastCaptureWarnings, ...analysis.warnings]);
}

async function analyzeCurrentChat() {
  const analyzeButton = getElement<HTMLButtonElement>("#analyze-button");
  const businessSenderNames = parseBusinessSenderNames(
    getElement<HTMLInputElement>("#business-sender-names").value
  );
  const useAi = getElement<HTMLInputElement>("#use-ai").checked;

  getElement("#result").innerHTML = "";
  renderCapturePreview(null);
  renderWarnings([]);
  setText("#activity", "Capturing visible WhatsApp chat...");
  analyzeButton.disabled = true;

  try {
    if (!activeTab?.id || !isWhatsAppTab(activeTab)) {
      throw new Error("Open web.whatsapp.com and select a chat before analyzing.");
    }

    const capture = await sendCaptureMessage(activeTab.id, businessSenderNames);

    if (!capture.ok) {
      throw new Error(capture.error);
    }

    lastCaptureWarnings = capture.warnings;
    renderCapturePreview(capture);
    setText(
      "#activity",
      `Captured ${capture.messageCount} visible message(s) from ${capture.chatName}. Analyzing...`
    );

    const response = await fetch(`${apiBaseUrl}/api/chat/analyze-manual`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chatName: capture.chatName || "WhatsApp Chat",
        businessSenderNames,
        rawText: capture.rawText,
        useAi
      })
    });

    if (!response.ok) {
      throw new Error(`Analyzer request failed with status ${response.status}.`);
    }

    const result = (await response.json()) as AnalyzerResponse;
    setText(
      "#activity",
      "Analysis complete. Copy a suggested reply or insert it for manual review."
    );
    renderResult(result);
  } catch (error) {
    lastCaptureWarnings = [];
    const message =
      error instanceof Error ? error.message : "Could not analyze this chat.";
    setText("#activity", "Analysis failed.");
    renderError(message);
  } finally {
    updateAnalyzeButton();
  }
}

function renderApp() {
  const app = getElement<HTMLDivElement>("#app");

  app.innerHTML = `
    <main class="popup">
      <div>
        <span class="badge">Milestone 8B</span>
        <h1 class="title">Food Order Copilot</h1>
      </div>

      <section class="status-grid">
        <div id="api-status" class="status-pill">Checking API...</div>
        <div id="page-status" class="status-pill">Checking page...</div>
      </section>

      <label class="field">
        <span>Business sender names</span>
        <input id="business-sender-names" value="${escapeHtml(defaultBusinessSenderNames)}" />
      </label>

      <label class="checkbox-field">
        <input id="use-ai" type="checkbox" checked />
        <span>Use AI assistance</span>
      </label>

      <button id="analyze-button" disabled>Analyze Current Chat</button>
      <p id="activity" class="activity">Open a WhatsApp chat, then analyze visible messages.</p>

      <div id="capture-preview"></div>
      <div id="warnings"></div>
      <div id="result"></div>
    </main>
  `;

  getElement<HTMLButtonElement>("#analyze-button").addEventListener(
    "click",
    () => {
      void analyzeCurrentChat();
    }
  );
}

renderApp();
void checkApiHealth();
void checkCurrentPage();
