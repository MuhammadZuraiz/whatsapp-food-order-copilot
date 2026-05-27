import type {
  ManualChatAnalysis,
  ParsedChatMessage,
  SuggestedReplyDto
} from "./chat.schemas.js";
import type { CustomerMemoryContext } from "../customers/customerMemory.js";
import type { MenuProductContext } from "./menuContext.js";

const repeatOrderRegex =
  /\b(same as usual|same order|same as last(?: time)?|like last time|last time|repeat order|repeat|order again|again|usual)\b/i;

const foodBusinessRegex =
  /\b(menu|order|food|meal|tray|box|platter|biryani|pasta|rice|chicken|beef|cake|dessert|delivery|deliver|tomorrow|today|lunch|dinner|evening|morning|price|cost|rate|available|availability|payment|pay|cash|card|bank transfer|transfer|receipt|screenshot|paid)\b/i;

const nearFinalOrderRegex =
  /\b(proceed|confirm the order|order confirmed|your order is confirmed|ready to confirm|finali[sz]e|selected details)\b/i;

const contextOptionRegex =
  /\b(less spicy|spicy|extra\s+[a-z]+|extra raita|raita|no onion|no mayo|without\s+[a-z]+|allergy)\b/i;

function normalizeText(value: string) {
  return value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function customerText(messages: ParsedChatMessage[]) {
  return messages
    .filter((message) => message.senderType === "customer")
    .map((message) => message.text)
    .join("\n");
}

export function hasRepeatOrderPhrasing(messages: ParsedChatMessage[]) {
  return repeatOrderRegex.test(customerText(messages));
}

export function isFoodBusinessRelevantChat(messages: ParsedChatMessage[]) {
  const text = customerText(messages);

  return foodBusinessRegex.test(text) || repeatOrderRegex.test(text);
}

function splitContextPhrases(value: string | null | undefined) {
  return (value ?? "")
    .split(/\n|,|;|\|/)
    .map((phrase) => phrase.trim())
    .filter((phrase) => phrase.length >= 3);
}

function phraseInText(phrase: string, text: string) {
  return normalizeText(text).includes(normalizeText(phrase));
}

function replyMentionsUngroundedProduct(
  reply: SuggestedReplyDto,
  customerCurrentText: string,
  analysis: ManualChatAnalysis,
  products: MenuProductContext[],
  repeatOrderDetected: boolean
) {
  const replyText = reply.text;
  const orderItems = analysis.order.items.map(normalizeText);
  const menuContextRequested = [
    "menu_request",
    "price_question",
    "availability_question"
  ].includes(analysis.intent);

  return products.some((product) => {
    const productName = normalizeText(product.name);

    if (!phraseInText(product.name, replyText)) {
      return false;
    }

    return (
      !phraseInText(product.name, customerCurrentText) &&
      !orderItems.includes(productName) &&
      !menuContextRequested &&
      !(repeatOrderDetected && /\b(usual|same|last time|remembered)\b/i.test(replyText))
    );
  });
}

function replyMentionsUngroundedCustomOption(
  reply: SuggestedReplyDto,
  customerCurrentText: string,
  products: MenuProductContext[],
  customerMemory: CustomerMemoryContext | null,
  repeatOrderDetected: boolean
) {
  const productOptions = products.flatMap((product) =>
    splitContextPhrases(product.customOptions)
  );
  const memoryPreferences = customerMemory?.preferences ?? [];
  const contextPhrases = [...productOptions, ...memoryPreferences];
  const replyText = reply.text;
  const memoryOptionMentionedInReply =
    repeatOrderDetected &&
    memoryPreferences.some(
      (preference) =>
        contextOptionRegex.test(preference) && phraseInText(preference, replyText)
    );

  for (const phrase of contextPhrases) {
    if (
      phraseInText(phrase, replyText) &&
      !phraseInText(phrase, customerCurrentText) &&
      !(repeatOrderDetected && memoryPreferences.some((preference) => phraseInText(phrase, preference)))
    ) {
      return true;
    }
  }

  return (
    contextOptionRegex.test(replyText) &&
    !contextOptionRegex.test(customerCurrentText) &&
    !memoryOptionMentionedInReply
  );
}

function isOrderSpecificReply(reply: SuggestedReplyDto) {
  return (
    reply.type !== "general" ||
    /\b(order|menu|delivery|payment|pay|cash|card|bank transfer|product|item|tray|box|platter|biryani|pasta|rice|cake|dessert|usual|less spicy|raita)\b/i.test(
      reply.text
    )
  );
}

function neutralReply(): SuggestedReplyDto {
  return {
    text: "Could you please clarify what details you need so I can help?",
    type: "general",
    reason: "The visible chat does not contain a clear food-order request yet."
  };
}

export function applySuggestedReplyGrounding(
  analysis: ManualChatAnalysis,
  messages: ParsedChatMessage[],
  products: MenuProductContext[],
  customerMemory: CustomerMemoryContext | null
): ManualChatAnalysis {
  const relevant = isFoodBusinessRelevantChat(messages);
  const repeatOrderDetected = hasRepeatOrderPhrasing(messages);
  const currentText = customerText(messages);
  const warnings = [...analysis.warnings];

  if (!relevant) {
    if (
      !warnings.includes(
        "Current visible chat does not appear to contain a food order yet."
      )
    ) {
      warnings.push(
        "Current visible chat does not appear to contain a food order yet."
      );
    }

    return {
      ...analysis,
      customerSummary: null,
      customerMemoryUsed: false,
      customerMemorySummary: null,
      intent: "general_question",
      orderLikely: false,
      order: {
        ...analysis.order,
        missingFields: [],
        summary: "Current visible chat does not appear to contain a food order yet."
      },
      suggestedReplies: [neutralReply()],
      warnings
    };
  }

  const groundedReplies = analysis.suggestedReplies.filter((reply) => {
    if (
      analysis.order.missingFields.length > 0 &&
      nearFinalOrderRegex.test(reply.text)
    ) {
      return false;
    }

    if (
      replyMentionsUngroundedProduct(
        reply,
        currentText,
        analysis,
        products,
        repeatOrderDetected
      )
    ) {
      return false;
    }

    if (
      replyMentionsUngroundedCustomOption(
        reply,
        currentText,
        products,
        customerMemory,
        repeatOrderDetected
      )
    ) {
      return false;
    }

    return true;
  });

  return {
    ...analysis,
    suggestedReplies:
      groundedReplies.length > 0 ? groundedReplies : [neutralReply()],
    warnings
  };
}
