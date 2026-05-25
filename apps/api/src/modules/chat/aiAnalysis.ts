import { AiService } from "../../ai/AiService.js";
import type { AiOrderExtractionResult } from "../../ai/types.js";
import type {
  ManualChatAnalysis,
  ManualChatOrderAnalysis,
  PaymentStatus,
  ParsedChatMessage,
  SuggestedReplyDto
} from "./chat.schemas.js";
import { buildMissingFields, buildSummary } from "./orderRuleExtractor.js";
import { buildSuggestedReplies } from "./suggestedReplyRules.js";

type AnalysisWithoutReplies = Omit<ManualChatAnalysis, "suggestedReplies">;

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function conversationText(messages: ParsedChatMessage[]) {
  return messages
    .map((message) => {
      const sender = message.senderName ?? message.senderType;
      return `${sender} (${message.senderType}): ${message.text}`;
    })
    .join("\n");
}

function businessText(messages: ParsedChatMessage[]) {
  return messages
    .filter((message) => message.senderType === "business")
    .map((message) => message.text)
    .join("\n");
}

function customerText(messages: ParsedChatMessage[]) {
  return messages
    .filter((message) => message.senderType === "customer")
    .map((message) => message.text)
    .join("\n");
}

function hasBusinessPaymentConfirmation(messages: ParsedChatMessage[]) {
  return /\b(payment confirmed|payment received|received your payment|payment has been received)\b/i.test(
    businessText(messages)
  );
}

function hasCustomerPaymentProof(messages: ParsedChatMessage[]) {
  return /\b(paid|sent payment|sent the payment|transferred|screenshot attached|screenshot|receipt|proof)\b/i.test(
    customerText(messages)
  );
}

function paymentInquiryDetected(messages: ParsedChatMessage[]) {
  const text = customerText(messages);

  return (
    /\b(what|which|how|do you|can i|can we).{0,60}\b(payment|pay|cash|card|transfer|methods?|options?|accept)\b/i.test(
      text
    ) || /\b(payment methods?|payment options?|how should i pay)\b/i.test(text)
  );
}

function preferRuleValue<T>(ruleValue: T | null | undefined, aiValue: T | null | undefined) {
  return ruleValue ?? aiValue ?? null;
}

function normalizeQuantity(
  ruleQuantity: ManualChatOrderAnalysis["quantity"],
  aiQuantity: AiOrderExtractionResult["quantity"]
) {
  return ruleQuantity ?? aiQuantity ?? null;
}

function normalizePaymentStatus(
  ruleStatus: ManualChatOrderAnalysis["paymentStatus"],
  aiStatus: AiOrderExtractionResult["paymentStatus"],
  messages: ParsedChatMessage[],
  paymentMethod: string | null
): PaymentStatus {
  if (hasBusinessPaymentConfirmation(messages)) {
    return "paid_confirmed";
  }

  if (hasCustomerPaymentProof(messages)) {
    return "proof_received";
  }

  if (aiStatus === "paid_confirmed" || ruleStatus === "paid_confirmed") {
    return "not_discussed";
  }

  if (ruleStatus === "payment_details_sent" || aiStatus === "payment_details_sent") {
    return "payment_details_sent";
  }

  if (ruleStatus === "awaiting_payment" || aiStatus === "awaiting_payment") {
    return "awaiting_payment";
  }

  if (paymentMethod) {
    return "method_selected";
  }

  if (ruleStatus === "payment_issue" || aiStatus === "payment_issue") {
    return "payment_issue";
  }

  return "not_discussed";
}

function mergeOrder(
  ruleOrder: ManualChatOrderAnalysis,
  aiOrder: AiOrderExtractionResult,
  messages: ParsedChatMessage[]
): ManualChatOrderAnalysis {
  const inquiryDetected =
    ruleOrder.paymentInquiryDetected ??
    aiOrder.paymentInquiryDetected ??
    paymentInquiryDetected(messages);
  const paymentMethod = inquiryDetected
    ? ruleOrder.paymentMethod
    : preferRuleValue(ruleOrder.paymentMethod, aiOrder.paymentMethod);
  const orderBase: Omit<ManualChatOrderAnalysis, "missingFields" | "summary"> = {
    items: unique([...ruleOrder.items, ...aiOrder.items]),
    quantity: normalizeQuantity(ruleOrder.quantity, aiOrder.quantity),
    deliveryDate: preferRuleValue(ruleOrder.deliveryDate, aiOrder.deliveryDate),
    deliveryTime: preferRuleValue(ruleOrder.deliveryTime, aiOrder.deliveryTime),
    address: preferRuleValue(ruleOrder.address, aiOrder.address),
    paymentMethod,
    paymentStatus: normalizePaymentStatus(
      ruleOrder.paymentStatus,
      aiOrder.paymentStatus,
      messages,
      paymentMethod
    ),
    paymentInquiryDetected: inquiryDetected,
    customRequests: unique([
      ...ruleOrder.customRequests,
      ...aiOrder.customRequests
    ])
  };
  const missingFields = buildMissingFields({
    ...orderBase,
    missingFields: [],
    summary: ""
  });

  return {
    ...orderBase,
    missingFields,
    summary: buildSummary(orderBase)
  };
}

