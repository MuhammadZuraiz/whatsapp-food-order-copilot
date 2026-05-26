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

function renderError(message: string) {
  getElement("#result").innerHTML = "";
  renderWarnings([message]);
}

function renderResult(result: AnalyzerResponse) {
  const analysis = result.analysis;
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
      <div class="reply-list">
        ${analysis.suggestedReplies
          .map(
            (reply, index) => `
              <article class="reply">
                <p>${escapeHtml(reply.text)}</p>
                <div class="reply-meta">${escapeHtml(reply.type)} · ${escapeHtml(
                  reply.reason
                )}</div>
                <button class="secondary copy-button" data-reply-index="${index}">
                  Copy Reply
                </button>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;

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
    setText("#activity", "Analysis complete. Copy a suggested reply manually.");
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
        <span class="badge">Milestone 8A</span>
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
