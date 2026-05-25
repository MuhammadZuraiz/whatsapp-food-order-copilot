import type {
  ManualChatAnalysis,
  SuggestedReplyDto
} from "./chat.schemas.js";
import type { MenuProductContext } from "./menuContext.js";

function addReply(
  replies: SuggestedReplyDto[],
  reply: SuggestedReplyDto,
  limit = 3
) {
  if (
    replies.length < limit &&
    !replies.some((existingReply) => existingReply.text === reply.text)
  ) {
    replies.push(reply);
  }
}

function productLabel(product: MenuProductContext) {
  return product.price === null
    ? product.name
    : `${product.name} (AED ${product.price})`;
}

function productsSummary(products: MenuProductContext[]) {
  return products.slice(0, 4).map(productLabel).join(", ");
}

function normalizeText(value: string) {
  return value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function findMatchedProduct(
  analysis: Omit<ManualChatAnalysis, "suggestedReplies">,
  products: MenuProductContext[]
) {
  const orderItems = analysis.order.items.map(normalizeText);

  return products.find((product) =>
    orderItems.includes(normalizeText(product.name))
  );
}

function isAvailableForPreorder(product: MenuProductContext) {
  return /\bavailable for pre-?order\b/i.test(product.availability ?? "");
}

function preorderPrefix(product: MenuProductContext | undefined) {
  return product && isAvailableForPreorder(product)
    ? `${product.name} is available for pre-order. `
    : "";
}

export function buildSuggestedReplies(
  analysis: Omit<ManualChatAnalysis, "suggestedReplies">,
  products: MenuProductContext[] = []
) {
  const replies: SuggestedReplyDto[] = [];
  const missingFields = new Set(analysis.order.missingFields);
  const hasMissingFields = missingFields.size > 0;
  const matchedProduct = findMatchedProduct(analysis, products);

  if (analysis.intent === "menu_request" && !analysis.orderLikely) {
    addReply(replies, {
      text:
        products.length > 0
          ? `Sure, our current menu includes ${productsSummary(products)}. Are you looking for delivery on a specific date?`
          : "I’ll check the current menu details and share them with you. Are you looking for delivery on a specific date?",
      type: "menu_response",
      reason:
        products.length > 0
          ? "The customer appears to be asking for menu options, and active products are available."
          : "The customer appears to be asking for menu options, but no active products are saved yet."
    });
  }

  if (
    ["price_question", "availability_question"].includes(analysis.intent) &&
    !analysis.orderLikely &&
    products.length > 0
  ) {
    addReply(replies, {
      text: `The current saved menu includes ${productsSummary(products)}. Please confirm which item and delivery date you’re considering.`,
      type: "menu_response",
      reason: "The customer is asking about menu details and active product context is available."
    });
  }

  if (
    analysis.intent === "repeat_order" &&
    (missingFields.has("deliveryDate") || missingFields.has("deliveryTime"))
  ) {
    const missingDateAndTime =
      missingFields.has("deliveryDate") && missingFields.has("deliveryTime");

    addReply(replies, {
      text: missingDateAndTime
        ? "Sure, I can help with the same order. Please confirm the delivery date and time."
        : missingFields.has("deliveryDate")
          ? "Sure, I can help with the same order. Which delivery date should I schedule it for?"
          : "Sure, I can help with the same order. What delivery time would you prefer?",
      type: "clarifying_question",
      reason: "The customer may be asking to repeat a previous order."
    });
  }

  if (missingFields.has("items")) {
    addReply(replies, {
      text: "Sure, what items would you like to order?",
      type: "clarifying_question",
      reason: "The order items are not clear yet."
    });
  }

  if (missingFields.has("quantity")) {
    addReply(replies, {
      text: "How many portions, boxes, or trays would you like?",
      type: "clarifying_question",
      reason: "The requested quantity is missing."
    });
  }

  if (missingFields.has("deliveryDate")) {
    addReply(replies, {
      text: "Sure, for which date would you like to schedule the delivery?",
      type: "clarifying_question",
      reason: "This business only supports future scheduled deliveries."
    });
  }

  if (missingFields.has("deliveryTime")) {
    addReply(replies, {
      text: "What delivery time would you prefer?",
      type: "clarifying_question",
      reason: "The delivery time is missing."
    });
  }

  if (missingFields.has("address")) {
    addReply(replies, {
      text: `${preorderPrefix(matchedProduct)}Please send your delivery address/location so I can continue.`,
      type: "clarifying_question",
      reason: "The delivery address is missing."
    });
  }

  if (missingFields.has("paymentMethod")) {
    addReply(replies, {
      text:
        missingFields.has("address") || !matchedProduct
          ? "Which payment method would you prefer: cash, card, or bank transfer?"
          : `${preorderPrefix(matchedProduct)}Which payment method would you prefer: cash, card, or bank transfer?`,
      type: "payment_followup",
      reason: "The payment method has not been selected yet."
    });
  } else if (missingFields.has("paymentStatus")) {
    addReply(replies, {
      text: analysis.order.paymentMethod
        ? `Payment by ${analysis.order.paymentMethod.replaceAll("_", " ")} is noted. Please send payment proof once it is completed so I can verify it.`
        : "Please send payment proof once payment is completed so I can verify it.",
      type: "payment_followup",
      reason: "Payment method is selected, but payment is not confirmed yet."
    });
  }

  if (analysis.orderLikely && !hasMissingFields && replies.length < 2) {
    addReply(replies, {
      text: "I have noted this as a scheduled delivery request. I'll confirm availability before finalizing it.",
      type: "confirmation",
      reason: "The customer appears to be placing a future delivery order."
    });
  }

  if (analysis.orderLikely && !hasMissingFields && replies.length < 3) {
    addReply(replies, {
      text: "Thanks, I have the order details. I'll confirm availability for your scheduled delivery.",
      type: "confirmation",
      reason: "The order details look mostly complete."
    });
  }

  if (analysis.orderLikely && hasMissingFields && replies.length < 2) {
    addReply(replies, {
      text: "Please share the missing details so I can review availability for your scheduled delivery.",
      type: "clarifying_question",
      reason: "The order is not ready to confirm while required fields are missing."
    });
  }

  if (!analysis.orderLikely && replies.length < 2) {
    addReply(replies, {
      text: "Please share the preferred delivery date and time when you are ready to order.",
      type: "clarifying_question",
      reason: "The business supports future deliveries only."
    });
  }

  if (replies.length === 0) {
    addReply(replies, {
      text: "Sure, how can I help with your food order?",
      type: "general",
      reason: "No specific order action was detected yet."
    });
  }

  return replies;
}
