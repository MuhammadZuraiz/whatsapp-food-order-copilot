/**
 * WhatsApp Composer Adapter
 * Version: 2026-05-compose-v1
 *
 * SAFETY CONTRACT:
 *  - This adapter ONLY fills the compose box.
 *  - It does NOT press Enter, click Send, submit forms, or auto-send anything.
 *  - execCommand is used only for insertText fallback paths. It never sends, submits, presses Enter, or clicks Send.
 *  - Replacement uses a synthetic ClipboardEvent (paste) that goes through
 *    React's own event handler so React updates its internal state correctly.
 */

type ComposerInsertReason =
  | "draft_not_empty"
  | "composer_not_found"
  | "duplicate_insert_detected"
  | "insert_failed"
  | "not_whatsapp"
  | "selection_failed"
  | "clear_failed";

type ComposerInsertDebug = {
  composerAdapterVersion: string;
  matchedSelector?: string;
  strategy?: string;
  strategiesTried?: string[];
  originalDraftPreview?: string;
  beforeDraftPreview?: string;
  finalDraftPreview?: string;
  afterDraftPreview?: string;
  currentDraftPreview?: string;
  selectionInsideComposer?: boolean;
  insertCommandResult?: boolean;
  clearSucceeded?: boolean;
  insertSucceeded?: boolean;
  restoredOriginal?: boolean;
  clearedAfterFailure?: boolean;
  composerTagName?: string;
  composerRole?: string;
  composerContentEditable?: string;
  composerDataTab?: string;
  composerAriaLabel?: string;
  composerChildCount?: number;
  activeElementSummary?: string;
};

type ComposerInsertSuccess = ComposerInsertDebug & {
  ok: true;
  insertedLength: number;
};

type ComposerInsertFailure = ComposerInsertDebug & {
  ok: false;
  error: string;
  reason?: ComposerInsertReason;
  insertedLength?: number;
};

type ComposerInsertResult = ComposerInsertSuccess | ComposerInsertFailure;

type ComposerTarget = {
  element: HTMLElement;
  matchedSelector: string;
};

type ComposerGlobal = typeof globalThis & {
  WfoWhatsAppComposerAdapter?: {
    insertReply: (text: string, forceReplace?: boolean) => Promise<ComposerInsertResult>;
    version: string;
  };
};

// ─── Constants ───────────────────────────────────────────────────────────────

const WHATSAPP_COMPOSER_ADAPTER_VERSION = "2026-05-compose-v1";
const COMPOSER_NOT_FOUND_MESSAGE =
  "WhatsApp composer not found. Open a chat and try again.";

/**
 * Selectors tried in priority order.
 * All selectors are centralised here — do not scatter them elsewhere.
 */
const composerSelectors = [
  "footer [contenteditable='true'][role='textbox']",
  "footer [contenteditable='true'][data-tab]",
  "footer [aria-label='Type a message'][contenteditable='true']",
  "footer [aria-label='Message'][contenteditable='true']",
  "#main footer [contenteditable='true'][role='textbox']",
  "#main footer div[contenteditable='true']"
];

// ─── Utility helpers ──────────────────────────────────────────────────────────

function isComposerWhatsAppWeb() {
  return window.location.hostname === "web.whatsapp.com";
}

