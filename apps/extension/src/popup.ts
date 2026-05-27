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

type PopupFingerprintSuccess = {
  ok: true;
  chatName: string;
  messageCount: number;
  adapterVersion: string;
  firstLines: string[];
  lastLines: string[];
  fingerprint: string;
  warnings: string[];
};

type PopupFingerprintFailure = {
  ok: false;
  error: string;
  adapterVersion: string;
};

type PopupFingerprintResponse =
  | PopupFingerprintSuccess
  | PopupFingerprintFailure;

type AnalysisSession = {
  sessionId: string;
  analyzedAt: string;
  tabId: number;
  tabUrl: string;
  chatName: string;
  messageCount: number;
  adapterVersion: string;
  firstCapturedLines: string[];
  lastCapturedLines: string[];
  fingerprint: string;
  warningFlags: string[];
};

type CapturedPreview = {
  chatName: string;
  messageCount: number;
  adapterVersion: string;
  firstLines: string[];
  lastLines: string[];
  fingerprint: string;
  warnings: string[];
};

type SessionStatus =
  | {
      state: "unknown";
      message: string;
    }
  | {
      state: "current";
      message: string;
    }
  | {
      state: "stale";
      message: string;
    }
  | {
      state: "different";
      message: string;
    }
  | {
      state: "error";
      message: string;
    };

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

type StoredAnalysisSnapshot = {
  analysisSession: AnalysisSession;
  analysisResult: AnalyzerResponse;
  capturedPreview: CapturedPreview;
  businessSenderNames: string[];
  useAi: boolean;
  savedAt: string;
};

const apiBaseUrl = "http://localhost:4000";
const defaultBusinessSenderNames = "My Business, Business, You";
const lastAnalysisStorageKey = "wfo-last-analysis";

let activeTab: WfoChromeTab | null = null;
let apiConnected = false;
let lastCaptureWarnings: string[] = [];
let analysisSession: AnalysisSession | null = null;
let sessionStatus: SessionStatus = {
  state: "unknown",
  message: "Analyze the current chat before inserting."
};

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

function normalizeSessionLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function fingerprintSessionLine(value: string) {
  return normalizeSessionLine(value)
    .replace(
      /^\[?\d{1,2}\/\d{1,2}\/\d{2,4},\s*\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?\]?\s*-\s*/i,
      ""
    )
    .toLocaleLowerCase();
}

function captureLines(rawText: string) {
  return rawText
    .split("\n")
    .map(normalizeSessionLine)
    .filter(Boolean);
}

function buildSessionFingerprint(
  chatName: string,
  messageCount: number,
  lastLines: string[]
) {
  return [chatName, String(messageCount), ...lastLines]
    .map((part, index) =>
      index < 2 ? normalizeSessionLine(part).toLocaleLowerCase() : fingerprintSessionLine(part)
    )
    .join("::");
}

function sameLines(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every(
      (line, index) =>
        fingerprintSessionLine(line) === fingerprintSessionLine(right[index] ?? "")
    )
  );
}

function createSessionId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createAnalysisSession(
  capture: PopupCaptureSuccess,
  tab: WfoChromeTab
): AnalysisSession {
  const lines = captureLines(capture.rawText);
  const firstCapturedLines = lines.slice(0, 2);
  const lastCapturedLines = lines.slice(-2);

  return {
    sessionId: createSessionId(),
    analyzedAt: new Date().toISOString(),
    tabId: tab.id ?? 0,
    tabUrl: tab.url ?? "",
    chatName: capture.chatName,
    messageCount: capture.messageCount,
    adapterVersion: capture.adapterVersion,
    firstCapturedLines,
    lastCapturedLines,
    fingerprint: buildSessionFingerprint(
      capture.chatName,
      capture.messageCount,
      lastCapturedLines
    ),
    warningFlags: capture.warnings
  };
}

function formatSessionTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function previewText(value: string, maxLength = 90) {
  const cleaned = normalizeSessionLine(value);
  return cleaned.length > maxLength
    ? `${cleaned.slice(0, maxLength)}...`
    : cleaned;
}