function orderHasConcreteSignal(order: ManualChatOrderAnalysis) {
  return (
    order.items.length > 0 ||
    Boolean(order.quantity) ||
    Boolean(order.deliveryDate) ||
    Boolean(order.deliveryTime) ||
    Boolean(order.address) ||
    order.customRequests.length > 0
  );
}

function chooseIntent(
  ruleAnalysis: AnalysisWithoutReplies,
  aiIntent: ManualChatAnalysis["intent"],
  orderLikely: boolean
) {
  const inquiryIntents: Array<ManualChatAnalysis["intent"]> = [
    "menu_request",
    "price_question",
    "availability_question",
    "payment_question",
    "general_question"
  ];

  if (
    orderLikely &&
    ruleAnalysis.orderLikely &&
    inquiryIntents.includes(aiIntent)
  ) {
    return ruleAnalysis.intent;
  }

  return aiIntent;
}

function isUnsafeConfirmation(reply: SuggestedReplyDto, missingFields: string[]) {
  return (
    missingFields.length > 0 &&
    /\b(confirmed|finalized|booked|all set|your order is confirmed|order confirmed)\b/i.test(
      reply.text
    )
  );
}

function sanitizeAiReplies(
  aiReplies: SuggestedReplyDto[],
  analysisWithoutReplies: AnalysisWithoutReplies
) {
  const templateReplies = buildSuggestedReplies(analysisWithoutReplies);
  const missingFields = analysisWithoutReplies.order.missingFields;
  const replies: SuggestedReplyDto[] =
    missingFields.length > 0 ? templateReplies.slice(0, 1) : [];

  for (const reply of aiReplies) {
    if (
      replies.length >= 3 ||
      isUnsafeConfirmation(reply, missingFields) ||
      replies.some((existingReply) => existingReply.text === reply.text)
    ) {
      continue;
    }

    replies.push(reply);
  }

  for (const reply of templateReplies) {
    if (
      replies.length >= 3 ||
      replies.some((existingReply) => existingReply.text === reply.text)
    ) {
      continue;
    }

    replies.push(reply);
  }

  return replies;
}

function fallbackToRules(
  ruleAnalysis: AnalysisWithoutReplies,
  warnings: string[]
): ManualChatAnalysis {
  const fallbackAnalysis = {
    ...ruleAnalysis,
    source: "ai_fallback" as const,
    customerSummary: null,
    warnings: [...ruleAnalysis.warnings, ...warnings]
  };

  return {
    ...fallbackAnalysis,
    suggestedReplies: buildSuggestedReplies(fallbackAnalysis)
  };
}

export async function buildAiAssistedAnalysis(
  messages: ParsedChatMessage[],
  ruleAnalysis: AnalysisWithoutReplies
): Promise<ManualChatAnalysis> {
  const service = new AiService();
  const text = conversationText(messages);

  const [intentResult, aiOrder, memoryResult] = await Promise.all([
    service.classifyIntent(text),
    service.extractOrder(text),
    service.updateCustomerMemory(text)
  ]);

  if (service.usedFallback) {
    return fallbackToRules(ruleAnalysis, [
      "AI analysis failed; returned rule-based fallback.",
      ...service.warnings
    ]);
  }

  const mergedOrder = mergeOrder(ruleAnalysis.order, aiOrder, messages);
  const orderLikely =
    ruleAnalysis.orderLikely ||
    (intentResult.orderLikely && orderHasConcreteSignal(mergedOrder));
  const analysisWithoutReplies: AnalysisWithoutReplies = {
    source: "ai_assisted",
    customerSummary: memoryResult.profileSummary,
    intent: orderLikely
      ? chooseIntent(ruleAnalysis, intentResult.intent, orderLikely)
      : ruleAnalysis.intent,
    orderLikely,
    order: orderLikely
      ? mergedOrder
      : {
          ...mergedOrder,
          missingFields: [],
          summary:
            ruleAnalysis.order.summary ||
            `Intent appears to be ${intentResult.intent.replaceAll("_", " ")}; no order record is likely yet.`
        },
    warnings: ruleAnalysis.warnings
  };

  const repliesResult = await service.generateSuggestedReplies(
    [
      "Use the backend-computed order fields below.",
      `Intent: ${analysisWithoutReplies.intent}`,
      `Order likely: ${analysisWithoutReplies.orderLikely}`,
      `Missing fields: ${analysisWithoutReplies.order.missingFields.join(", ") || "none"}`,
      `Order summary: ${analysisWithoutReplies.order.summary}`,
      "Chat text:",
      text
    ].join("\n")
  );

  if (service.usedFallback) {
    return fallbackToRules(ruleAnalysis, [
      "AI suggested reply generation failed; returned rule-based fallback.",
      ...service.warnings
    ]);
  }

  return {
    ...analysisWithoutReplies,
    suggestedReplies: sanitizeAiReplies(
      repliesResult.suggestedReplies,
      analysisWithoutReplies
    )
  };
}
