import { z } from "zod";
import type { AiProvider } from "./AiProvider.js";
import { getAiRuntimeConfig } from "./config.js";
import { extractJsonFromText } from "./extractJsonFromText.js";
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
  profileSummary: null,
  preferences: [],
  usualAddress: null,
  paymentBehavior: null,
  complaintHistory: [],
  repeatOrderPatterns: [],
  notes: []
};

const suggestedRepliesFallback: AiSuggestedRepliesResult = {
  suggestions: [
    {
      text: "Sure, I can help. Please confirm the delivery date and time.",
      type: "clarifying_question",
      reason: "Safe fallback reply for a scheduled delivery workflow."
    }
  ]
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
  const selectedProvider = getAiRuntimeConfig().provider;

  if (selectedProvider === "openai-compatible") {
    return new OpenAICompatibleProvider({
      apiKey: process.env.AI_API_KEY,
      baseUrl: process.env.AI_BASE_URL,
      model: process.env.AI_MODEL
    });
  }

  if ((process.env.AI_PROVIDER ?? "mock").toLocaleLowerCase() !== "mock") {
    console.warn(
      `[AI] Unknown AI_PROVIDER "${process.env.AI_PROVIDER}". Falling back to MockProvider.`
    );
  }

  return new MockProvider();
}

export class AiService {
  private readonly fallbackWarnings: string[] = [];

  constructor(private readonly provider: AiProvider = createAiProviderFromEnv()) {}

  get providerName() {
    return this.provider.name;
  }

  get warnings() {
    return [...this.fallbackWarnings];
  }

  get usedFallback() {
    return this.fallbackWarnings.length > 0;
  }

  async classifyIntent(text: string) {
    return this.generateJson(
      "classifyIntent",
      createJsonTaskMessages(
        "classifyIntent",
        [
          "Classify the customer's intent.",
          "If available products/menu context is provided, use it as context only, not as proof that the customer ordered every product.",
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
          "If available products/menu context is provided, match customer-requested items to product names from that list when supported by the customer text.",
          "Do not invent products or prices. Product list items are context, not proof of an order.",
          "Return JSON only. No markdown. No explanation outside JSON.",
          "Required order fields are items, quantity, deliveryDate, deliveryTime, address, paymentMethod, and paymentStatus.",
          "PaymentStatus must be one of: not_discussed, method_selected, payment_details_sent, awaiting_payment, proof_received, paid_confirmed, payment_issue.",
          "Prefer not_discussed or awaiting_payment instead of method_selected; paymentMethod already captures selected cash/card/transfer.",
          "Only use paid_confirmed if the business explicitly confirms payment.",
          "If the customer asks what payment methods are accepted, set paymentInquiryDetected true but keep paymentMethod null until they choose one.",
          "Return exactly these keys when possible: items, quantity, deliveryDate, deliveryTime, address, paymentMethod, paymentStatus, paymentInquiryDetected, customRequests, missingFields, summary."
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
          "Summarize stable customer memory from this chat only.",
          "Only include facts supported by the text. Use null for unknown strings and [] for unknown arrays.",
          "Return strict JSON with exactly these keys: profileSummary, preferences, usualAddress, paymentBehavior, complaintHistory, repeatOrderPatterns, notes.",
          "profileSummary must be a short string or null.",
          "preferences, complaintHistory, repeatOrderPatterns, and notes must be arrays of strings.",
          "usualAddress and paymentBehavior must be strings or null."
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
          "If available products/menu context is provided, reference saved products and prices accurately.",
          "If a product has no price, do not invent one.",
          "If no products are saved and the customer asks for menu, explain that menu details need to be checked or added manually.",
          "The replies must be human-approved and must not be auto-sent.",
          "Prefer clarifying questions for missing order fields.",
          "Do not sound like the order is confirmed while required fields are missing.",
          "Do not say payment is confirmed unless the business explicitly confirmed payment.",
          "Return JSON only. No markdown. No explanation outside JSON.",
          "Return exactly this JSON shape: { \"suggestions\": [{ \"text\": \"...\", \"type\": \"clarifying_question\", \"reason\": \"...\" }] }.",
          "Every suggestion must include text, type, and reason.",
          "Use only these type values: clarifying_question, confirmation, menu_response, payment_followup, complaint_response, delivery_update, general."
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

  async generateText(text: string) {
    return this.provider.generate(
      [
        {
          role: "system",
          content: [
            "You are a safe development test endpoint for a WhatsApp food-order copilot.",
            "Return one concise text response.",
            "Never imply that messages should be auto-sent."
          ].join("\n")
        },
        {
          role: "user",
          content: text
        }
      ],
      {
        temperature: 0.2,
        maxTokens: 200,
        responseFormat: "text"
      }
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
      const parsed = extractJsonFromText(output);
      const result = schema.safeParse(parsed);

      if (!result.success) {
        const message = `${taskName} returned invalid JSON shape.`;
        this.fallbackWarnings.push(message);
        console.warn(
          `[AI] ${message} ${result.error.issues
            .map((issue) => issue.path.join(".") || issue.message)
            .join(", ")}`
        );
        return fallback;
      }

      return result.data;
    } catch (error) {
      const message = `${taskName} failed; used safe fallback.`;
      this.fallbackWarnings.push(message);
      console.warn(`[AI] ${message} ${safeErrorMessage(error)}`);
      return fallback;
    }
  }
}
