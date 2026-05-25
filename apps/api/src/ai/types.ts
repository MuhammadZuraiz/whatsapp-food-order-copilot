import { z } from "zod";

export const aiMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string()
});

export const aiGenerateOptionsSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  responseFormat: z.enum(["text", "json"]).optional()
});

export const aiIntentSchema = z.enum([
  "menu_request",
  "price_question",
  "availability_question",
  "new_order",
  "repeat_order",
  "custom_request",
  "payment_question",
  "delivery_update",
  "complaint",
  "general_question"
]);

export const aiPaymentStatusSchema = z.enum([
  "not_discussed",
  "method_selected",
  "payment_details_sent",
  "awaiting_payment",
  "proof_received",
  "paid_confirmed",
  "payment_issue"
]);

export const aiSuggestedReplyTypeSchema = z.enum([
  "clarifying_question",
  "confirmation",
  "menu_response",
  "payment_followup",
  "complaint_response",
  "delivery_update",
  "general"
]);

const allowedSuggestedReplyTypes = aiSuggestedReplyTypeSchema.options;

export const intentClassificationResultSchema = z.object({
  intent: aiIntentSchema,
  confidence: z.number().min(0).max(1),
  orderLikely: z.boolean(),
  reason: z.string()
});

const nullableStringFromUnknownSchema = z.preprocess(
  (value) => (typeof value === "string" ? value : null),
  z.string().nullable()
);

const stringArrayFromUnknownSchema = z.preprocess(
  (value) =>
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [],
  z.array(z.string())
);

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeQuantity(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    const numericValue = Number(trimmed);

    if (Number.isFinite(numericValue) && numericValue > 0) {
      return Math.trunc(numericValue);
    }

    return trimmed || null;
  }

  return null;
}

function normalizePaymentStatus(value: unknown) {
  const status = typeof value === "string" ? value : "not_discussed";

  return aiPaymentStatusSchema.safeParse(status).success
    ? status
    : "not_discussed";
}

function normalizeOrderExtraction(value: unknown) {
  const source =
    isRecord(value) && isRecord(value.order) ? value.order : value;

  if (!isRecord(source)) {
    return {
      items: [],
      quantity: null,
      deliveryDate: null,
      deliveryTime: null,
      address: null,
      paymentMethod: null,
      paymentStatus: "not_discussed",
      paymentInquiryDetected: false,
      customRequests: [],
      missingFields: [],
      summary: "AI order extraction returned no usable object."
    };
  }

  return {
    items: normalizeStringArray(source.items),
    quantity: normalizeQuantity(source.quantity),
    deliveryDate: textFromUnknown(source.deliveryDate) || null,
    deliveryTime: textFromUnknown(source.deliveryTime) || null,
    address: textFromUnknown(source.address) || null,
    paymentMethod: textFromUnknown(source.paymentMethod) || null,
    paymentStatus: normalizePaymentStatus(source.paymentStatus),
    paymentInquiryDetected:
      typeof source.paymentInquiryDetected === "boolean"
        ? source.paymentInquiryDetected
        : undefined,
    customRequests: normalizeStringArray(source.customRequests),
    missingFields: normalizeStringArray(source.missingFields),
    summary:
      textFromUnknown(source.summary) ||
      "AI order extraction returned partial details."
  };
}

export const aiOrderExtractionResultSchema = z.preprocess(
  normalizeOrderExtraction,
  z.object({
    items: z.array(z.string()),
    quantity: z.union([z.number().int().positive(), z.string()]).nullable(),
    deliveryDate: z.string().nullable(),
    deliveryTime: z.string().nullable(),
    address: z.string().nullable(),
    paymentMethod: z.string().nullable(),
    paymentStatus: aiPaymentStatusSchema,
    paymentInquiryDetected: z.boolean().optional(),
    customRequests: z.array(z.string()),
    missingFields: z.array(z.string()),
    summary: z.string()
  })
);

