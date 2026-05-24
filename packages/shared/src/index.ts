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
  "general"
]);

export const suggestedReplyDtoSchema = z.object({
  text: z.string(),
  type: suggestedReplyTypeSchema,
  reason: z.string()
});

export const manualChatAnalysisRequestSchema = z.object({
  chatName: z.string().trim().min(1),
  businessSenderNames: z.array(z.string().trim().min(1)).min(1),
  rawText: z.string().trim().min(1)
});

export const manualChatOrderAnalysisSchema = z.object({
  items: z.array(z.string()),
  quantity: z.number().int().positive().nullable(),
  deliveryDate: z.string().nullable(),
  deliveryTime: z.string().nullable(),
  address: z.string().nullable(),
  paymentMethod: z.string().nullable(),
  paymentStatus: paymentStatusSchema,
  customRequests: z.array(z.string()),
  missingFields: z.array(z.string()),
  summary: z.string()
});

export const manualChatAnalysisSchema = z.object({
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
