import { AiService } from "../../ai/AiService.js";
import type { AiOrderExtractionResult } from "../../ai/types.js";
import type { BrandStyleProfileDto } from "@wfo/shared";
import { formatBrandStyleContext } from "../brandStyle/brandStyle.service.js";
import {
  customerMemorySummary,
  formatCustomerMemoryContext,
  type CustomerMemoryContext
} from "../customers/customerMemory.js";
import type {
  ManualChatAnalysis,
  ManualChatOrderAnalysis,
  ParsedChatMessage,
  SuggestedReplyDto
} from "./chat.schemas.js";
import { normalizeOrderItems } from "./itemNormalizer.js";
import { buildMissingFields, buildSummary } from "./orderRuleExtractor.js";
import {
  formatMenuContext,
  type MenuProductContext
} from "./menuContext.js";
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

function isUnsafeConfirmation(
  reply: SuggestedReplyDto,
  order: ManualChatOrderAnalysis
) {
  const isFinalConfirmation =
    /\b(confirmed|finalized|booked|all set|your order is confirmed|order confirmed)\b/i.test(
      reply.text
    );

  if (!isFinalConfirmation) {
    return false;
  }

  return (
    order.missingFields.length > 0 || order.paymentStatus !== "paid_confirmed"
  );
}

function hasNearFinalConfirmationWording(text: string) {
  return /\b(confirm the order|order confirmed|proceed with (the |your )?order|finali[sz]e (the |your )?order|selected details|ready to confirm)\b/i.test(
    text
  );
}

function asksForPaymentStatusBeforeMethod(
  reply: SuggestedReplyDto,
  order: ManualChatOrderAnalysis
) {
  const missing = new Set(order.missingFields);

  return (
    missing.has("paymentMethod") &&
    /\b(payment proof|proof|receipt|screenshot|payment confirmation|payment completed|sent the payment|paid|transferred)\b/i.test(
      reply.text
    )
  );
}