export const customerMemoryUpdateResultSchema = z
  .object({
    profileSummary: nullableStringFromUnknownSchema,
    preferences: stringArrayFromUnknownSchema,
    usualAddress: nullableStringFromUnknownSchema,
    paymentBehavior: nullableStringFromUnknownSchema,
    complaintHistory: stringArrayFromUnknownSchema,
    repeatOrderPatterns: stringArrayFromUnknownSchema,
    notes: stringArrayFromUnknownSchema
  })
  .passthrough();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textFromUnknown(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function inferSuggestedReplyType(
  text: string,
  reason: string
): z.infer<typeof aiSuggestedReplyTypeSchema> {
  const combinedText = `${text} ${reason}`.toLocaleLowerCase();

  if (/\b(payment|pay|cash|card|transfer|paid|proof|receipt|screenshot)\b/.test(combinedText)) {
    return "payment_followup";
  }

  if (/\b(address|date|time|quantity|how many|confirm|please confirm)\b/.test(combinedText)) {
    return "clarifying_question";
  }

  if (/\b(menu|items?|available|availability|options)\b/.test(combinedText)) {
    return "menu_response";
  }

  if (/\b(sorry|issue|complaint|delay|late|problem)\b/.test(combinedText)) {
    return "complaint_response";
  }

  if (/\b(delivery update|driver|on the way|arriving|delivered)\b/.test(combinedText)) {
    return "delivery_update";
  }

  return "general";
}

function normalizeSuggestedReply(value: unknown) {
  if (typeof value === "string") {
    const text = value.trim();

    return text
      ? {
          text,
          type: inferSuggestedReplyType(text, ""),
          reason: "AI-generated suggestion."
        }
      : null;
  }

  if (!isRecord(value)) {
    return null;
  }

  const text = textFromUnknown(value.text);

  if (!text) {
    return null;
  }

  const reason =
    textFromUnknown(value.reason) || "AI-generated suggestion.";
  const providedType = textFromUnknown(value.type);
  const type = allowedSuggestedReplyTypes.includes(
    providedType as (typeof allowedSuggestedReplyTypes)[number]
  )
    ? (providedType as z.infer<typeof aiSuggestedReplyTypeSchema>)
    : inferSuggestedReplyType(text, reason);

  return {
    text,
    type,
    reason
  };
}

function getRawSuggestions(value: unknown) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!isRecord(value)) {
    return [];
  }

  for (const key of ["suggestions", "suggestedReplies", "replies"]) {
    const rawSuggestions = value[key];

    if (Array.isArray(rawSuggestions)) {
      return rawSuggestions;
    }
  }

  return [];
}

export const aiSuggestedRepliesResultSchema = z.preprocess(
  (value) => ({
    suggestions: getRawSuggestions(value)
      .map(normalizeSuggestedReply)
      .filter((reply): reply is NonNullable<ReturnType<typeof normalizeSuggestedReply>> => reply !== null)
      .slice(0, 3)
  }),
  z.object({
    suggestions: z
      .array(
        z.object({
          text: z.string().trim().min(1),
          type: aiSuggestedReplyTypeSchema,
          reason: z.string().trim().min(1)
        })
      )
      .min(1)
      .max(3)
  })
);

export const brandStyleAnalysisResultSchema = z.object({
  toneSummary: z.string(),
  commonPhrases: z.array(z.string()),
  doRules: z.array(z.string()),
  dontRules: z.array(z.string()),
  exampleReplies: z.array(z.string())
});

export const aiTestTaskSchema = z.enum([
  "generate",
  "classifyIntent",
  "extractOrder",
  "updateCustomerMemory",
  "generateSuggestedReplies",
  "analyzeBrandStyle"
]);

export const aiTestRequestSchema = z.object({
  task: aiTestTaskSchema,
  text: z.string().trim().min(1)
});

export type AiMessage = z.infer<typeof aiMessageSchema>;

export type AiGenerateOptions = z.infer<typeof aiGenerateOptionsSchema>;

export type AiProviderName = "mock" | "openai-compatible";

export type IntentClassificationResult = z.infer<
  typeof intentClassificationResultSchema
>;

export type AiOrderExtractionResult = z.infer<
  typeof aiOrderExtractionResultSchema
>;

export type CustomerMemoryUpdateResult = z.infer<
  typeof customerMemoryUpdateResultSchema
>;

export type AiSuggestedRepliesResult = z.infer<
  typeof aiSuggestedRepliesResultSchema
>;

export type BrandStyleAnalysisResult = z.infer<
  typeof brandStyleAnalysisResultSchema
>;

export type AiTestTask = z.infer<typeof aiTestTaskSchema>;

export type AiTestRequest = z.infer<typeof aiTestRequestSchema>;
