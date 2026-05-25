import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  analyzeManualChat,
  type ManualChatAnalysisResponse,
  type ParsedChatMessage,
  type SuggestedReplyDto
} from "../api/manualChatApi";
import { getProducts } from "../api/productsApi";

const defaultBusinessNames = "My Business, Business, You";
const sampleChat = `24/05/2026, 7:15 PM - Customer: Hi, can I see the menu?
24/05/2026, 7:17 PM - My Business: Sure, we have biryani, pasta, rice boxes, and dessert platters.
[24/05/2026, 7:20:00 PM] Customer: I want 2 biryani boxes for tomorrow dinner
[24/05/2026, 7:21:00 PM] Customer: Please make it less spicy
[24/05/2026, 7:22:00 PM] Customer: Address is Villa 12, Street 4, Gulberg
[24/05/2026, 7:24:00 PM] My Business: We can do bank transfer or cash.`;

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function formatDate(value: string | null) {
  if (!value) {
    return "Missing";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium"
  }).format(new Date(value));
}

function countUniqueActiveProducts(
  products: Awaited<ReturnType<typeof getProducts>>
) {
  return new Set(
    products
      .filter((product) => product.isActive)
      .map((product) => product.name.toLocaleLowerCase().trim())
      .filter(Boolean)
  ).size;
}

