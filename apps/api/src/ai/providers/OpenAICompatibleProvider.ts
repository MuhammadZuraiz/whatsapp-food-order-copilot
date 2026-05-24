import type { AiProvider } from "../AiProvider.js";
import type { AiGenerateOptions, AiMessage } from "../types.js";

type OpenAICompatibleProviderConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

function getChatCompletionsUrl(baseUrl: string) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

  if (normalizedBaseUrl.endsWith("/chat/completions")) {
    return normalizedBaseUrl;
  }

  return `${normalizedBaseUrl}/chat/completions`;
}

export class OpenAICompatibleProvider implements AiProvider {
  readonly name = "openai-compatible" as const;

  constructor(private readonly config: OpenAICompatibleProviderConfig) {}

  async generate(messages: AiMessage[], options: AiGenerateOptions = {}) {
    const response = await fetch(getChatCompletionsUrl(this.config.baseUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens,
        response_format:
          options.responseFormat === "json"
            ? {
                type: "json_object"
              }
            : undefined
      })
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `OpenAI-compatible provider failed with ${response.status}: ${body}`
      );
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("OpenAI-compatible provider returned no content.");
    }

    return content;
  }
}