function recordExtensionAction(
  action: string,
  details: {
    chatName?: string;
    preview?: string;
  } = {}
) {
  try {
    const key = "wfo-extension-action-history";
    const existing = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown[];
    const next = [
      {
        action,
        at: new Date().toISOString(),
        chatName: details.chatName ?? analysisSession?.chatName ?? null,
        preview: details.preview ? previewText(details.preview, 100) : null
      },
      ...existing
    ].slice(0, 10);

    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Local action history is best-effort only.
  }
}

function createCapturedPreview(capture: PopupCaptureSuccess): CapturedPreview {
  const lines = captureLines(capture.rawText);
  const lastFingerprintLines = lines.slice(-2);

  return {
    chatName: capture.chatName,
    messageCount: capture.messageCount,
    adapterVersion: capture.adapterVersion,
    firstLines: lines.slice(0, 2),
    lastLines: lines.slice(-3),
    fingerprint: buildSessionFingerprint(
      capture.chatName,
      capture.messageCount,
      lastFingerprintLines
    ),
    warnings: capture.warnings
  };
}

function compactAnalyzerResult(result: AnalyzerResponse): AnalyzerResponse {
  const analysis = result.analysis;

  return {
    analysis: {
      source: analysis.source,
      customerSummary: analysis.customerSummary ?? null,
      customerMemoryUsed: analysis.customerMemoryUsed ?? false,
      customerMemorySummary: analysis.customerMemorySummary ?? null,
      intent: analysis.intent,
      orderLikely: analysis.orderLikely,
      order: {
        summary: analysis.order.summary,
        missingFields: analysis.order.missingFields.slice(0, 12)
      },
      suggestedReplies: analysis.suggestedReplies.slice(0, 3).map((reply) => ({
        text: reply.text,
        type: reply.type,
        reason: reply.reason
      })),
      warnings: analysis.warnings.slice(0, 12)
    }
  };
}

function createStoredAnalysisSnapshot(
  session: AnalysisSession,
  result: AnalyzerResponse,
  preview: CapturedPreview,
  businessSenderNames: string[],
  useAi: boolean
): StoredAnalysisSnapshot {
  return {
    analysisSession: session,
    analysisResult: compactAnalyzerResult(result),
    capturedPreview: preview,
    businessSenderNames,
    useAi,
    savedAt: new Date().toISOString()
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStoredAnalysisSnapshot(value: unknown): value is StoredAnalysisSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  const session = value.analysisSession;
  const result = value.analysisResult;
  const preview = value.capturedPreview;

  return (
    isRecord(session) &&
    isRecord(result) &&
    isRecord((result as { analysis?: unknown }).analysis) &&
    isRecord(preview) &&
    typeof session.chatName === "string" &&
    typeof session.fingerprint === "string" &&
    typeof preview.chatName === "string"
  );
}

function storageArea(name: "session" | "local") {
  return chrome.storage?.[name] ?? null;
}

function readStorage(
  area: WfoChromeStorageArea,
  key: string
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    area.get(key, (items) => {
      const error = chrome.runtime.lastError;

      if (error?.message) {
        reject(new Error(error.message));
        return;
      }

      resolve(items[key]);
    });
  });
}

function writeStorage(
  area: WfoChromeStorageArea,
  key: string,
  value: unknown
): Promise<void> {
  return new Promise((resolve, reject) => {
    area.set({ [key]: value }, () => {
      const error = chrome.runtime.lastError;

      if (error?.message) {
        reject(new Error(error.message));
        return;
      }

      resolve();
    });
  });
}

function removeStorage(
  area: WfoChromeStorageArea,
  key: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    area.remove(key, () => {
      const error = chrome.runtime.lastError;

      if (error?.message) {
        reject(new Error(error.message));
        return;
      }

      resolve();
    });
  });
}

async function loadSavedAnalysisSnapshot() {
  const sessionArea = storageArea("session");
  const localArea = storageArea("local");

  if (sessionArea) {
    const value = await readStorage(sessionArea, lastAnalysisStorageKey).catch(
      () => null
    );

    if (isStoredAnalysisSnapshot(value)) {
      return value;
    }
  }

  if (localArea) {
    const value = await readStorage(localArea, lastAnalysisStorageKey).catch(
      () => null
    );

    if (isStoredAnalysisSnapshot(value)) {
      return value;
    }
  }

  return null;
}

