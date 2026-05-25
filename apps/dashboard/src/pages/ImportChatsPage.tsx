import { useState, type ChangeEvent, type FormEvent } from "react";
import {
  importChat,
  type ChatImportResponse
} from "../api/importChatsApi";

const defaultBusinessNames = "My Business, Business, You";
const sampleImportChat = `24/05/2026, 7:15 PM - Customer: Hi, can I see the menu?
24/05/2026, 7:16 PM - My Business: Sure, I'll send it now.
24/05/2026, 7:20 PM - Customer: I want 2 Chicken Biryani Tray for tomorrow dinner
24/05/2026, 7:21 PM - My Business: Sure, I can arrange that for tomorrow dinner.
24/05/2026, 7:22 PM - Customer: Less spicy please
24/05/2026, 7:23 PM - My Business: Noted, I'll make it less spicy.
24/05/2026, 7:24 PM - Customer: What payment methods do you accept?
24/05/2026, 7:25 PM - My Business: We accept cash or bank transfer. Please send your delivery address so I can confirm the details.`;

function parseBusinessNames(value: string) {
  return value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

function ResultCard({ result }: { result: ChatImportResponse }) {
  return (
    <section className="rounded-md border border-white/10 bg-white/[0.04] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Import Result</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Saved as {result.conversation.source}
          </p>
        </div>
        <span className="rounded-md bg-emerald-300 px-2 py-1 text-xs font-medium text-emerald-950">
          {result.import.messageCount} messages
        </span>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase text-neutral-500">Customer</dt>
          <dd className="mt-1 text-sm text-neutral-100">
            {result.customer.displayName}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-neutral-500">Conversation</dt>
          <dd className="mt-1 break-all text-sm text-neutral-100">
            {result.conversation.id}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-neutral-500">
            Business Messages
          </dt>
          <dd className="mt-1 text-sm text-neutral-100">
            {result.import.businessMessageCount}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-neutral-500">
            Customer Messages
          </dt>
          <dd className="mt-1 text-sm text-neutral-100">
            {result.import.customerMessageCount}
          </dd>
        </div>
      </dl>

      <div className="mt-4 rounded-md border border-white/10 bg-neutral-950 p-3">
        <p className="text-sm font-medium text-neutral-100">
          Brand style {result.brandStyle.updated ? "updated" : "not updated"}
        </p>
        <p className="mt-1 text-sm text-neutral-400">
          {result.brandStyle.profile?.toneSummary ??
            "No brand style profile was returned."}
        </p>
      </div>

      <div className="mt-4">
        <p className="text-xs uppercase text-neutral-500">Warnings</p>
        <div className="mt-2 grid gap-2">
          {result.import.warnings.length > 0 ? (
            result.import.warnings.map((warning) => (
              <p className="text-sm text-amber-200" key={warning}>
                {warning}
              </p>
            ))
          ) : (
            <p className="text-sm text-neutral-400">No warnings.</p>
          )}
        </div>
      </div>
    </section>
  );
}

export function ImportChatsPage() {
  const [chatName, setChatName] = useState("Historical Customer");
  const [businessNames, setBusinessNames] = useState(defaultBusinessNames);
  const [customerKey, setCustomerKey] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [rawText, setRawText] = useState(sampleImportChat);
  const [runCustomerMemoryUpdate, setRunCustomerMemoryUpdate] = useState(true);
  const [runBrandStyleAnalysis, setRunBrandStyleAnalysis] = useState(true);
  const [result, setResult] = useState<ChatImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setRawText(await file.text());
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsImporting(true);

    try {
      const response = await importChat({
        chatName,
        customerKey: customerKey.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        businessSenderNames: parseBusinessNames(businessNames),
        rawText,
        runBrandStyleAnalysis,
        runCustomerMemoryUpdate
      });

      setResult(response);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not import chat."
      );
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="mx-auto grid min-h-screen w-full max-w-7xl gap-6 px-5 py-6 lg:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.4fr)]">
      <section className="rounded-md border border-white/10 bg-white/[0.04] p-4 lg:h-fit">
        <div className="border-b border-white/10 pb-4">
          <p className="text-sm font-medium uppercase text-emerald-300">
            Historical Learning
          </p>
          <h1 className="mt-2 text-2xl font-semibold leading-tight">
            Import Chats
          </h1>
        </div>

        <form className="mt-4 grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-neutral-200">
              Chat or customer name
            </span>
            <input
              className="rounded-md border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none transition focus:border-emerald-300"
              onChange={(event) => setChatName(event.target.value)}
              required
              value={chatName}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-neutral-200">
              Business sender names
            </span>
            <input
              className="rounded-md border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none transition focus:border-emerald-300"
              onChange={(event) => setBusinessNames(event.target.value)}
              required
              value={businessNames}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-neutral-200">
                Customer key
              </span>
              <input
                className="rounded-md border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none transition focus:border-emerald-300"
                onChange={(event) => setCustomerKey(event.target.value)}
                placeholder="Optional"
                value={customerKey}
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-neutral-200">
                Customer phone
              </span>
              <input
                className="rounded-md border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none transition focus:border-emerald-300"
                onChange={(event) => setCustomerPhone(event.target.value)}
                placeholder="Optional"
                value={customerPhone}
              />
            </label>
          </div>

          <div className="grid gap-2 rounded-md border border-white/10 bg-neutral-950 p-3">
            <label className="flex items-center gap-3">
              <input
                checked={runCustomerMemoryUpdate}
                className="h-4 w-4 accent-emerald-300"
                onChange={(event) =>
                  setRunCustomerMemoryUpdate(event.target.checked)
                }
                type="checkbox"
              />
              <span className="text-sm font-medium text-neutral-200">
                Update customer memory
              </span>
            </label>
            <label className="flex items-center gap-3">
              <input
                checked={runBrandStyleAnalysis}
                className="h-4 w-4 accent-emerald-300"
                onChange={(event) =>
                  setRunBrandStyleAnalysis(event.target.checked)
                }
                type="checkbox"
              />
              <span className="text-sm font-medium text-neutral-200">
                Update brand style
              </span>
            </label>
          </div>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-neutral-200">
              Optional .txt upload
            </span>
            <input
              accept=".txt,text/plain"
              className="rounded-md border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
              onChange={handleFileChange}
              type="file"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-neutral-200">
              WhatsApp exported chat text
            </span>
            <textarea
              className="min-h-[360px] resize-y rounded-md border border-white/10 bg-neutral-950 px-3 py-2 font-mono text-sm leading-6 text-neutral-100 outline-none transition focus:border-emerald-300"
              onChange={(event) => setRawText(event.target.value)}
              required
              value={rawText}
            />
          </label>

          <button
            className="rounded-md bg-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-300"
            disabled={isImporting || parseBusinessNames(businessNames).length === 0}
            type="submit"
          >
            {isImporting ? "Importing..." : "Import Chat"}
          </button>
        </form>

        {error ? (
          <p className="mt-4 rounded-md border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}
      </section>

      <div className="grid gap-4 lg:h-fit">
        {result ? (
          <ResultCard result={result} />
        ) : (
          <section className="rounded-md border border-white/10 bg-white/[0.04] p-4">
            <h2 className="text-lg font-semibold">Ready to Import</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-300">
              Paste or upload an exported WhatsApp `.txt` chat. The import
              stores parsed messages locally and can optionally update customer
              memory and brand style.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