function normalizeComposerText(value: string | null | undefined) {
  return (value ?? "")
    .replace(/\u200e|\u200f/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function draftPreview(value: string) {
  return value.length > 120 ? `${value.slice(0, 120)}...` : value;
}

function summarizeElement(element: Element | null) {
  if (!element) return "none";
  const el = element as HTMLElement;
  const parts = [element.tagName.toLowerCase()];
  const role = el.getAttribute("role");
  const editable = el.getAttribute("contenteditable");
  const dataTab = el.getAttribute("data-tab");
  const ariaLabel = el.getAttribute("aria-label");
  if (role) parts.push(`role=${role}`);
  if (editable) parts.push(`contenteditable=${editable}`);
  if (dataTab) parts.push(`data-tab=${dataTab}`);
  if (ariaLabel) parts.push(`aria-label=${ariaLabel}`);
  return parts.join(" ");
}

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function waitFrame() {
  return new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}

async function waitForComposerSettle() {
  await waitFrame();
  await wait(180);
}

// ─── Composer discovery ───────────────────────────────────────────────────────

function findComposer(): ComposerTarget | null {
  for (const selector of composerSelectors) {
    for (const element of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
      const visible =
        element.offsetParent !== null || element.getClientRects().length > 0;
      if (element.isContentEditable && visible) {
        return { element, matchedSelector: selector };
      }
    }
  }
  return null;
}

function readComposerText(composer: HTMLElement) {
  return normalizeComposerText(composer.innerText || composer.textContent);
}

// ─── Focus & selection helpers ────────────────────────────────────────────────

function focusComposer(composer: HTMLElement) {
  try {
    composer.focus({ preventScroll: true });
  } catch {
    composer.focus();
  }
}

function nodeInsideComposer(composer: HTMLElement, node: Node | null) {
  return Boolean(node && (node === composer || composer.contains(node)));
}

function isSelectionInsideComposer(composer: HTMLElement) {
  const sel = window.getSelection();
  return Boolean(
    sel?.rangeCount &&
      nodeInsideComposer(composer, sel.anchorNode) &&
      nodeInsideComposer(composer, sel.focusNode)
  );
}

function selectComposerContents(composer: HTMLElement): boolean {
  focusComposer(composer);
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(composer);
  sel?.removeAllRanges();
  sel?.addRange(range);
  return isSelectionInsideComposer(composer);
}

function placeCursorAtEnd(composer: HTMLElement) {
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(composer);
  range.collapse(false);
  sel?.removeAllRanges();
  sel?.addRange(range);
}

// ─── Event dispatch helpers ───────────────────────────────────────────────────

function dispatchInputEvent(
  composer: HTMLElement,
  inputType: string,
  data: string | null
) {
  try {
    composer.dispatchEvent(
      new InputEvent("input", { bubbles: true, cancelable: false, data, inputType })
    );
  } catch {
    composer.dispatchEvent(new Event("input", { bubbles: true }));
  }
  composer.dispatchEvent(new Event("change", { bubbles: true }));
}

// ─── Duplicate / safety checks ────────────────────────────────────────────────

function isUnsafeFinalText(
  readBack: string,
  originalDraft: string,
  insertedText: string
) {
  const nb = normalizeComposerText(readBack);
  const ni = normalizeComposerText(insertedText);
  const no = normalizeComposerText(originalDraft);

  // Duplicated insertions
  if (ni && nb !== ni && nb.startsWith(ni)) {
    let rem = nb;
    let count = 0;
    while (rem.startsWith(ni)) {
      count++;
      rem = rem.slice(ni.length).trimStart();
    }
    if (count > 1 && rem.length === 0) return true;
  }

  // Contains both original and inserted (append scenario)
  if (no && ni && nb !== no && nb !== ni && nb.includes(no) && nb.includes(ni)) {
    return true;
  }

  return false;
}

// ─── Debug builder ────────────────────────────────────────────────────────────

function makeDebug(
  target: ComposerTarget,
  values: {
    originalDraft: string;
    finalDraft?: string;
    afterDraft: string;
    strategy?: string;
    strategiesTried?: string[];
    selectionInsideComposer?: boolean;
    insertCommandResult?: boolean;
    clearSucceeded?: boolean;
    insertSucceeded?: boolean;
    restoredOriginal?: boolean;
    clearedAfterFailure?: boolean;
  }
): ComposerInsertDebug {
  const composer = target.element;
  const selInComposer =
    values.selectionInsideComposer ?? isSelectionInsideComposer(composer);

  return {
    composerAdapterVersion: WHATSAPP_COMPOSER_ADAPTER_VERSION,
    matchedSelector: target.matchedSelector,
    strategy: values.strategy,
    strategiesTried: values.strategiesTried,
    originalDraftPreview: draftPreview(values.originalDraft),
    beforeDraftPreview: draftPreview(values.originalDraft),
    finalDraftPreview:
      values.finalDraft !== undefined ? draftPreview(values.finalDraft) : undefined,
    afterDraftPreview: draftPreview(values.afterDraft),
    currentDraftPreview: draftPreview(values.afterDraft),
    selectionInsideComposer: selInComposer,
    insertCommandResult: values.insertCommandResult,
    clearSucceeded: values.clearSucceeded,
    insertSucceeded: values.insertSucceeded,
    restoredOriginal: values.restoredOriginal,
    clearedAfterFailure: values.clearedAfterFailure,
    composerTagName: composer.tagName.toLowerCase(),
    composerRole: composer.getAttribute("role") ?? "",
    composerContentEditable: composer.getAttribute("contenteditable") ?? "",
    composerDataTab: composer.getAttribute("data-tab") ?? "",
    composerAriaLabel: composer.getAttribute("aria-label") ?? "",
    composerChildCount: composer.childNodes.length,
    activeElementSummary: summarizeElement(document.activeElement)
  };
}

// ─── Insert into empty composer (known to work) ───────────────────────────────
/**
 * This path works because React's internal state is already empty,
 * so it accepts the forward change via the input event.
 */
async function insertIntoEmptyComposer(
  composer: HTMLElement,
  text: string,
  originalDraft = ""
): Promise<{ ok: boolean; afterDraft: string; duplicateDetected: boolean }> {
  if (readComposerText(composer)) {
    return { ok: false, afterDraft: readComposerText(composer), duplicateDetected: false };
  }

  focusComposer(composer);
  composer.textContent = text;
  placeCursorAtEnd(composer);
  dispatchInputEvent(composer, "insertText", text);
  focusComposer(composer);

  await waitForComposerSettle();

  const afterDraft = readComposerText(composer);
  const duplicateDetected = isUnsafeFinalText(afterDraft, originalDraft, text);

  return {
    ok: afterDraft === normalizeComposerText(text) && !duplicateDetected,
    afterDraft,
    duplicateDetected
  };
}

// ─── Paste-event replacement ──────────────────────────────────────────────────
/**
 * WHY THIS WORKS (and execCommand/textContent do not):
 *
 * WhatsApp Web is a React application. Its compose box is a controlled
 * contenteditable. When external code mutates the DOM directly (textContent =)
 * or via execCommand, React detects the mismatch between its virtual DOM
 * (which still holds the old text) and the real DOM, and re-renders back to
 * the old text within milliseconds.
 *
 * A synthetic ClipboardEvent("paste") bypasses this by travelling through
 * React's own synthetic event system. WhatsApp's onPaste handler reads
 * clipboardData.getData("text/plain") and calls its own state setter with the
 * new value, so React's internal state is updated correctly and no revert
 * happens.
 *
 * The selection established by selectComposerContents() tells the paste
 * handler that the selected text should be replaced — exactly the behaviour
 * we need for "Replace Draft".
 */
async function pasteEventReplace(
  composer: HTMLElement,
  text: string
): Promise<{ ok: boolean; afterDraft: string; commandResult: boolean }> {
  focusComposer(composer);

  // Select all existing text so that paste replaces it
  const selectionOk = selectComposerContents(composer);
  if (!selectionOk) {
    return { ok: false, afterDraft: readComposerText(composer), commandResult: false };
  }

  // Give the selection a frame to settle before firing the paste event
  await waitFrame();

  // Build a DataTransfer with the reply text
  let dt: DataTransfer | null = null;
  try {
    dt = new DataTransfer();
    dt.setData("text/plain", text);
  } catch {
    // DataTransfer constructor not available (rare in content scripts)
    dt = null;
  }

  if (!dt) {
    return { ok: false, afterDraft: readComposerText(composer), commandResult: false };
  }

  const pasteEvent = new ClipboardEvent("paste", {
    bubbles: true,
    cancelable: true,
    clipboardData: dt
  });

  composer.dispatchEvent(pasteEvent);

  // Wait for React to process the paste and re-render
  await waitForComposerSettle();

  const afterDraft = readComposerText(composer);
  return {
    ok: afterDraft === normalizeComposerText(text),
    afterDraft,
    commandResult: true
  };
}

// ─── Restore original draft after failed replacement ──────────────────────────
/**
 * After a failed replacement attempt, try to paste the original text back.
 * This goes through the same React-compatible paste path.
 */
async function restoreOriginalDraft(
  composer: HTMLElement,
  originalDraft: string
): Promise<{ restoredOriginal: boolean; clearedAfterFailure: boolean; afterDraft: string }> {
  const current = readComposerText(composer);

  // Already correct
  if (current === normalizeComposerText(originalDraft)) {
    return {
      restoredOriginal: Boolean(originalDraft),
      clearedAfterFailure: false,
      afterDraft: current
    };
  }

  if (!originalDraft) {
    // Just clear with paste of empty string if needed
    const result = await pasteEventReplace(composer, "");
    return {
      restoredOriginal: false,
      clearedAfterFailure: !result.afterDraft,
      afterDraft: result.afterDraft
    };
  }

  const result = await pasteEventReplace(composer, originalDraft);
  return {
    restoredOriginal: result.ok,
    clearedAfterFailure: false,
    afterDraft: result.afterDraft
  };
}

// ─── Main replacement orchestrator ────────────────────────────────────────────

async function replaceDraftWithReply(
  target: ComposerTarget,
  text: string,
  originalDraft: string
): Promise<{
  ok: boolean;
  reason?: ComposerInsertReason;
  strategy: string;
  strategiesTried: string[];
  finalDraft: string;
  afterDraft: string;
  selectionInsideComposer: boolean;
  insertCommandResult: boolean;
  clearSucceeded: boolean;
  insertSucceeded: boolean;
  restoredOriginal: boolean;
  clearedAfterFailure: boolean;
}> {
  const composer = target.element;
  const strategiesTried: string[] = [];

  // ── Strategy 1: paste event over selection ──────────────────────────────
  strategiesTried.push("pasteEventOverSelection");

  const pasteResult = await pasteEventReplace(composer, text);

  if (pasteResult.ok && !isUnsafeFinalText(pasteResult.afterDraft, originalDraft, text)) {
    return {
      ok: true,
      strategy: "pasteEventOverSelection",
      strategiesTried,
      finalDraft: pasteResult.afterDraft,
      afterDraft: pasteResult.afterDraft,
      selectionInsideComposer: true,
      insertCommandResult: true,
      clearSucceeded: true,
      insertSucceeded: true,
      restoredOriginal: false,
      clearedAfterFailure: false
    };
  }

  // Paste didn't change the text — try fallback
  // ── Strategy 2: atomic execCommand insertText over selection ─────────────
  strategiesTried.push("atomicSelectionInsertText");

  focusComposer(composer);
  const selectionOk = selectComposerContents(composer);
  await waitFrame();

  // Call execCommand WITHOUT re-focusing in between (focus collapses the selection)
  const cmdResult = document.execCommand("insertText", false, text);
  dispatchInputEvent(composer, "insertText", text);

  await waitForComposerSettle();

  const afterCmd = readComposerText(composer);
  const cmdInsertSucceeded =
    afterCmd === normalizeComposerText(text) &&
    !isUnsafeFinalText(afterCmd, originalDraft, text);

  if (cmdInsertSucceeded) {
    focusComposer(composer);
    return {
      ok: true,
      strategy: "atomicSelectionInsertText",
      strategiesTried,
      finalDraft: afterCmd,
      afterDraft: afterCmd,
      selectionInsideComposer: selectionOk,
      insertCommandResult: cmdResult,
      clearSucceeded: true,
      insertSucceeded: true,
      restoredOriginal: false,
      clearedAfterFailure: false
    };
  }

  // Both strategies failed — restore original
  const rollback = await restoreOriginalDraft(composer, originalDraft);
  const finalDraft = readComposerText(composer);

  const duplicateDetected = isUnsafeFinalText(finalDraft, originalDraft, text);

  return {
    ok: false,
    reason: duplicateDetected ? "duplicate_insert_detected" : "insert_failed",
    strategy: "pasteEventOverSelection",
    strategiesTried,
    finalDraft,
    afterDraft: rollback.afterDraft,
    selectionInsideComposer: selectionOk,
    insertCommandResult: cmdResult,
    clearSucceeded: false,
    insertSucceeded: false,
    restoredOriginal: rollback.restoredOriginal,
    clearedAfterFailure: rollback.clearedAfterFailure
  };
}

// ─── Public entry point ───────────────────────────────────────────────────────

async function insertReply(
  text: string,
  forceReplace = false
): Promise<ComposerInsertResult> {
  if (!isComposerWhatsAppWeb()) {
    return {
      ok: false,
      error: "Open web.whatsapp.com and select a chat before inserting.",
      reason: "not_whatsapp",
      composerAdapterVersion: WHATSAPP_COMPOSER_ADAPTER_VERSION
    };
  }

  const target = findComposer();

  if (!target) {
    return {
      ok: false,
      error: COMPOSER_NOT_FOUND_MESSAGE,
      reason: "composer_not_found",
      composerAdapterVersion: WHATSAPP_COMPOSER_ADAPTER_VERSION
    };
  }

  const originalDraft = readComposerText(target.element);

  // ── Draft protection ────────────────────────────────────────────────────
  if (originalDraft && !forceReplace) {
    const debug = makeDebug(target, {
      originalDraft,
      afterDraft: originalDraft,
      strategy: "draftProtection",
      strategiesTried: [],
      clearSucceeded: false,
      insertSucceeded: false
    });
    return {
      ok: false,
      error: "WhatsApp input already has text. Replace it?",
      reason: "draft_not_empty",
      currentDraftPreview: draftPreview(originalDraft),
      ...debug
    };
  }

  // ── Empty composer insert (known working path) ──────────────────────────
  if (!originalDraft) {
    const result = await insertIntoEmptyComposer(target.element, text);
    const debug = makeDebug(target, {
      originalDraft,
      finalDraft: result.afterDraft,
      afterDraft: result.afterDraft,
      strategy: "emptyTextContent",
      strategiesTried: ["emptyTextContent"],
      insertCommandResult: true,
      clearSucceeded: true,
      insertSucceeded: result.ok,
      restoredOriginal: false,
      clearedAfterFailure: false
    });

    if (!result.ok) {
      return {
        ok: false,
        error: result.duplicateDetected
          ? "Reply insertion failed; WhatsApp duplicated or appended text."
          : "Reply insertion failed; WhatsApp did not keep the inserted text.",
        reason: result.duplicateDetected ? "duplicate_insert_detected" : "insert_failed",
        insertedLength: text.length,
        ...debug
      };
    }

    return { ok: true, insertedLength: text.length, ...debug };
  }

  // ── Replace existing draft ──────────────────────────────────────────────
  const result = await replaceDraftWithReply(target, text, originalDraft);
  const debug = makeDebug(target, {
    originalDraft,
    finalDraft: result.finalDraft,
    afterDraft: result.afterDraft,
    strategy: result.strategy,
    strategiesTried: result.strategiesTried,
    selectionInsideComposer: result.selectionInsideComposer,
    insertCommandResult: result.insertCommandResult,
    clearSucceeded: result.clearSucceeded,
    insertSucceeded: result.insertSucceeded,
    restoredOriginal: result.restoredOriginal,
    clearedAfterFailure: result.clearedAfterFailure
  });

  if (!result.ok) {
    const error =
      result.reason === "selection_failed"
        ? "Reply insertion failed; WhatsApp composer text could not be selected."
        : result.reason === "duplicate_insert_detected"
          ? "Reply insertion failed; WhatsApp duplicated or appended text."
          : "Reply insertion failed; WhatsApp did not keep the inserted text.\n" +
            "This may mean WhatsApp's React editor is blocking external DOM changes.\n" +
            "Use 'Copy Reply' to copy the text and paste it manually instead.";

    return {
      ok: false,
      error,
      reason: result.reason,
      insertedLength: text.length,
      ...debug
    };
  }

  return { ok: true, insertedLength: text.length, ...debug };
}

// ─── Export ───────────────────────────────────────────────────────────────────

(globalThis as ComposerGlobal).WfoWhatsAppComposerAdapter = {
  insertReply,
  version: WHATSAPP_COMPOSER_ADAPTER_VERSION
};
