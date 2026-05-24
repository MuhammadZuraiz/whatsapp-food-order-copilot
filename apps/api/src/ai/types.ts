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
  "general"
]);

export const intentClassificationResultSchema = z.object({
  intent: aiIntentSchema,
  confidence: z.number().min(0).max(1),
  orderLikely: z.boolean(),
  reason: z.string()
});

export const aiOrderExtractionResultSchema = z.object({
  items: z.array(z.string()),
  quantity: z.number().int().positive().nullable(),
  deliveryDate: z.string().nullable(),
  deliveryTime: z.string().nullable(),
  address: z.string().nullable(),
  paymentMethod: z.string().nullable(),
  paymentStatus: aiPaymentStatusSchema,
  customRequests: z.array(z.string()),
  missingFields: z.array(z.string()),
  summary: z.string()
});

export const customerMemoryUpdateResultSchema = z.object({
  shouldUpdate: z.boolean(),
  profileSummary: z.string().nullable(),
  usualAddress: z.string().nullable(),
  preferences: z.array(z.string()),
  notes: z.array(z.string())
});

export const aiSuggestedRepliesResultSchema = z.object({
  suggestedReplies: z.array(
    z.object({
      text: z.string(),
      type: aiSuggestedReplyTypeSchema,
      reason: z.string()
    })
  ),
  safety: z.object({
    requiresHumanApproval: z.literal(true),
    autoSendAllowed: z.literal(false)
  })
});

export const brandStyleAnalysisResultSchema = z.object({
  toneSummary: z.string(),
  commonPhrases: z.array(z.string()),
  doRules: z.array(z.string()),
  dontRules: z.array(z.string()),
  exampleReplies: z.array(z.string())
});

export const aiTestTaskSchema = z.enum([
  "classifyIntent",
  "extractOrder",
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