function MessageList({ messages }: { messages: ParsedChatMessage[] }) {
  return (
    <section className="rounded-md border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Parsed Messages</h2>
        <span className="rounded-md border border-white/10 px-2 py-1 text-xs text-neutral-300">
          {messages.length}
        </span>
      </div>
      <div className="mt-4 grid gap-3">
        {messages.map((message, index) => (
          <article
            className="rounded-md border border-white/10 bg-neutral-950 p-3"
            key={`${message.timestamp ?? "no-time"}-${index}`}
          >
            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
              <span className="font-medium text-neutral-200">
                {message.senderName ?? "System/Unknown"}
              </span>
              <span className="rounded-sm bg-white/10 px-1.5 py-0.5">
                {message.senderType}
              </span>
              <span>
                {message.timestamp
                  ? new Date(message.timestamp).toLocaleString()
                  : "No timestamp"}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-200">
              {message.text}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function OrderSummary({
  result
}: {
  result: ManualChatAnalysisResponse;
}) {
  const order = result.analysis.order;

  return (
    <section className="rounded-md border border-white/10 bg-white/[0.04] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Current Order Summary</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Intent: {formatLabel(result.analysis.intent)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-md bg-sky-300 px-2 py-1 text-xs font-medium text-sky-950">
            {formatLabel(result.analysis.source)}
          </span>
          <span
            className={`rounded-md px-2 py-1 text-xs font-medium ${
              result.analysis.orderLikely
                ? "bg-emerald-400 text-emerald-950"
                : "bg-neutral-700 text-neutral-100"
            }`}
          >
            {result.analysis.orderLikely ? "Order likely" : "Inquiry"}
          </span>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase text-neutral-500">Items</dt>
          <dd className="mt-1 text-sm text-neutral-100">
            {order.items.length > 0 ? order.items.join(", ") : "Missing"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-neutral-500">Quantity</dt>
          <dd className="mt-1 text-sm text-neutral-100">
            {order.quantity ?? "Missing"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-neutral-500">Delivery Date</dt>
          <dd className="mt-1 text-sm text-neutral-100">
            {formatDate(order.deliveryDate)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-neutral-500">Delivery Time</dt>
          <dd className="mt-1 text-sm text-neutral-100">
            {order.deliveryTime ?? "Missing"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-neutral-500">Payment</dt>
          <dd className="mt-1 text-sm text-neutral-100">
            {order.paymentMethod ?? "Missing"} /{" "}
            {formatLabel(order.paymentStatus)}
          </dd>
          {order.paymentInquiryDetected ? (
            <dd className="mt-1 text-xs text-amber-200">
              Payment question detected; method not selected yet.
            </dd>
          ) : null}
        </div>
        <div>
          <dt className="text-xs uppercase text-neutral-500">Custom Requests</dt>
          <dd className="mt-1 text-sm text-neutral-100">
            {order.customRequests.length > 0
              ? order.customRequests.join(", ")
              : "None detected"}
          </dd>
        </div>
      </dl>

      <div className="mt-4">
        <p className="text-xs uppercase text-neutral-500">Address</p>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-neutral-100">
          {order.address ?? "Missing"}
        </p>
      </div>

      <p className="mt-4 rounded-md border border-white/10 bg-neutral-950 p-3 text-sm leading-6 text-neutral-300">
        {order.summary}
      </p>
    </section>
  );
}

function CustomerSummary({ summary }: { summary: string | null }) {
  return summary ? (
    <section className="rounded-md border border-white/10 bg-white/[0.04] p-4">
      <h2 className="text-lg font-semibold">Customer Summary</h2>
      <p className="mt-2 text-sm leading-6 text-neutral-300">{summary}</p>
    </section>
  ) : null;
}

function CustomerMemorySummary({
  summary,
  used
}: {
  summary?: string | null;
  used?: boolean;
}) {
  return used ? (
    <section className="rounded-md border border-white/10 bg-white/[0.04] p-4">
      <h2 className="text-lg font-semibold">Customer Memory</h2>
      <p className="mt-2 text-sm leading-6 text-neutral-300">
        {summary ?? "Customer memory was found and used as advisory context."}
      </p>
    </section>
  ) : null;
}

function MissingFields({ fields }: { fields: string[] }) {
  return (
    <section className="rounded-md border border-white/10 bg-white/[0.04] p-4">
      <h2 className="text-lg font-semibold">Missing Fields</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {fields.length > 0 ? (
          fields.map((field) => (
            <span
              className="rounded-md bg-amber-300 px-2 py-1 text-xs font-medium text-amber-950"
              key={field}
            >
              {formatLabel(field)}
            </span>
          ))
        ) : (
          <span className="text-sm text-neutral-400">None detected</span>
        )}
      </div>
    </section>
  );
}

function SuggestedReplies({ replies }: { replies: SuggestedReplyDto[] }) {
  return (
    <section className="rounded-md border border-white/10 bg-white/[0.04] p-4">
      <h2 className="text-lg font-semibold">Suggested Replies</h2>
      <div className="mt-4 grid gap-3">
        {replies.map((reply) => (
          <article
            className="rounded-md border border-white/10 bg-neutral-950 p-3"
            key={reply.text}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-sm bg-sky-300 px-1.5 py-0.5 text-xs font-medium text-sky-950">
                {formatLabel(reply.type)}
              </span>
              <span className="text-xs text-neutral-500">{reply.reason}</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-neutral-100">
              {reply.text}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function WarningList({ warnings }: { warnings: string[] }) {
  return (
    <section className="rounded-md border border-white/10 bg-white/[0.04] p-4">
      <h2 className="text-lg font-semibold">Warnings</h2>
      <div className="mt-3 grid gap-2">
        {warnings.length > 0 ? (
          warnings.map((warning) => (
            <p className="text-sm text-amber-200" key={warning}>
              {warning}
            </p>
          ))
        ) : (
          <p className="text-sm text-neutral-400">No parser warnings.</p>
        )}
      </div>
    </section>
  );
}

export function ManualChatAnalyzer() {
  const [chatName, setChatName] = useState("Sample Customer");
  const [customerKey, setCustomerKey] = useState("");
  const [businessNames, setBusinessNames] = useState(defaultBusinessNames);
  const [rawText, setRawText] = useState(sampleChat);
  const [useAi, setUseAi] = useState(true);
  const [result, setResult] = useState<ManualChatAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeProductCount, setActiveProductCount] = useState<number | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);

  const parsedBusinessNames = useMemo(
    () =>
      businessNames
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean),
    [businessNames]
  );

  useEffect(() => {
    let isMounted = true;

    getProducts()
      .then((products) => {
        if (isMounted) {
          setActiveProductCount(countUniqueActiveProducts(products));
        }
      })
      .catch(() => {
        if (isMounted) {
          setActiveProductCount(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await analyzeManualChat({
        chatName,
        customerKey: customerKey.trim() || undefined,
        businessSenderNames: parsedBusinessNames,
        rawText,
        useAi
      });

      setResult(response);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Something went wrong."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <main className="mx-auto grid min-h-screen w-full max-w-7xl gap-6 px-5 py-6 lg:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.4fr)]">
        <section className="rounded-md border border-white/10 bg-white/[0.04] p-4 lg:sticky lg:top-6 lg:h-fit">
          <div className="border-b border-white/10 pb-4">
            <p className="text-sm font-medium uppercase text-emerald-300">
              Milestone 4
            </p>
            <h1 className="mt-2 text-2xl font-semibold leading-tight">
              Manual Chat Analyzer
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

            <label className="grid gap-2">
              <span className="text-sm font-medium text-neutral-200">
                Customer key or phone
              </span>
              <input
                className="rounded-md border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none transition focus:border-emerald-300"
                onChange={(event) => setCustomerKey(event.target.value)}
                placeholder="Optional stable customer identifier"
                value={customerKey}
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-neutral-950 px-3 py-2">
              <span className="text-sm font-medium text-neutral-200">
                Use AI assistance
              </span>
              <input
                checked={useAi}
                className="h-4 w-4 accent-emerald-300"
                onChange={(event) => setUseAi(event.target.checked)}
                type="checkbox"
              />
            </label>

            <p className="rounded-md border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-neutral-300">
              {activeProductCount === null
                ? "Menu context unavailable."
                : activeProductCount > 0
                  ? `Menu context: ${activeProductCount} unique active ${
                      activeProductCount === 1 ? "product" : "products"
                    } loaded.`
                  : "No menu products added yet."}
            </p>

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
              disabled={isLoading || parsedBusinessNames.length === 0}
              type="submit"
            >
              {isLoading ? "Analyzing..." : "Analyze Chat"}
            </button>
          </form>

          {error ? (
            <p className="mt-4 rounded-md border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </p>
          ) : null}
        </section>

        <div className="grid gap-4">
          {result ? (
            <>
              <OrderSummary result={result} />
              <CustomerSummary summary={result.analysis.customerSummary} />
              <CustomerMemorySummary
                summary={result.analysis.customerMemorySummary}
                used={result.analysis.customerMemoryUsed}
              />
              <MissingFields fields={result.analysis.order.missingFields} />
              <SuggestedReplies replies={result.analysis.suggestedReplies} />
              <WarningList warnings={result.analysis.warnings} />
              <MessageList messages={result.messages} />
            </>
          ) : (
            <section className="rounded-md border border-white/10 bg-white/[0.04] p-4">
              <h2 className="text-lg font-semibold">Ready to Analyze</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-300">
                Paste an exported WhatsApp chat, confirm your business sender
                names, and run the manual analyzer. Results will appear here and
                will be saved to the local API database.
              </p>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
