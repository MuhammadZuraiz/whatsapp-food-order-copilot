import { z } from "zod";

export const appHealthSchema = z.object({
  status: z.literal("ok"),
  service: z.string(),
  timestamp: z.string().datetime()
});

export type AppHealth = z.infer<typeof appHealthSchema>;

export type DeliveryMode = "future_delivery";

export type HumanApprovalMode = "required";

export const senderTypeSchema = z.enum(["customer", "business", "unknown"]);

export const parsedChatMessageSchema = z.object({
  senderName: z.string().nullable(),
  senderType: senderTypeSchema,
  text: z.string(),
  timestamp: z.string().nullable(),
  raw: z.string()
});

export const analysisIntentSchema = z.enum([
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

export const paymentStatusSchema = z.enum([
  "not_discussed",
  "method_selected",
  "payment_details_sent",
  "awaiting_payment",
  "proof_received",
  "paid_confirmed",
  "payment_issue"
]);

export const suggestedReplyTypeSchema = z.enum([
  "clarifying_question",
  "confirmation",
  "menu_response",
  "payment_followup",
  "complaint_response",
  "delivery_update",
  "general"
]);

export const manualChatAnalysisSourceSchema = z.enum([
  "rule_based",
  "ai_assisted",
  "ai_fallback"
]);

export const suggestedReplyDtoSchema = z.object({
  text: z.string(),
  type: suggestedReplyTypeSchema,
  reason: z.string()
});

export const manualChatAnalysisRequestSchema = z.object({
  chatName: z.string().trim().min(1),
  customerKey: z.string().trim().min(1).optional(),
  customerPhone: z.string().trim().min(1).optional(),
  businessSenderNames: z.array(z.string().trim().min(1)).min(1),
  rawText: z.string().trim().min(1),
  useAi: z.boolean().optional()
});

export const manualChatOrderAnalysisSchema = z.object({
  items: z.array(z.string()),
  quantity: z.union([z.number().int().positive(), z.string()]).nullable(),
  deliveryDate: z.string().nullable(),
  deliveryTime: z.string().nullable(),
  address: z.string().nullable(),
  paymentMethod: z.string().nullable(),
  paymentStatus: paymentStatusSchema,
  paymentInquiryDetected: z.boolean().optional(),
  customRequests: z.array(z.string()),
  missingFields: z.array(z.string()),
  summary: z.string()
});

export const manualChatAnalysisSchema = z.object({
  source: manualChatAnalysisSourceSchema,
  customerSummary: z.string().nullable(),
  intent: analysisIntentSchema,
  orderLikely: z.boolean(),
  order: manualChatOrderAnalysisSchema,
  suggestedReplies: z.array(suggestedReplyDtoSchema),
  warnings: z.array(z.string())
});

export const manualChatAnalysisResponseSchema = z.object({
  conversation: z.object({
    id: z.string(),
    chatName: z.string(),
    source: z.literal("manual_paste")
  }),
  messages: z.array(parsedChatMessageSchema),
  analysis: manualChatAnalysisSchema
});

export type SenderType = z.infer<typeof senderTypeSchema>;

export type ParsedChatMessage = z.infer<typeof parsedChatMessageSchema>;

export type AnalysisIntent = z.infer<typeof analysisIntentSchema>;

export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export type SuggestedReplyType = z.infer<typeof suggestedReplyTypeSchema>;

export type ManualChatAnalysisSource = z.infer<
  typeof manualChatAnalysisSourceSchema
>;

export type SuggestedReplyDto = z.infer<typeof suggestedReplyDtoSchema>;

export type ManualChatAnalysisRequest = z.infer<
  typeof manualChatAnalysisRequestSchema
>;

export type ManualChatOrderAnalysis = z.infer<
  typeof manualChatOrderAnalysisSchema
>;

export type ManualChatAnalysis = z.infer<typeof manualChatAnalysisSchema>;

export type ManualChatAnalysisResponse = z.infer<
  typeof manualChatAnalysisResponseSchema
>;
