import { useState } from "react";
import { BrandStylePage } from "./pages/BrandStylePage";
import { CustomersPage } from "./pages/CustomersPage";
import { ImportChatsPage } from "./pages/ImportChatsPage";
import { ManualChatAnalyzer } from "./pages/ManualChatAnalyzer";
import { ProductsPage } from "./pages/ProductsPage";

type Page = "analyzer" | "products" | "import" | "brandStyle" | "customers";

const pages: Array<{
  id: Page;
  label: string;
}> = [
  {
    id: "analyzer",
    label: "Manual Chat Analyzer"
  },
  {
    id: "products",
    label: "Menu / Products"
  },
  {
    id: "import",
    label: "Import Chats"
  },
  {
    id: "brandStyle",
    label: "Brand Style"
  },
  {
    id: "customers",
    label: "Customers"
  }
];

export function App() {
  const [page, setPage] = useState<Page>("analyzer");
  const currentPage = {
    analyzer: <ManualChatAnalyzer />,
    products: <ProductsPage />,
    import: <ImportChatsPage />,
    brandStyle: <BrandStylePage />,
    customers: <CustomersPage />
  }[page];

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
          <div className="flex flex-wrap gap-2">
            {pages.map((item) => (
              <button
                className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                  page === item.id
                    ? "bg-emerald-300 text-emerald-950"
                    : "border border-white/10 text-neutral-100 hover:border-white/30"
                }`}
                key={item.id}
                onClick={() => setPage(item.id)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      {currentPage}
    </div>
  );
}
