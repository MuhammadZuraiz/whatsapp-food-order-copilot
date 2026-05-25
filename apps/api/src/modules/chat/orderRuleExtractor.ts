import type {
  ManualChatAnalysis,
  ManualChatOrderAnalysis,
  ParsedChatMessage,
  PaymentStatus
} from "./chat.schemas.js";

const foodKeywords = [
  "biryani",
  "pasta",
  "cake",
  "rice",
  "chicken",
  "beef",
  "dessert",
  "platter",
  "meal",
  "tray",
  "trays",
  "box",
  "boxes"
];

const numberWords = new Map([
  ["one", 1],
  ["two", 2],
  ["three", 3],
  ["four", 4],
  ["five", 5],
  ["six", 6],
  ["seven", 7],
  ["eight", 8],
  ["nine", 9],
  ["ten", 10]
]);

const monthIndexes = new Map([
  ["jan", 0],
  ["january", 0],
  ["feb", 1],
  ["february", 1],
  ["mar", 2],
  ["march", 2],
  ["apr", 3],
  ["april", 3],
  ["may", 4],
  ["jun", 5],
  ["june", 5],
  ["jul", 6],
  ["july", 6],
  ["aug", 7],
  ["august", 7],
  ["sep", 8],
  ["sept", 8],
  ["september", 8],
  ["oct", 9],
  ["october", 9],
  ["nov", 10],
  ["november", 10],
  ["dec", 11],
  ["december", 11]
]);

const weekdayIndexes = new Map([
  ["sunday", 0],
  ["monday", 1],
  ["tuesday", 2],
  ["wednesday", 3],
  ["thursday", 4],
  ["friday", 5],
  ["saturday", 6]
]);

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalize(text: string) {
  return text.toLocaleLowerCase();
}

function parseQuantityValue(value: string) {
  const normalized = normalize(value);
  return numberWords.get(normalized) ?? Number(normalized);
}

function dateAtStartOfDay(date: Date) {
  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);
  return normalizedDate.toISOString();
}

function nextWeekday(dayIndex: number) {
  const date = new Date();
  const today = date.getDay();
  const daysUntilTarget = (dayIndex - today + 7) % 7 || 7;
  date.setDate(date.getDate() + daysUntilTarget);
  return dateAtStartOfDay(date);
}

function parseNumericDate(text: string) {
  const match = text.match(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b/);

  if (!match) {
    return null;
  }

  const [, dayText, monthText, yearText] = match;
  const now = new Date();
  const year = yearText
    ? yearText.length === 2
      ? Number(`20${yearText}`)
      : Number(yearText)
    : now.getFullYear();
  const date = new Date(year, Number(monthText) - 1, Number(dayText));

  return Number.isNaN(date.getTime()) ? null : dateAtStartOfDay(date);
}

