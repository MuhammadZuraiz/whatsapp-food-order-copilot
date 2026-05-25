import { useState } from "react";
import { ManualChatAnalyzer } from "./pages/ManualChatAnalyzer";
import { ProductsPage } from "./pages/ProductsPage";

type Page = "analyzer" | "products";

export function App() {
  const [page, setPage] = useState<Page>("analyzer");

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-white/10 bg-neutral-950">
        <nav className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div>
            <p className="text-sm font-medium uppercase text-emerald-300">
              WFO Copilot
            </p>
            <h1 className="text-lg font-semibold">Local Business Console</h1>
          </div>
          <div className="flex gap-2">
            <button
              className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                page === "analyzer"
                  ? "bg-emerald-300 text-emerald-950"
                  : "border border-white/10 text-neutral-100 hover:border-white/30"
              }`}
              onClick={() => setPage("analyzer")}
              type="button"
            >
              Manual Chat Analyzer
            </button>
            <button
              className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                page === "products"
                  ? "bg-emerald-300 text-emerald-950"
                  : "border border-white/10 text-neutral-100 hover:border-white/30"
              }`}
              onClick={() => setPage("products")}
              type="button"
            >
              Menu / Products
            </button>
          </div>
        </nav>
      </header>

      {page === "analyzer" ? <ManualChatAnalyzer /> : <ProductsPage />}
    </div>
  );
}
