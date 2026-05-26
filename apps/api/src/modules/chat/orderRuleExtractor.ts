import type {
  ManualChatAnalysis,
  ManualChatOrderAnalysis,
  ParsedChatMessage
} from "./chat.schemas.js";
import { extractDeliveryDateFromMessages } from "./dateResolver.js";
import { extractItemsAndQuantityFromMessages } from "./itemNormalizer.js";
import type { MenuProductContext } from "./menuContext.js";
import {
  detectPaymentInquiry,
  extractPaymentMethod,
  extractPaymentStatus
} from "./paymentNormalizer.js";

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalize(text: string) {
  return text.toLocaleLowerCase();
}

function extractDeliveryTime(text: string) {
  const explicitTime = text.match(/\b(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b/i);

  if (explicitTime) {
    const [, hour, minute = "00", period] = explicitTime;
    return `${Number(hour)}:${minute} ${period.toLocaleUpperCase()}`;
  }

  const hour24Time = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);

  if (hour24Time) {
    return `${hour24Time[1]}:${hour24Time[2]}`;
  }

  const normalized = normalize(text);

  if (/\bdinner\b/.test(normalized)) {
    return "dinner";
  }

  if (/\blunch\b/.test(normalized)) {
    return "lunch";
  }

  if (/\bevening\b/.test(normalized)) {
    return "evening";
  }

  if (/\bmorning\b/.test(normalized)) {
    return "morning";
  }

  return null;
}

function extractAddress(messages: ParsedChatMessage[]) {
  const addressKeywordRegex =
    /\b(address|location|villa|building|apartment|flat|street|area|pin|maps?|location link)\b/i;

  const addressMessage = messages
    .filter((message) => message.senderType === "customer")
    .find(
      (message) =>
        addressKeywordRegex.test(message.text) &&
        !/\b(usual|same|last time|saved)\s+(address|location)\b|\b(address|location)\s+(as usual|same as last time|on file)\b/i.test(
          message.text
        )
    );

  return addressMessage?.text.trim() ?? null;
}

function extractCustomRequests(customerText: string) {
  const requestRegex =
    /\b(less spicy|spicy|no onion|no mayo|extra [a-z]+|without [a-z]+|allergy|custom|special request)\b/gi;

  return unique(
    [...customerText.matchAll(requestRegex)].map((match) =>
      match[1].toLocaleLowerCase()
    )
  );
}

function determineIntent(
  allText: string,
  customerText: string,
  hasQuantityOrItems: boolean,
  hasCustomRequests: boolean
): ManualChatAnalysis["intent"] {
  if (/\b(complaint|wrong|late|issue|problem|cold|missing item|not good)\b/i.test(allText)) {
    return "complaint";
  }

  if (
    /\b(same as usual|same order|same as last(?: time)?|like last time|last time|repeat order|repeat|order again|again|usual)\b/i.test(
      customerText
    )
  ) {
    return "repeat_order";
  }

  if (
    /\b(order|place an order|book|deliver|delivery|need|want|would like|can i get)\b/i.test(
      customerText
    ) &&
    hasQuantityOrItems
  ) {
    return "new_order";
  }

  if (hasCustomRequests) {
    return "custom_request";
  }

  if (/\b(payment|pay|cash|card|bank transfer|transfer|receipt)\b/i.test(allText)) {
    return "payment_question";
  }

  if (/\b(price|cost|how much|rate)\b/i.test(customerText)) {
    return "price_question";
  }

  if (/\b(available|availability|do you have|can you make)\b/i.test(customerText)) {
    return "availability_question";
  }

  if (/\b(menu|catalog|options)\b/i.test(customerText)) {
    return "menu_request";
  }

  if (/\b(delivery|deliver|address|location|time)\b/i.test(customerText)) {
    return "delivery_update";
  }

  return "general_question";
}

export function buildMissingFields(order: ManualChatOrderAnalysis) {
  const missingFields: string[] = [];

  if (order.items.length === 0) {
    missingFields.push("items");
  }

  if (!order.quantity) {
    missingFields.push("quantity");
  }

  if (!order.deliveryDate) {
    missingFields.push("deliveryDate");
  }

  if (!order.deliveryTime) {
    missingFields.push("deliveryTime");
  }

  if (!order.address) {
    missingFields.push("address");
  }

  if (!order.paymentMethod) {
    missingFields.push("paymentMethod");
  }

  if (!["proof_received", "paid_confirmed"].includes(order.paymentStatus)) {
    missingFields.push("paymentStatus");
  }

  return missingFields;
}

export function buildSummary(
  order: Omit<ManualChatOrderAnalysis, "missingFields" | "summary">
) {
  const parts = [
    order.items.length > 0 ? `Items: ${order.items.join(", ")}` : "Items not clear",
    order.quantity ? `quantity ${order.quantity}` : "quantity missing",
    order.deliveryDate ? "delivery date captured" : "delivery date missing",
    order.deliveryTime ? `delivery time ${order.deliveryTime}` : "delivery time missing",
    order.address ? "address captured" : "address missing",
    order.paymentMethod ? `payment by ${order.paymentMethod}` : "payment method missing",
    `payment status ${order.paymentStatus}`
  ];

  return parts.join("; ");
}

export function extractOrderRules(
  messages: ParsedChatMessage[],
  parserWarnings: string[],
  products: MenuProductContext[] = []
): Omit<ManualChatAnalysis, "suggestedReplies"> {
  const customerText = messages
    .filter((message) => message.senderType === "customer")
    .map((message) => message.text)
    .join("\n");
  const allText = messages.map((message) => message.text).join("\n");
  const itemsAndQuantity = extractItemsAndQuantityFromMessages(messages, products);
  const customRequests = extractCustomRequests(customerText);
  const deliveryDate = extractDeliveryDateFromMessages(messages);
  const deliveryTime = extractDeliveryTime(customerText);
  const paymentInquiryDetected = detectPaymentInquiry(messages);
  const paymentMethod = extractPaymentMethod(messages);
  const paymentStatus = extractPaymentStatus(messages, paymentMethod);
  const hasQuantityOrItems =
    itemsAndQuantity.items.length > 0 || itemsAndQuantity.quantity !== null;
  const intent = determineIntent(
    allText,
    customerText,
    hasQuantityOrItems,
    customRequests.length > 0
  );
  const orderLikely =
    ["new_order", "repeat_order", "custom_request"].includes(intent) ||
    (hasQuantityOrItems && Boolean(deliveryDate || deliveryTime));

  const orderBase = {
    items: itemsAndQuantity.items,
    quantity: itemsAndQuantity.quantity,
    deliveryDate,
    deliveryTime,
    address: extractAddress(messages),
    paymentMethod,
    paymentStatus,
    paymentInquiryDetected,
    customRequests
  };
  const missingFields = orderLikely
    ? buildMissingFields({
        ...orderBase,
        missingFields: [],
        summary: ""
      })
    : [];
  const order: ManualChatOrderAnalysis = {
    ...orderBase,
    missingFields,
    summary: orderLikely
      ? buildSummary(orderBase)
      : `Intent appears to be ${intent.replaceAll("_", " ")}; no order record is likely yet.`
  };

  return {
    source: "rule_based",
    customerSummary: null,
    intent,
    orderLikely,
    order,
    warnings: parserWarnings
  };
}