function parseTextualDate(text: string) {
  const match = text.match(
    /\b(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i
  );

  if (!match) {
    return null;
  }

  const [, dayText, monthText] = match;
  const monthIndex = monthIndexes.get(normalize(monthText));

  if (monthIndex === undefined) {
    return null;
  }

  const date = new Date(new Date().getFullYear(), monthIndex, Number(dayText));

  return Number.isNaN(date.getTime()) ? null : dateAtStartOfDay(date);
}

function extractDeliveryDate(text: string) {
  const normalized = normalize(text);

  if (/\btomorrow\b/.test(normalized)) {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return dateAtStartOfDay(date);
  }

  if (/\btoday\b/.test(normalized)) {
    return dateAtStartOfDay(new Date());
  }

  const numericDate = parseNumericDate(normalized);

  if (numericDate) {
    return numericDate;
  }

  const textualDate = parseTextualDate(text);

  if (textualDate) {
    return textualDate;
  }

  for (const [weekday, index] of weekdayIndexes) {
    if (new RegExp(`\\b${weekday}\\b`, "i").test(text)) {
      return nextWeekday(index);
    }
  }

  return null;
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

function extractItemsAndQuantity(customerText: string) {
  const items: string[] = [];
  let quantity: number | null = null;
  const keywordPattern = [...foodKeywords]
    .sort((left, right) => right.length - left.length)
    .join("|");
  const quantityItemRegex = new RegExp(
    `\\b(\\d+|one|two|three|four|five|six|seven|eight|nine|ten)\\s+(?:x\\s+)?((?:${keywordPattern})(?:\\s+(?:${keywordPattern})){0,4})`,
    "gi"
  );

  for (const match of customerText.matchAll(quantityItemRegex)) {
    quantity ??= parseQuantityValue(match[1]);
    items.push(match[2]);
  }

  const itemRegex = new RegExp(
    "\\b(chicken biryani|beef biryani|biryani|pasta|cake|rice|chicken|beef|dessert|platter|meal)\\b",
    "gi"
  );

  for (const match of customerText.matchAll(itemRegex)) {
    items.push(match[1]);
  }

  return {
    items: unique(items),
    quantity: Number.isFinite(quantity) ? quantity : null
  };
}

function extractAddress(messages: ParsedChatMessage[]) {
  const addressKeywordRegex =
    /\b(address|location|villa|building|apartment|flat|street|area|pin|maps?|location link)\b/i;

  const addressMessage = messages
    .filter((message) => message.senderType === "customer")
    .find((message) => addressKeywordRegex.test(message.text));

  return addressMessage?.text.trim() ?? null;
}

function extractCustomRequests(customerText: string) {
  const requestRegex =
    /\b(less spicy|spicy|no onion|no mayo|extra [a-z]+|without [a-z]+|allergy|custom|special request)\b/gi;

  return unique([...customerText.matchAll(requestRegex)].map((match) => match[1]));
}

function detectPaymentInquiry(customerText: string) {
  return /\b(what|which|how|do you|can i|can we).{0,60}\b(payment|pay|cash|card|transfer|methods?|options?|accept)\b/i.test(
    customerText
  ) || /\b(payment methods?|payment options?|how should i pay)\b/i.test(customerText);
}

function customerSelectedPaymentMethod(customerText: string) {
  return /\b(i can pay|i will pay|i'll pay|i would like to pay|pay by|pay via|cash is fine|cash works|transfer is fine|bank transfer is fine|card is fine|i prefer)\b/i.test(
    customerText
  );
}

function extractPaymentMethod(customerText: string) {
  const normalized = normalize(customerText);

  if (detectPaymentInquiry(customerText) && !customerSelectedPaymentMethod(customerText)) {
    return null;
  }

  if (/\bbank transfer\b|\btransfer\b/.test(normalized)) {
    return "bank_transfer";
  }

  if (/\bcash\b/.test(normalized)) {
    return "cash";
  }

  if (/\bcard\b/.test(normalized)) {
    return "card";
  }

  return null;
}

function extractPaymentStatus(
  customerText: string,
  businessText: string,
  allText: string,
  paymentMethod: string | null,
  paymentInquiryDetected: boolean
): PaymentStatus {
  if (/\b(payment failed|payment issue|declined|not received)\b/i.test(allText)) {
    return "payment_issue";
  }

  if (
    /\b(payment confirmed|payment received|received your payment|payment has been received)\b/i.test(
      businessText
    )
  ) {
    return "paid_confirmed";
  }

  if (
    /\b(paid|sent payment|payment sent|sent the payment|transferred|screenshot attached|screenshot|receipt|proof)\b/i.test(
      customerText
    )
  ) {
    return "proof_received";
  }

  if (
    /\b(payment details|bank details|account|iban|please transfer|send payment)\b/i.test(
      businessText
    )
  ) {
    return "payment_details_sent";
  }

  if (/\b(awaiting payment|payment pending|pending payment)\b/i.test(allText)) {
    return "awaiting_payment";
  }

  if (paymentMethod) {
    return "method_selected";
  }

  if (paymentInquiryDetected) {
    return "not_discussed";
  }

  return "not_discussed";
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

  if (/\b(same order|same as last|last time|repeat|again)\b/i.test(customerText)) {
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
  parserWarnings: string[]
): Omit<ManualChatAnalysis, "suggestedReplies"> {
  const customerText = messages
    .filter((message) => message.senderType === "customer")
    .map((message) => message.text)
    .join("\n");
  const businessText = messages
    .filter((message) => message.senderType === "business")
    .map((message) => message.text)
    .join("\n");
  const allText = messages.map((message) => message.text).join("\n");
  const itemsAndQuantity = extractItemsAndQuantity(customerText);
  const customRequests = extractCustomRequests(customerText);
  const deliveryDate = extractDeliveryDate(customerText);
  const deliveryTime = extractDeliveryTime(customerText);
  const paymentInquiryDetected = detectPaymentInquiry(customerText);
  const paymentMethod = extractPaymentMethod(customerText);
  const paymentStatus = extractPaymentStatus(
    customerText,
    businessText,
    allText,
    paymentMethod,
    paymentInquiryDetected
  );
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
