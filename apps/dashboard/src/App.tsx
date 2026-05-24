const foundationItems = [
  {
    label: "API",
    value: "GET /health",
    tone: "bg-emerald-500"
  },
  {
    label: "Dashboard",
    value: "React + Vite",
    tone: "bg-sky-500"
  },
  {
    label: "Extension",
    value: "Manifest V3",
    tone: "bg-amber-500"
  },
  {
    label: "Shared",
    value: "Types + Zod",
    tone: "bg-fuchsia-500"
  }
];

export function App() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-5 py-8 sm:px-8">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase text-emerald-300">
              Local-first workspace
            </p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">
              WhatsApp Food Order AI Copilot
            </h1>
          </div>
          <div className="w-fit rounded-md border border-white/15 px-3 py-2 text-sm text-neutral-300">
            Milestone 0
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {foundationItems.map((item) => (
            <article
              className="rounded-md border border-white/10 bg-white/[0.04] p-4"
              key={item.label}
            >
              <div className={`h-1.5 w-10 rounded-full ${item.tone}`} />
              <h2 className="mt-4 text-base font-semibold">{item.label}</h2>
              <p className="mt-1 text-sm text-neutral-400">{item.value}</p>
            </article>
          ))}
        </section>

        <section className="border-t border-white/10 pt-6">
          <p className="max-w-2xl text-sm leading-6 text-neutral-300">
            Foundation ready. No AI, database, analytics, order memory, WhatsApp
            chat reading, or automatic sending is active in this milestone.
          </p>
        </section>
      </main>
    </div>
  );
}
