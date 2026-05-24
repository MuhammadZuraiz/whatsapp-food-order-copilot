import { z } from "zod";
import type { AiProvider } from "./AiProvider.js";
import { MockProvider } from "./providers/MockProvider.js";
import { OpenAICompatibleProvider } from "./providers/OpenAICompatibleProvider.js";
import {
  aiOrderExtractionResultSchema,
  aiSuggestedRepliesResultSchema,
  brandStyleAnalysisResultSchema,
  customerMemoryUpdateResultSchema,
  intentClassificationResultSchema,
  type AiMessage,
  type AiOrderExtractionResult,
  type AiProviderName,
  type AiSuggestedRepliesResult,
  type BrandStyleAnalysisResult,
  type CustomerMemoryUpdateResult,
  type IntentClassificationResult
} from "./types.js";

const intentFallback: IntentClassificationResult = {
  intent: "general_question",
  confidence: 0,
  orderLikely: false,
  reason: "AI provider unavailable or returned invalid output."
};

const orderFallback: AiOrderExtractionResult = {
  items: [],
  quantity: null,
  deliveryDate: null,
  deliveryTime: null,
  address: null,
  paymentMethod: null,
  paymentStatus: "not_discussed",
  customRequests: [],
  missingFields: [
    "items",
    "quantity",
    "deliveryDate",
    "deliveryTime",
    "address",
    "paymentMethod",
    "paymentStatus"
  ],
  summary: "AI order extraction was unavailable."
};

const memoryFallback: CustomerMemoryUpdateResult = {
  shouldUpdate: false,
  profileSummary: null,
  usualAddress: null,
  preferences: [],
  notes: []
};

const suggestedRepliesFallback: AiSuggestedRepliesResult = {
  suggestedReplies: [
    {
      text: "Sure, I can help. Please confirm the delivery date and time.",
      type: "clarifying_question",
      reason: "Safe fallback reply for a scheduled delivery workflow."
    }
  ],
  safety: {
    requiresHumanApproval: true,
    autoSendAllowed: false
  }
};

const brandStyleFallback: BrandStyleAnalysisResult = {
  toneSummary: "Friendly, concise, and confirmation-oriented.",
  commonPhrases: [],
  doRules: ["Require human approval before any reply is sent."],
  dontRules: ["Do not auto-send messages."],
  exampleReplies: []
};

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function parseJsonObject(output: string) {
  try {
    return JSON.parse(output) as unknown;
  } catch {
    const start = output.indexOf("{");
    const end = output.lastIndexOf("}");

    if (start >= 0 && end > start) {
      return JSON.parse(output.slice(start, end + 1)) as unknown;
    }

    throw new Error("Provider output was not valid JSON.");
  }
}

function createJsonTaskMessages(task: string, instructions: string, text: string) {
  return [
    {
      role: "system",
      content: [
        `TASK:${task}`,
        "You support a WhatsApp Business food-order workflow.",
        "The business supports future scheduled deliveries only.",
        "Never imply that messages should be auto-sent.",
        "Return strict JSON only. Do not wrap JSON in markdown."
      ].join("\n")
    },
    {
      role: "user",
      content: `${instructions}\n\nText:\n${text}`
    }
  ] satisfies AiMessage[];
}

export function createAiProviderFromEnv(): AiProvider {
  const selectedProvider = (
    process.env.AI_PROVIDER ?? "mock"
  ).toLocaleLowerCase() as AiProviderName;

  if (selectedProvider === "openai-compatible") {
    const apiKey = process.env.AI_API_KEY;
    const baseUrl = process.env.AI_BASE_URL;
    const model = process.env.AI_MODEL;

    if (apiKey && baseUrl && model) {
      return new OpenAICompatibleProvider({
        apiKey,
        baseUrl,
        model
      });
    }

    console.warn(
      "[AI] AI_PROVIDER=openai-compatible is missing AI_API_KEY, AI_BASE_URL, or AI_MODEL. Falling back to MockProvider."
    );
    return new MockProvider();
  }

  if (selectedProvider !== "mock") {
    console.warn(
      `[AI] Unknown AI_PROVIDER "${selectedProvider}". Falling back to MockProvider.`
    );
  }

  return new MockProvider();
}