function asksForResolvedField(
  reply: SuggestedReplyDto,
  order: ManualChatOrderAnalysis
) {
  const missingFields = order.missingFields;
  const missing = new Set(missingFields);
  const text = reply.text.toLocaleLowerCase();
  const onlyPaymentStatusMissing =
    missingFields.length === 1 && missing.has("paymentStatus");

  if (
    onlyPaymentStatusMissing &&
    !/\b(payment|pay|paid|proof|receipt|screenshot|confirm|transfer|cash|card)\b/.test(
      text
    )
  ) {
    return true;
  }

  if (asksForPaymentStatusBeforeMethod(reply, order)) {
    return true;
  }

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

function normalizeText(value: string) {
  return value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function hasAvailablePreorderProduct(
  order: ManualChatOrderAnalysis,
  products: MenuProductContext[]
) {
  return findAvailablePreorderProduct(order, products) !== null;
}

function findAvailablePreorderProduct(
  order: ManualChatOrderAnalysis,
  products: MenuProductContext[]
) {
  const orderItems = order.items.map(normalizeText);

  return (
    products.find(
      (product) =>
        orderItems.includes(normalizeText(product.name)) &&
        /\bavailable for pre-?order\b/i.test(product.availability ?? "")
    ) ?? null
  );
}

function buildClarifyingReplyForMissingFields(
  order: ManualChatOrderAnalysis,
  products: MenuProductContext[]
): SuggestedReplyDto {
  const missing = new Set(order.missingFields);
  const product = findAvailablePreorderProduct(order, products);
  const prefix = product ? `${product.name} is available for pre-order. ` : "";

  if (missing.has("address")) {
    return {
      text: `${prefix}Please send your delivery address/location so I can continue.`,
      type: "clarifying_question",
      reason: "Required order details are still missing."
    };
  }

  if (missing.has("paymentMethod")) {
    return {
      text: `${prefix}Which payment method would you prefer: cash, card, or bank transfer?`,
      type: "payment_followup",
      reason: "The payment method has not been selected yet."
    };
  }

  if (missing.has("paymentStatus")) {
    return {
      text: order.paymentMethod
        ? `Payment by ${order.paymentMethod.replaceAll("_", " ")} is noted. Please send payment proof once it is completed so I can verify it.`
        : "Which payment method would you prefer: cash, card, or bank transfer?",
      type: order.paymentMethod ? "payment_followup" : "clarifying_question",
      reason: order.paymentMethod
        ? "Payment method is selected, but payment is not confirmed yet."
        : "The payment method has not been selected yet."
    };
  }

  if (missing.has("deliveryDate")) {
    return {
      text: "Sure, for which date would you like to schedule the delivery?",
      type: "clarifying_question",
      reason: "This business only supports future scheduled deliveries."
    };
  }

  if (missing.has("deliveryTime")) {
    return {
      text: "What delivery time would you prefer?",
      type: "clarifying_question",
      reason: "The delivery time is missing."
    };
  }

  if (missing.has("quantity")) {
    return {
      text: "How many portions, boxes, or trays would you like?",
      type: "clarifying_question",
      reason: "The requested quantity is missing."
    };
  }

  return {
    text: "Sure, what items would you like to order?",
    type: "clarifying_question",
    reason: "The order items are not clear yet."
  };
}

function rewriteUnsafeMissingFieldReply(
  reply: SuggestedReplyDto,
  order: ManualChatOrderAnalysis,
  products: MenuProductContext[]
): SuggestedReplyDto {
  if (order.missingFields.length === 0) {
    return reply;
  }

  if (hasNearFinalConfirmationWording(reply.text)) {
    return buildClarifyingReplyForMissingFields(order, products);
  }

  if (reply.type === "confirmation") {
    return {
      ...reply,
      type: "clarifying_question",
      reason:
        reply.reason || "Required order details are still missing."
    };
  }

  return reply;
}

function asksForAddress(reply: SuggestedReplyDto) {
  return /\b(address|location)\b/i.test(reply.text);
}

function asksForPaymentMethod(reply: SuggestedReplyDto) {
  return (
    /\b(payment method|payment option|how would you like to pay|which payment|cash|card|bank transfer)\b/i.test(
      reply.text
    ) &&
    !/\b(payment proof|proof|receipt|screenshot|payment confirmation|payment completed|sent the payment|paid|transferred)\b/i.test(
      reply.text
    )
  );
}

function asksForPaymentStatus(reply: SuggestedReplyDto) {
  return /\b(payment proof|proof|receipt|screenshot|payment confirmation|payment completed|sent the payment|paid|transferred)\b/i.test(
    reply.text
  );
}

function asksForItems(reply: SuggestedReplyDto) {
  return /\b(items?|what would you like|usual|same|chicken biryani tray)\b/i.test(
    reply.text
  );
}

function addUniqueReply(
  replies: SuggestedReplyDto[],
  reply: SuggestedReplyDto | undefined
) {
  if (!reply || replies.some((existingReply) => existingReply.text === reply.text)) {
    return;
  }

  replies.push(reply);
}

function prioritizeMissingFieldReplies(
  safeAiReplies: SuggestedReplyDto[],
  templateReplies: SuggestedReplyDto[],
  order: ManualChatOrderAnalysis
) {
  if (order.missingFields.length === 0) {
    return [...safeAiReplies, ...templateReplies].filter(
      (reply, index, replies) =>
        replies.findIndex((existingReply) => existingReply.text === reply.text) ===
        index
    );
  }

  const missing = new Set(order.missingFields);
  const prioritizedReplies: SuggestedReplyDto[] = [];
  const preferredReplies = [...templateReplies, ...safeAiReplies];

  if (missing.has("items")) {
    addUniqueReply(prioritizedReplies, preferredReplies.find(asksForItems));
  }

  if (missing.has("address")) {
    addUniqueReply(prioritizedReplies, preferredReplies.find(asksForAddress));
  }

  if (missing.has("paymentMethod")) {
    addUniqueReply(
      prioritizedReplies,
      preferredReplies.find(asksForPaymentMethod)
    );
  } else if (missing.has("paymentStatus")) {
    addUniqueReply(
      prioritizedReplies,
      preferredReplies.find(asksForPaymentStatus)
    );
  }

  for (const reply of [...safeAiReplies, ...templateReplies]) {
    addUniqueReply(prioritizedReplies, reply);

    if (prioritizedReplies.length >= 3) {
      break;
    }
  }

  return prioritizedReplies;
}

function hasContradictoryAvailabilityReply(
  reply: SuggestedReplyDto,
  order: ManualChatOrderAnalysis,
  products: MenuProductContext[]
) {
  const text = reply.text.toLocaleLowerCase();

  return (
    hasAvailablePreorderProduct(order, products) &&
    /\bavailable\b/.test(text) &&
    /\b(need to|needs to|must|manual).{0,40}\bconfirm\b.{0,25}\bavailability\b|\bconfirm\b.{0,25}\bavailability\b/i.test(
      reply.text
    )
  );
}

function sanitizeAiReplies(
  aiReplies: SuggestedReplyDto[],
  analysisWithoutReplies: AnalysisWithoutReplies,
  products: MenuProductContext[],
  customerMemory: CustomerMemoryContext | null
) {
  const templateReplies = buildSuggestedReplies(
    analysisWithoutReplies,
    products,
    customerMemory
  );
  const safeAiReplies: SuggestedReplyDto[] = [];

  for (const reply of aiReplies) {
    const rewrittenReply = rewriteUnsafeMissingFieldReply(
      reply,
      analysisWithoutReplies.order,
      products
    );

    if (
      safeAiReplies.length >= 3 ||
      isUnsafeConfirmation(rewrittenReply, analysisWithoutReplies.order) ||
      asksForResolvedField(rewrittenReply, analysisWithoutReplies.order) ||
      hasContradictoryAvailabilityReply(
        rewrittenReply,
        analysisWithoutReplies.order,
        products
      ) ||
      safeAiReplies.some((existingReply) => existingReply.text === rewrittenReply.text)
    ) {
      continue;
    }

    safeAiReplies.push(rewrittenReply);
  }

  if (safeAiReplies.length === 0) {
    return {
      suggestedReplies: templateReplies,
      usedTemplateFallback: true
    };
  }

  const replies = prioritizeMissingFieldReplies(
    safeAiReplies,
    templateReplies,
    analysisWithoutReplies.order
  ).slice(0, 3);

  return {
    suggestedReplies: replies,
    usedTemplateFallback: false
  };
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
  warnings: string[],
  products: MenuProductContext[],
  customerMemory: CustomerMemoryContext | null
): ManualChatAnalysis {
  const fallbackAnalysis = {
    ...ruleAnalysis,
    source: "ai_fallback" as const,
    customerSummary: null,
    customerMemoryUsed: Boolean(customerMemory),
    customerMemorySummary: customerMemorySummary(customerMemory),
    warnings: [...ruleAnalysis.warnings, ...warnings]
  };

  return {
    ...fallbackAnalysis,
    suggestedReplies: buildSuggestedReplies(
      fallbackAnalysis,
      products,
      customerMemory
    )
  };
}

export async function buildAiAssistedAnalysis(
  messages: ParsedChatMessage[],
  ruleAnalysis: AnalysisWithoutReplies,
  products: MenuProductContext[] = [],
  brandStyle: BrandStyleProfileDto | null = null,
  customerMemory: CustomerMemoryContext | null = null
): Promise<ManualChatAnalysis> {
  const text = conversationText(messages);
  const menuContext = formatMenuContext(products);
  const brandStyleContext = formatBrandStyleContext(brandStyle);
  const customerMemoryContext = formatCustomerMemoryContext(customerMemory);
  const textWithMenuContext = [menuContext, "Chat text:", text].join("\n\n");

  const [intentTask, orderTask, memoryTask] = await Promise.all([
    runAiTask((service) => service.classifyIntent(textWithMenuContext)),
    runAiTask((service) => service.extractOrder(textWithMenuContext)),
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
    ], products, customerMemory);
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
    customerMemoryUsed: Boolean(customerMemory),
    customerMemorySummary: customerMemorySummary(customerMemory),
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
        menuContext,
        brandStyleContext,
        customerMemoryContext,
        "Use brand style for wording only. Do not let style override missing-field safety, product facts, or payment rules.",
        "Use customer memory only as advisory wording. Do not mark address, items, or timing complete unless the current chat confirms them.",
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
      suggestedReplies: buildSuggestedReplies(
        analysisWithoutReplies,
        products,
        customerMemory
      )
    };
  }

  const safeReplies = sanitizeAiReplies(
    repliesTask.value.suggestions,
    analysisWithoutReplies,
    products,
    customerMemory
  );

  if (safeReplies.usedTemplateFallback) {
    return {
      ...analysisWithoutReplies,
      warnings: [
        ...analysisWithoutReplies.warnings,
        "AI suggested replies were unsafe or incomplete; template replies used."
      ],
      suggestedReplies: safeReplies.suggestedReplies
    };
  }

  return {
    ...analysisWithoutReplies,
    suggestedReplies: safeReplies.suggestedReplies
  };
}
