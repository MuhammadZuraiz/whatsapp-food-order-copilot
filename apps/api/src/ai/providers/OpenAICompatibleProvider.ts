import type { AiProvider } from "../AiProvider.js";
import type { AiGenerateOptions, AiMessage } from "../types.js";

type OpenAICompatibleProviderConfig = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

function getChatCompletionsUrl(baseUrl: string) {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "");

  if (normalizedBaseUrl.endsWith("/chat/completions")) {
    return normalizedBaseUrl;
  }

  return `${normalizedBaseUrl}/chat/completions`;
}

function assertProviderConfig(
  config: OpenAICompatibleProviderConfig
): asserts config is Required<OpenAICompatibleProviderConfig> {
  if (!config.apiKey?.trim()) {
    throw new Error("AI_API_KEY is required for AI_PROVIDER=openai-compatible.");
  }

  if (!config.baseUrl?.trim()) {
    throw new Error("AI_BASE_URL is required for AI_PROVIDER=openai-compatible.");
  }

  if (!config.model?.trim()) {
    throw new Error("AI_MODEL is required for AI_PROVIDER=openai-compatible.");
  }
}

function safeErrorBody(body: string, apiKey: string) {
  const withoutKey = apiKey ? body.replaceAll(apiKey, "[redacted]") : body;

  return withoutKey.slice(0, 800);
}

function shouldRetryWithoutResponseFormat(status: number, body: string) {
  return (
    [400, 422].includes(status) &&
    /\b(response_format|json_object|json schema|unsupported|not supported)\b/i.test(
      body
    )
  );
}

export class OpenAICompatibleProvider implements AiProvider {
  readonly name = "openai-compatible" as const;

  constructor(private readonly config: OpenAICompatibleProviderConfig) {}

  async generate(messages: AiMessage[], options: AiGenerateOptions = {}) {
    assertProviderConfig(this.config);

    const apiKey = this.config.apiKey.trim();
    const baseUrl = this.config.baseUrl.trim();
    const model = this.config.model.trim();
    const data = await this.requestCompletion(
      getChatCompletionsUrl(baseUrl),
      apiKey,
      {
        model,
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens,
        response_format:
          options.responseFormat === "json"
            ? {
                type: "json_object"
              }
            : undefined
      }
    );
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error(
        "OpenAI-compatible provider returned an invalid response shape: choices[0].message.content was missing."
      );
    }

    return content;
  }

  private async requestCompletion(
    url: string,
    apiKey: string,
    body: Record<string, unknown>
  ) {
    const response = await this.sendRequest(url, apiKey, body);
    const responseText = await response.text().catch(() => "");

    if (
      !response.ok &&
      body.response_format &&
      shouldRetryWithoutResponseFormat(response.status, responseText)
    ) {
      const retryBody = {
        ...body,
        response_format: undefined
      };
      const retryResponse = await this.sendRequest(url, apiKey, retryBody);
      const retryText = await retryResponse.text().catch(() => "");

      if (!retryResponse.ok) {
        throw new Error(
          `OpenAI-compatible provider request failed with ${retryResponse.status}: ${safeErrorBody(
            retryText,
            apiKey
          )}`
        );
      }

      return this.parseResponse(retryText);
    }

    if (!response.ok) {
      throw new Error(
        `OpenAI-compatible provider request failed with ${response.status}: ${safeErrorBody(
          responseText,
          apiKey
        )}`
      );
    }

    return this.parseResponse(responseText);
  }

  private async sendRequest(
    url: string,
    apiKey: string,
    body: Record<string, unknown>
  ) {
    try {
      return await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
    } catch (error) {
      throw new Error(
        `OpenAI-compatible provider request failed: ${
          error instanceof Error ? error.message : "Unknown network error"
        }`
      );
    }
  }

  private parseResponse(responseText: string) {
    try {
      return JSON.parse(responseText) as ChatCompletionResponse;
    } catch {
      throw new Error(
        "OpenAI-compatible provider returned non-JSON response data."
      );
    }
  }
}