export class AiService {
  constructor(private readonly provider: AiProvider = createAiProviderFromEnv()) {}

  get providerName() {
    return this.provider.name;
  }

  async classifyIntent(text: string) {
    return this.generateJson(
      "classifyIntent",
      createJsonTaskMessages(
        "classifyIntent",
        [
          "Classify the customer's intent.",
          "Use one of: menu_request, price_question, availability_question, new_order, repeat_order, custom_request, payment_question, delivery_update, complaint, general_question.",
          "Return JSON with: intent, confidence, orderLikely, reason."
        ].join("\n"),
        text
      ),
      intentClassificationResultSchema,
      intentFallback
    );
  }

  async extractOrder(text: string) {
    return this.generateJson(
      "extractOrder",
      createJsonTaskMessages(
        "extractOrder",
        [
          "Extract food-order details from the chat text.",
          "Required order fields are items, quantity, deliveryDate, deliveryTime, address, paymentMethod, and paymentStatus.",
          "PaymentStatus must be one of: not_discussed, method_selected, payment_details_sent, awaiting_payment, proof_received, paid_confirmed, payment_issue.",
          "Only use paid_confirmed if the business explicitly confirms payment.",
          "Return JSON with: items, quantity, deliveryDate, deliveryTime, address, paymentMethod, paymentStatus, customRequests, missingFields, summary."
        ].join("\n"),
        text
      ),
      aiOrderExtractionResultSchema,
      orderFallback
    );
  }

  async updateCustomerMemory(text: string) {
    return this.generateJson(
      "updateCustomerMemory",
      createJsonTaskMessages(
        "updateCustomerMemory",
        [
          "Identify stable customer memory worth saving for future conversations.",
          "Only include preferences, usual address, or notes that are supported by the text.",
          "Return JSON with: shouldUpdate, profileSummary, usualAddress, preferences, notes."
        ].join("\n"),
        text
      ),
      customerMemoryUpdateResultSchema,
      memoryFallback
    );
  }

  async generateSuggestedReplies(text: string) {
    return this.generateJson(
      "generateSuggestedReplies",
      createJsonTaskMessages(
        "generateSuggestedReplies",
        [
          "Generate 2-3 short reply suggestions for the business owner to review.",
          "The replies must be human-approved and must not be auto-sent.",
          "Prefer clarifying questions for missing order fields.",
          "Return JSON with: suggestedReplies and safety.",
          "Each suggested reply needs text, type, and reason.",
          "Safety must be { requiresHumanApproval: true, autoSendAllowed: false }."
        ].join("\n"),
        text
      ),
      aiSuggestedRepliesResultSchema,
      suggestedRepliesFallback
    );
  }

  async analyzeBrandStyle(text: string) {
    return this.generateJson(
      "analyzeBrandStyle",
      createJsonTaskMessages(
        "analyzeBrandStyle",
        [
          "Analyze the business owner's reply style from the text.",
          "Return JSON with: toneSummary, commonPhrases, doRules, dontRules, exampleReplies."
        ].join("\n"),
        text
      ),
      brandStyleAnalysisResultSchema,
      brandStyleFallback
    );
  }

  private async generateJson<T>(
    taskName: string,
    messages: AiMessage[],
    schema: z.ZodType<T>,
    fallback: T
  ): Promise<T> {
    try {
      const output = await this.provider.generate(messages, {
        temperature: 0.2,
        maxTokens: 900,
        responseFormat: "json"
      });
      const parsed = parseJsonObject(output);
      const result = schema.safeParse(parsed);

      if (!result.success) {
        console.warn(
          `[AI] ${taskName} returned invalid JSON shape: ${result.error.issues
            .map((issue) => issue.path.join(".") || issue.message)
            .join(", ")}`
        );
        return fallback;
      }

      return result.data;
    } catch (error) {
      console.warn(`[AI] ${taskName} failed: ${safeErrorMessage(error)}`);
      return fallback;
    }
  }
}
