import type { AiProviderName } from "./types.js";

function hasValue(value: string | undefined) {
  return Boolean(value?.trim());
}

export function getAiRuntimeConfig() {
  const configuredProvider = (
    process.env.AI_PROVIDER ?? "mock"
  ).toLocaleLowerCase();
  const provider: AiProviderName =
    configuredProvider === "openai-compatible"
      ? "openai-compatible"
      : "mock";

  return {
    provider,
    activeProviderUsesExternalApi: provider === "openai-compatible",
    analyzerEnabled:
      process.env.AI_ANALYZER_ENABLED?.toLocaleLowerCase() !== "false",
    model: provider === "openai-compatible" && hasValue(process.env.AI_MODEL)
      ? process.env.AI_MODEL?.trim() ?? null
      : null,
    baseUrlConfigured: hasValue(process.env.AI_BASE_URL),
    apiKeyConfigured: hasValue(process.env.AI_API_KEY)
  };
}
