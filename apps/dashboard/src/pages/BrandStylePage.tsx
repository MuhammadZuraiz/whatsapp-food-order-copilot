import { useEffect, useState, type FormEvent } from "react";
import {
  analyzeBrandStyle,
  getBrandStyle,
  type BrandStyleAnalyzeResponse,
  type BrandStyleProfile
} from "../api/brandStyleApi";

const defaultBusinessNames = "My Business, Business, You";

function parseBusinessNames(value: string) {
  return value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

function ListBlock({ items, title }: { items: string[]; title: string }) {
  return (
    <div>
      <p className="text-xs uppercase text-neutral-500">{title}</p>
      <div className="mt-2 grid gap-2">
        {items.length > 0 ? (
          items.map((item) => (
            <p
              className="rounded-md border border-white/10 bg-neutral-950 p-2 text-sm text-neutral-300"
              key={item}
            >
              {item}
            </p>
          ))
        ) : (
          <p className="text-sm text-neutral-500">None saved yet.</p>
        )}
      </div>
    </div>
  );
}

function BrandStyleDetails({ profile }: { profile: BrandStyleProfile | null }) {
  if (!profile) {
    return (
      <section className="rounded-md border border-white/10 bg-white/[0.04] p-4">
        <h2 className="text-lg font-semibold">Current Brand Style</h2>
        <p className="mt-2 text-sm text-neutral-400">
          No brand style profile has been saved yet.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-white/10 bg-white/[0.04] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Current Brand Style</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Updated {new Date(profile.updatedAt).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs uppercase text-neutral-500">Tone Summary</p>
        <p className="mt-2 rounded-md border border-white/10 bg-neutral-950 p-3 text-sm leading-6 text-neutral-300">
          {profile.toneSummary ?? "No tone summary saved yet."}
        </p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ListBlock items={profile.commonPhrases} title="Common Phrases" />
        <ListBlock items={profile.exampleReplies} title="Example Replies" />
        <ListBlock items={profile.doRules} title="Do Rules" />
        <ListBlock items={profile.dontRules} title="Don't Rules" />
      </div>
    </section>
  );
}

export function BrandStylePage() {
  const [profile, setProfile] = useState<BrandStyleProfile | null>(null);
  const [businessNames, setBusinessNames] = useState(defaultBusinessNames);
  const [limit, setLimit] = useState("200");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  async function loadProfile() {
    setIsLoading(true);

    try {
      setProfile(await getBrandStyle());
      setError(null);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not load brand style."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadProfile();
  }, []);

  async function handleAnalyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setWarnings([]);
    setIsAnalyzing(true);

    try {
      const response: BrandStyleAnalyzeResponse = await analyzeBrandStyle({
        businessSenderNames: parseBusinessNames(businessNames),
        limit: Number(limit)
      });

      setProfile(response.profile);
      setWarnings(response.warnings);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not analyze brand style."
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <div className="mx-auto grid min-h-screen w-full max-w-7xl gap-6 px-5 py-6 lg:grid-cols-[minmax(360px,0.8fr)_minmax(0,1.5fr)]">
      <section className="rounded-md border border-white/10 bg-white/[0.04] p-4 lg:h-fit">
        <div className="border-b border-white/10 pb-4">
          <p className="text-sm font-medium uppercase text-emerald-300">
            Reply Style
          </p>
          <h1 className="mt-2 text-2xl font-semibold leading-tight">
            Brand Style
          </h1>
        </div>

        <form className="mt-4 grid gap-4" onSubmit={handleAnalyze}>
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
              Message limit
            </span>
            <input
              className="rounded-md border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none transition focus:border-emerald-300"
              min="1"
              max="500"
              onChange={(event) => setLimit(event.target.value)}
              step="1"
              type="number"
              value={limit}
            />
          </label>

          <button
            className="rounded-md bg-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-300"
            disabled={isAnalyzing || parseBusinessNames(businessNames).length === 0}
            type="submit"
          >
            {isAnalyzing
              ? "Analyzing..."
              : "Analyze Brand Style From Stored Chats"}
          </button>
        </form>

        {warnings.length > 0 ? (
          <div className="mt-4 rounded-md border border-amber-300/30 bg-amber-300/10 p-3">
            <p className="text-sm font-medium text-amber-100">Warnings</p>
            <div className="mt-2 grid gap-2">
              {warnings.map((warning) => (
                <p className="text-sm text-amber-200" key={warning}>
                  {warning}
                </p>
              ))}
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-md border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}
      </section>

      {isLoading ? (
        <section className="rounded-md border border-white/10 bg-white/[0.04] p-4">
          <p className="text-sm text-neutral-400">Loading brand style...</p>
        </section>
      ) : (
        <BrandStyleDetails profile={profile} />
      )}
    </div>
  );
}
