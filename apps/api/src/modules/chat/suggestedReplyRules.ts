import type {
  ManualChatAnalysis,
  SuggestedReplyDto
} from "./chat.schemas.js";

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

export function buildSuggestedReplies(
  analysis: Omit<ManualChatAnalysis, "suggestedReplies">
) {
  const replies: SuggestedReplyDto[] = [];
  const missingFields = new Set(analysis.order.missingFields);

  if (analysis.intent === "menu_request") {
    addReply(replies, {
      text: "Sure, I can share the menu. Are you looking for delivery on a specific date?",
      type: "menu_response",
      reason: "The customer appears to be asking for menu options."
    });
  }

  if (analysis.intent === "repeat_order") {
    addReply(replies, {
      text: "Sure, I can help with the same order. Please confirm the delivery date and time.",
      type: "confirmation",
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
      text: "Please send your delivery address/location so I can confirm availability.",
      type: "clarifying_question",
      reason: "The delivery address is missing."
    });
  }

  if (missingFields.has("paymentMethod") || missingFields.has("paymentStatus")) {
    addReply(replies, {
      text: "Once the order details are confirmed, I'll share the payment options.",
      type: "payment_followup",
      reason: "Payment is not complete or has not been discussed enough."
    });
  }

  if (analysis.orderLikely && missingFields.size === 0 && replies.length < 2) {
    addReply(replies, {
      text: "I have noted this as a scheduled delivery request. I'll confirm availability before finalizing it.",
      type: "confirmation",
      reason: "The customer appears to be placing a future delivery order."
    });
  }

  if (analysis.orderLikely && missingFields.size === 0 && replies.length < 3) {
    addReply(replies, {
      text: "Thanks, I have the order details. I'll confirm availability for your scheduled delivery.",
      type: "confirmation",
      reason: "The order details look mostly complete."
    });
  }

  if (analysis.orderLikely && missingFields.size > 0 && replies.length < 2) {
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
