import { AiService } from "../../ai/AiService.js";
import type { AiOrderExtractionResult } from "../../ai/types.js";
import type {
  ManualChatAnalysis,
  ManualChatOrderAnalysis,
  ParsedChatMessage,
  SuggestedReplyDto
} from "./chat.schemas.js";
import { normalizeOrderItems } from "./itemNormalizer.js";
import { buildMissingFields, buildSummary } from "./orderRuleExtractor.js";
import {
  detectPaymentInquiry,
  normalizePaymentStatusFromEvidence
} from "./paymentNormalizer.js";
import { buildSuggestedReplies } from "./suggestedReplyRules.js";

type AnalysisWithoutReplies = Omit<ManualChatAnalysis, "suggestedReplies">;
type AiTaskResult<T> = {
  value: T;
  usedFallback: boolean;
  warnings: string[];
};

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

function preferRuleValue<T>(ruleValue: T | null | undefined, aiValue: T | null | undefined) {
  return ruleValue ?? aiValue ?? null;
}

function normalizeQuantity(
  ruleQuantity: ManualChatOrderAnalysis["quantity"],
  aiQuantity: AiOrderExtractionResult["quantity"]
) {
  return ruleQuantity ?? aiQuantity ?? null;
}

function mergeOrder(
  ruleOrder: ManualChatOrderAnalysis,
  aiOrder: AiOrderExtractionResult,
  messages: ParsedChatMessage[]
): ManualChatOrderAnalysis {
  const inquiryDetected =
    ruleOrder.paymentInquiryDetected ??
    aiOrder.paymentInquiryDetected ??
    detectPaymentInquiry(messages);
  const paymentMethod = inquiryDetected
    ? ruleOrder.paymentMethod
    : preferRuleValue(ruleOrder.paymentMethod, aiOrder.paymentMethod);
  const items =
    ruleOrder.items.length > 0
      ? ruleOrder.items
      : normalizeOrderItems(aiOrder.items);
  const orderBase: Omit<ManualChatOrderAnalysis, "missingFields" | "summary"> = {
    items,
    quantity: normalizeQuantity(ruleOrder.quantity, aiOrder.quantity),
    deliveryDate: preferRuleValue(ruleOrder.deliveryDate, aiOrder.deliveryDate),
    deliveryTime: preferRuleValue(ruleOrder.deliveryTime, aiOrder.deliveryTime),
    address: preferRuleValue(ruleOrder.address, aiOrder.address),
    paymentMethod,
    paymentStatus: normalizePaymentStatusFromEvidence(
      ruleOrder.paymentStatus,
      aiOrder.paymentStatus,
      messages
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

function asksForResolvedField(reply: SuggestedReplyDto, missingFields: string[]) {
  const missing = new Set(missingFields);
  const text = reply.text.toLocaleLowerCase();

  if (
    !missing.has("deliveryDate") &&
    /\b(delivery date|which date|what date|for which date|preferred date)\b/.test(text)
  ) {
    return true;
  }

  if (
    !missing.has("deliveryTime") &&
    /\b(delivery time|what time|which time|preferred time|date and time)\b/.test(text)
  ) {
    return true;
  }

  if (!missing.has("address") && /\b(address|location)\b/.test(text)) {
    return true;
  }

  if (
    !missing.has("paymentMethod") &&
    /\b(payment methods?|payment options?|how would you like to pay|which payment|cash or|bank transfer or)\b/.test(
      text
    )
  ) {
    return true;
  }

  if (
    !missing.has("paymentStatus") &&
    /\b(payment proof|proof|screenshot|receipt|payment confirmation|payment completed)\b/.test(
      text
    )
  ) {
    return true;
  }

  return false;
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
      asksForResolvedField(reply, missingFields) ||
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

async function runAiTask<T>(
  task: (service: AiService) => Promise<T>
): Promise<AiTaskResult<T>> {
  const service = new AiService();
  const value = await task(service);

  return {
    value,
    usedFallback: service.usedFallback,
    warnings: service.warnings
  };
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
  const text = conversationText(messages);

  const [intentTask, orderTask, memoryTask] = await Promise.all([
    runAiTask((service) => service.classifyIntent(text)),
    runAiTask((service) => service.extractOrder(text)),
    runAiTask((service) => service.updateCustomerMemory(text))
  ]);
  const taskWarnings: string[] = [];

  if (intentTask.usedFallback) {
    taskWarnings.push(
      "Intent classification AI task failed; rule-based intent used."
    );
  }

  if (orderTask.usedFallback) {
    taskWarnings.push(
      "Order extraction AI task failed; rule-based extraction used."
    );
  }

  if (memoryTask.usedFallback) {
    taskWarnings.push(
      "Customer memory AI task failed; customerSummary was omitted."
    );
  }

  const criticalAiSucceeded =
    !intentTask.usedFallback || !orderTask.usedFallback;

  if (!criticalAiSucceeded) {
    return fallbackToRules(ruleAnalysis, [
      "Critical AI analysis tasks failed; returned rule-based fallback.",
      ...taskWarnings
    ]);
  }

  const mergedOrder = orderTask.usedFallback
    ? ruleAnalysis.order
    : mergeOrder(ruleAnalysis.order, orderTask.value, messages);
  const orderLikely =
    ruleAnalysis.orderLikely ||
    (!intentTask.usedFallback &&
      intentTask.value.orderLikely &&
      orderHasConcreteSignal(mergedOrder));
  const analysisWithoutReplies: AnalysisWithoutReplies = {
    source: "ai_assisted",
    customerSummary: memoryTask.usedFallback
      ? null
      : memoryTask.value.profileSummary,
    intent: orderLikely
      ? intentTask.usedFallback
        ? ruleAnalysis.intent
        : chooseIntent(ruleAnalysis, intentTask.value.intent, orderLikely)
      : ruleAnalysis.intent,
    orderLikely,
    order: orderLikely
      ? mergedOrder
      : {
          ...mergedOrder,
          missingFields: [],
          summary:
            ruleAnalysis.order.summary ||
            `Intent appears to be ${
              intentTask.usedFallback
                ? ruleAnalysis.intent.replaceAll("_", " ")
                : intentTask.value.intent.replaceAll("_", " ")
            }; no order record is likely yet.`
        },
    warnings: [...ruleAnalysis.warnings, ...taskWarnings]
  };

  const repliesTask = await runAiTask((service) =>
    service.generateSuggestedReplies(
      [
        "Use the backend-computed order fields below.",
        `Intent: ${analysisWithoutReplies.intent}`,
        `Order likely: ${analysisWithoutReplies.orderLikely}`,
        `Missing fields: ${analysisWithoutReplies.order.missingFields.join(", ") || "none"}`,
        `Order summary: ${analysisWithoutReplies.order.summary}`,
        "Chat text:",
        text
      ].join("\n")
    )
  );

  if (repliesTask.usedFallback) {
    return {
      ...analysisWithoutReplies,
      warnings: [
        ...analysisWithoutReplies.warnings,
        "Suggested replies AI task failed; template replies used."
      ],
      suggestedReplies: buildSuggestedReplies(analysisWithoutReplies)
    };
  }

  return {
    ...analysisWithoutReplies,
    suggestedReplies: sanitizeAiReplies(
      repliesTask.value.suggestedReplies,
      analysisWithoutReplies
    )
  };
}