async function saveAnalysisSnapshot(snapshot: StoredAnalysisSnapshot) {
  const sessionArea = storageArea("session");
  const localArea = storageArea("local");

  if (sessionArea) {
    try {
      await writeStorage(sessionArea, lastAnalysisStorageKey, snapshot);

      if (localArea) {
        await removeStorage(localArea, lastAnalysisStorageKey).catch(
          () => undefined
        );
      }

      return;
    } catch {
      // Fall back to local storage if session storage is not usable.
    }
  }

  if (localArea) {
    await writeStorage(localArea, lastAnalysisStorageKey, snapshot);
  }
}

async function clearSavedAnalysisSnapshot() {
  const removals = [storageArea("session"), storageArea("local")]
    .filter((area): area is WfoChromeStorageArea => Boolean(area))
    .map((area) => removeStorage(area, lastAnalysisStorageKey).catch(() => undefined));

  await Promise.all(removals);
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

function sendFingerprintMessage(tabId: number, businessSenderNames: string[]) {
  return new Promise<PopupFingerprintResponse>((resolve, reject) => {
    chrome.tabs.sendMessage(
      tabId,
      {
        type: "GET_CURRENT_WHATSAPP_CHAT_FINGERPRINT",
        businessSenderNames
      },
      (response) => {
        const error = chrome.runtime.lastError;

        if (error?.message) {
          reject(new Error(error.message));
          return;
        }

        resolve(response as PopupFingerprintResponse);
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

function sessionAllowsInsert() {
  return Boolean(analysisSession && sessionStatus.state === "current");
}

function sessionStatusClass() {
  return sessionStatus.state === "current" ? "status-ok" : "status-error";
}

function renderAnalysisSession() {
  const container = document.querySelector<HTMLElement>("#session-panel");

  if (!container) {
    return;
  }

  if (!analysisSession) {
    container.innerHTML = "";
    updateInsertButtonState();
    return;
  }

  const lastLine = analysisSession.lastCapturedLines.at(-1) ?? "none";

  container.innerHTML = `
    <section class="panel session-panel">
      <h2>Last Analysis</h2>
      <dl class="preview-meta">
        <div><dt>Chat</dt><dd>${escapeHtml(analysisSession.chatName)}</dd></div>
        <div><dt>Analyzed</dt><dd>${escapeHtml(
          formatSessionTime(analysisSession.analyzedAt)
        )}</dd></div>
        <div><dt>Messages</dt><dd>${analysisSession.messageCount}</dd></div>
        <div><dt>Adapter</dt><dd>${escapeHtml(
          analysisSession.adapterVersion
        )}</dd></div>
        <div><dt>Status</dt><dd><span class="session-status ${sessionStatusClass()}">${escapeHtml(
          sessionStatus.message
        )}</span></dd></div>
      </dl>
      <p class="session-last-line"><strong>Last captured:</strong> ${escapeHtml(
        previewText(lastLine)
      )}</p>
      <div class="session-actions">
        <button id="recheck-session-button" class="secondary" type="button">
          Re-check current chat
        </button>
        <button id="reanalyze-session-button" class="secondary" type="button">
          Re-analyze current chat
        </button>
        <button id="clear-session-button" class="secondary" type="button">
          Clear saved analysis
        </button>
      </div>
    </section>
  `;

  container
    .querySelector<HTMLButtonElement>("#recheck-session-button")
    ?.addEventListener("click", () => {
      void recheckSessionStatus();
    });
  container
    .querySelector<HTMLButtonElement>("#reanalyze-session-button")
    ?.addEventListener("click", () => {
      void analyzeCurrentChat();
    });
  container
    .querySelector<HTMLButtonElement>("#clear-session-button")
    ?.addEventListener("click", () => {
      void clearSavedAnalysis();
    });

  updateInsertButtonState();
}

function setSessionStatus(status: SessionStatus) {
  sessionStatus = status;
  renderAnalysisSession();
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

function renderCapturePreview(preview: CapturedPreview | null) {
  const container = getElement("#capture-preview");

  if (!preview) {
    container.innerHTML = "";
    return;
  }

  const previewLines =
    preview.messageCount <= preview.lastLines.length
      ? preview.lastLines
      : preview.messageCount <= 5
        ? [
            ...preview.firstLines,
            ...preview.lastLines.filter(
              (line) => !preview.firstLines.includes(line)
            )
          ]
        : [...preview.firstLines, "...", ...preview.lastLines];

  container.innerHTML = `
    <section class="panel preview-panel">
      <h2>Captured Chat Preview</h2>
      <dl class="preview-meta">
        <div><dt>Chat</dt><dd>${escapeHtml(preview.chatName)}</dd></div>
        <div><dt>Messages</dt><dd>${preview.messageCount}</dd></div>
        <div><dt>Adapter</dt><dd>${escapeHtml(preview.adapterVersion)}</dd></div>
      </dl>
      <pre>${previewLines.map(escapeHtml).join("\n")}</pre>
      ${
        preview.warnings.length > 0
          ? `<ul class="preview-warnings">${preview.warnings
              .map((warning) => `<li>${escapeHtml(warning)}</li>`)
              .join("")}</ul>`
          : ""
      }
    </section>
  `;
}

async function clearSavedAnalysis() {
  await clearSavedAnalysisSnapshot();
  analysisSession = null;
  sessionStatus = {
    state: "unknown",
    message: "Analyze the current chat before inserting."
  };
  lastCaptureWarnings = [];
  renderCapturePreview(null);
  renderAnalysisSession();
  renderWarnings([]);
  getElement("#result").innerHTML = "";
  setText("#activity", "Saved analysis cleared. Analyze the current chat before inserting.");
}

async function restoreSavedAnalysis() {
  const snapshot = await loadSavedAnalysisSnapshot();

  if (!snapshot) {
    return;
  }

  analysisSession = snapshot.analysisSession;
  lastCaptureWarnings =
    snapshot.capturedPreview.warnings ?? snapshot.analysisSession.warningFlags;
  sessionStatus = {
    state: "unknown",
    message: "Checking current chat..."
  };

  const senderInput =
    document.querySelector<HTMLInputElement>("#business-sender-names");
  const useAiInput = document.querySelector<HTMLInputElement>("#use-ai");

  if (senderInput && snapshot.businessSenderNames.length > 0) {
    senderInput.value = snapshot.businessSenderNames.join(", ");
  }

  if (useAiInput) {
    useAiInput.checked = snapshot.useAi;
  }

  renderCapturePreview(snapshot.capturedPreview);
  renderAnalysisSession();
  renderResult(snapshot.analysisResult);
  setText(
    "#activity",
    `Restored last analysis for ${snapshot.analysisSession.chatName}.`
  );

  await recheckSessionStatus();
}

function compareFingerprint(
  session: AnalysisSession,
  current: PopupFingerprintSuccess
): SessionStatus {
  if (current.chatName !== session.chatName) {
    return {
      state: "different",
      message: "Different chat - re-analyze required."
    };
  }

  if (current.adapterVersion !== session.adapterVersion) {
    return {
      state: "stale",
      message: "Adapter changed - re-analyze required."
    };
  }

  if (current.messageCount !== session.messageCount) {
    return {
      state: "stale",
      message: "Visible messages changed - re-analyze required."
    };
  }

  if (current.fingerprint !== session.fingerprint) {
    return {
      state: "stale",
      message: "Chat fingerprint changed - re-analyze required."
    };
  }

  if (
    !sameLines(current.firstLines, session.firstCapturedLines) ||
    !sameLines(current.lastLines, session.lastCapturedLines)
  ) {
    return {
      state: "stale",
      message: "Visible chat preview changed - re-analyze required."
    };
  }

  return {
    state: "current",
    message: "Current"
  };
}

async function getCurrentFingerprintForSession() {
  const session = analysisSession;

  if (!session) {
    throw new Error("Analyze the current chat before inserting.");
  }

  const tab = await queryActiveTab();

  if (!tab?.id || !isWhatsAppTab(tab)) {
    throw new Error("Open web.whatsapp.com and select the analyzed chat before inserting.");
  }

  if (tab.id !== session.tabId || tab.url !== session.tabUrl) {
    throw new Error("This result belongs to a different tab or page. Re-analyze before inserting.");
  }

  const businessSenderNames = parseBusinessSenderNames(
    getElement<HTMLInputElement>("#business-sender-names").value
  );
  const current = await sendFingerprintMessage(tab.id, businessSenderNames);

  if (!current.ok) {
    throw new Error(current.error);
  }

  return current;
}

async function recheckSessionStatus() {
  if (!analysisSession) {
    setSessionStatus({
      state: "unknown",
      message: "Analyze the current chat before inserting."
    });
    return;
  }

  try {
    const current = await getCurrentFingerprintForSession();
    const nextStatus = compareFingerprint(analysisSession, current);
    setSessionStatus(nextStatus);

    if (nextStatus.state !== "current") {
      recordExtensionAction("blocked stale insert", {
        preview: nextStatus.message
      });
      setInsertStatus(
        "This result belongs to a different or changed chat. Re-analyze before inserting.",
        false
      );
    } else {
      setInsertStatus("Analysis session matches the current visible chat.", true);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not check the current chat.";
    setSessionStatus({
      state: "error",
      message
    });
    setInsertStatus(message, false);
  }
}

async function assertCurrentAnalysisSession() {
  if (!analysisSession) {
    throw new Error("Analyze the current chat before inserting.");
  }

  const current = await getCurrentFingerprintForSession();
  const nextStatus = compareFingerprint(analysisSession, current);
  setSessionStatus(nextStatus);

  if (nextStatus.state !== "current") {
    recordExtensionAction("blocked stale insert", {
      preview: nextStatus.message
    });
    throw new Error(
      "This result belongs to a different or changed chat. Re-analyze before inserting."
    );
  }
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
      !sessionAllowsInsert() ||
      (button.dataset.generalChat === "true" && !allowGeneralInsert);
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

    await assertCurrentAnalysisSession();

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
    recordExtensionAction(forceReplace ? "replaced draft" : "inserted reply", {
      preview: reply.text
    });
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
        recordExtensionAction("copied reply", {
          preview: reply.text
        });
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
  analysisSession = null;
  sessionStatus = {
    state: "unknown",
    message: "Analyze the current chat before inserting."
  };
  renderAnalysisSession();
  renderCapturePreview(null);
  renderWarnings([]);
  setText("#activity", "Capturing visible WhatsApp chat...");
  analyzeButton.disabled = true;

  try {
    const tab = await queryActiveTab();
    activeTab = tab;

    if (!tab?.id || !isWhatsAppTab(tab)) {
      throw new Error("Open web.whatsapp.com and select a chat before analyzing.");
    }

    const capture = await sendCaptureMessage(tab.id, businessSenderNames);

    if (!capture.ok) {
      throw new Error(capture.error);
    }

    const capturedPreview = createCapturedPreview(capture);
    lastCaptureWarnings = capturedPreview.warnings;
    renderCapturePreview(capturedPreview);
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

    const result = compactAnalyzerResult((await response.json()) as AnalyzerResponse);
    analysisSession = createAnalysisSession(capture, tab);
    sessionStatus = {
      state: "current",
      message: "Current"
    };
    await saveAnalysisSnapshot(
      createStoredAnalysisSnapshot(
        analysisSession,
        result,
        capturedPreview,
        businessSenderNames,
        useAi
      )
    ).catch((error) => {
      console.warn(
        "[WFO Copilot] Could not save last analysis snapshot.",
        error instanceof Error ? error.message : error
      );
    });
    recordExtensionAction("analyzed chat", {
      chatName: capture.chatName,
      preview: analysisSession.lastCapturedLines.at(-1) ?? ""
    });
    setText(
      "#activity",
      "Analysis complete. Copy a suggested reply or insert it for manual review."
    );
    renderAnalysisSession();
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
        <span class="badge">Milestone 8C.1</span>
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
      <div id="session-panel"></div>
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

async function initializePopup() {
  renderApp();
  renderAnalysisSession();
  await Promise.all([checkApiHealth(), checkCurrentPage()]);
  await restoreSavedAnalysis();
}

void initializePopup();
