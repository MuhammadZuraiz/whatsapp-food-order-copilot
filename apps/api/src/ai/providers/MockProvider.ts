import type { AiProvider } from "../AiProvider.js";
import type { AiGenerateOptions, AiMessage } from "../types.js";

type MockTask =
  | "classifyIntent"
  | "extractOrder"
  | "updateCustomerMemory"
  | "generateSuggestedReplies"
  | "analyzeBrandStyle";

function findTask(messages: AiMessage[]): MockTask | null {
  const text = messages.map((message) => message.content).join("\n");

  for (const task of [
    "classifyIntent",
    "extractOrder",
    "updateCustomerMemory",
    "generateSuggestedReplies",
    "analyzeBrandStyle"
  ] as const) {
    if (text.includes(`TASK:${task}`)) {
      return task;
    }
  }

  return null;
}

function getUserText(messages: AiMessage[]) {
  const content = messages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join("\n");
  const textMarker = "Text:\n";
  const markerIndex = content.lastIndexOf(textMarker);

  if (markerIndex >= 0) {
    return content.slice(markerIndex + textMarker.length);
  }

  return content;
}

function customerOnlyText(text: string) {
  const lines = text
    .split("\n")
    .filter((line) => /\(customer\):/i.test(line))
    .map((line) => line.replace(/^.*?\(customer\):\s*/i, ""));

  return lines.length > 0 ? lines.join("\n") : text;
}

function businessOnlyText(text: string) {
  return text
    .split("\n")
    .filter((line) => /\(business\):/i.test(line))
    .map((line) => line.replace(/^.*?\(business\):\s*/i, ""))
    .join("\n");
}

function normalizeItems(items: string[]) {
  const normalizedItems = [...new Set(items.map((item) => item.toLocaleLowerCase()))];

  return normalizedItems.filter(
    (item) =>
      !normalizedItems.some(
        (otherItem) =>
          otherItem !== item &&
          otherItem.length > item.length &&
          new RegExp(`(^|\\s)${item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`).test(
            otherItem
          )
      )
  );
}

function classifyIntent(text: string) {
  const customerText = customerOnlyText(text);
  const normalized = customerText.toLocaleLowerCase();

  if (/\bsame order|same as last|repeat|again\b/.test(normalized)) {
    return {
      intent: "repeat_order",
      confidence: 0.82,
      orderLikely: true,
      reason: "The text refers to repeating a previous order."
    };
  }

  if (/\bpaid|payment|transfer|cash|card|receipt|screenshot\b/.test(normalized)) {
    return {
      intent: "payment_question",
      confidence: 0.79,
      orderLikely: /\border|delivery|biryani|box|tray\b/.test(normalized),
      reason: "The text mentions payment details."
    };
  }

  if (/\border|delivery|deliver|biryani|box|tray|cake|pasta\b/.test(normalized)) {
    return {
      intent: "new_order",
      confidence: 0.84,
      orderLikely: true,
      reason: "The text contains food-order and delivery language."
    };
  }

  if (/\bmenu|options|catalog\b/.test(normalized)) {
    return {
      intent: "menu_request",
      confidence: 0.86,
      orderLikely: false,
      reason: "The customer is asking for available menu options."
    };
  }

  if (/\bprice|cost|how much|rate\b/.test(normalized)) {
    return {
      intent: "price_question",
      confidence: 0.8,
      orderLikely: false,
      reason: "The text asks about pricing."
    };
  }

  return {
    intent: "general_question",
    confidence: 0.64,
    orderLikely: false,
    reason: "No strong order-specific signal was detected."
  };
}

function extractOrder(text: string) {
  const customerText = customerOnlyText(text);
  const businessText = businessOnlyText(text);
  const normalized = customerText.toLocaleLowerCase();
  const hasTwo = /\b2\b|\btwo\b/.test(normalized);
  const paymentInquiryDetected =
    /\b(what|which|how|do you|can i|can we).{0,60}\b(payment|pay|cash|card|transfer|methods?|options?|accept)\b/i.test(
      customerText
    ) || /\b(payment methods?|payment options?|how should i pay)\b/i.test(customerText);
  const paymentSelectionDetected =
    /\b(i can pay|i will pay|i'll pay|i would like to pay|pay by|pay via|cash is fine|cash works|transfer is fine|bank transfer is fine|card is fine|i prefer)\b/i.test(
      customerText
    );
  const items = [];

  if (/\bchicken biryani trays?\b/.test(normalized)) {
    items.push("chicken biryani trays");
  } else if (/\bbiryani boxes?\b/.test(normalized)) {
    items.push("biryani boxes");
  } else if (/\bbiryani\b/.test(normalized)) {
    items.push("biryani");
  }

  if (/\bpasta\b/.test(normalized)) {
    items.push("pasta");
  }

  if (/\bcake\b/.test(normalized)) {
    items.push("cake");
  }

  const deliveryDate = /\btomorrow\b/.test(normalized) ? "tomorrow" : null;
  const deliveryTime = /\bdinner\b/.test(normalized)
    ? "dinner"
    : /\blunch\b/.test(normalized)
      ? "lunch"
      : null;
  const addressMatch = customerText.match(
    /\b(address|location)\b[^\n.]*(?:[.\n]|$)/i
  );
  const paymentMethod =
    paymentInquiryDetected && !paymentSelectionDetected
      ? null
      : /\bbank transfer|transfer\b/.test(normalized)
        ? "bank_transfer"
        : /\bcash\b/.test(normalized)
          ? "cash"
          : /\bcard\b/.test(normalized)
            ? "card"
            : null;
  const paymentStatus = /\b(payment received|payment confirmed|received your payment)\b/i.test(
    businessText
  )
    ? "paid_confirmed"
    : /\bpaid|sent payment|payment sent|sent the payment|transferred|screenshot|receipt\b/.test(
          normalized
        )
    ? "proof_received"
    : "not_discussed";
  const customRequests = /\bless spicy\b/.test(normalized)
    ? ["less spicy"]
    : [];
  const missingFields = [
    items.length === 0 ? "items" : null,
    hasTwo ? null : "quantity",
    deliveryDate ? null : "deliveryDate",
    deliveryTime ? null : "deliveryTime",
    addressMatch ? null : "address",
    paymentMethod ? null : "paymentMethod",
    ["proof_received", "paid_confirmed"].includes(paymentStatus)
      ? null
      : "paymentStatus"
  ].filter((field): field is string => field !== null);
  const normalizedItems = normalizeItems(items);

  return {
    items: normalizedItems,
    quantity: hasTwo ? 2 : null,
    deliveryDate,
    deliveryTime,
    address: addressMatch?.[0].trim() ?? null,
    paymentMethod,
    paymentStatus,
    paymentInquiryDetected,
    customRequests,
    missingFields,
    summary:
      normalizedItems.length > 0
        ? `Possible order for ${normalizedItems.join(", ")}.`
        : "No clear item was detected by the mock provider."
  };
}

function missingFieldsFromPrompt(text: string) {
  const match = text.match(/Missing fields:\s*([^\n]+)/i);

  if (!match || match[1].trim().toLocaleLowerCase() === "none") {
    const inferredFields: string[] = [];
    const normalizedText = text.toLocaleLowerCase();

    if (/\baddress is missing|missing address|address missing\b/.test(normalizedText)) {
      inferredFields.push("address");
    }

    if (/\bpayment method is missing|missing payment method|payment method missing\b/.test(normalizedText)) {
      inferredFields.push("paymentMethod");
    }

    if (/\bpayment status is missing|missing payment status|payment status missing\b/.test(normalizedText)) {
      inferredFields.push("paymentStatus");
    }

    if (/\bdate is missing|missing date|delivery date missing\b/.test(normalizedText)) {
      inferredFields.push("deliveryDate");
    }

    if (/\btime is missing|missing time|delivery time missing\b/.test(normalizedText)) {
      inferredFields.push("deliveryTime");
    }

    return inferredFields;
  }

  return match[1]
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean);
}

function suggestedRepliesForPrompt(text: string) {
  const missingFields = new Set(missingFieldsFromPrompt(text));
  const replies: Array<{
    text: string;
    type: "clarifying_question" | "confirmation" | "payment_followup";
    reason: string;
  }> = [];

  if (missingFields.has("address")) {
    replies.push({
      text: "Please send your delivery address/location so I can confirm availability.",
      type: "clarifying_question",
      reason: "The delivery address is missing."
    });
  }

  if (missingFields.has("paymentMethod")) {
    replies.push({
      text: "Which payment method would you prefer: cash, card, or bank transfer?",
      type: "payment_followup",
      reason: "The payment method has not been selected yet."
    });
  } else if (missingFields.has("paymentStatus")) {
    replies.push({
      text: "Please send payment proof once payment is completed so I can verify it.",
      type: "payment_followup",
      reason: "Payment is not confirmed yet."
    });
  }

  if (missingFields.has("deliveryDate")) {
    replies.push({
      text: "Sure, for which date would you like to schedule the delivery?",
      type: "clarifying_question",
      reason: "Scheduled delivery date is required."
    });
  }

  if (missingFields.has("deliveryTime")) {
    replies.push({
      text: "What delivery time would you prefer?",
      type: "clarifying_question",
      reason: "Scheduled delivery time is required."
    });
  }

  if (replies.length === 0) {
    replies.push({
      text: "Thanks, I have the order details. I'll confirm availability for your scheduled delivery.",
      type: "confirmation",
      reason: "No missing fields were listed in the analyzer prompt."
    });
  }

  return replies.slice(0, 3);
}

function extractUsualAddress(text: string) {
  const match = text.match(
    /\b(?:deliver to|address is|delivery address is|use)\s+([^\n.]+(?:street|villa|building|apartment|flat|area|gulberg)[^\n.]*)/i
  );

  return match?.[1]?.trim() ?? null;
}

function memoryProfileSummary(text: string) {
  const normalized = text.toLocaleLowerCase();

  if (/\bchicken biryani tray\b/.test(normalized)) {
    return /\bsame|again|last time|usual\b/.test(normalized)
      ? "Repeat customer who orders Chicken Biryani Tray for scheduled delivery."
      : "Customer is interested in Chicken Biryani Tray for scheduled delivery.";
  }

  return "Customer is interested in scheduled food delivery.";
}

export class MockProvider implements AiProvider {
  readonly name = "mock" as const;

  async generate(messages: AiMessage[], _options?: AiGenerateOptions) {
    const task = findTask(messages);
    const userText = getUserText(messages);

    if (task === "classifyIntent") {
      return JSON.stringify(classifyIntent(userText));
    }

    if (task === "extractOrder") {
      return JSON.stringify(extractOrder(userText));
    }

    if (task === "updateCustomerMemory") {
      return JSON.stringify({
        profileSummary: memoryProfileSummary(userText),
        preferences: userText.toLocaleLowerCase().includes("less spicy")
          ? ["less spicy"]
          : [],
        usualAddress: extractUsualAddress(userText),
        paymentBehavior: /\b(payment|pay|cash|card|transfer)\b/i.test(userText)
          ? "Asked about or discussed payment."
          : null,
        complaintHistory: [],
        repeatOrderPatterns: /\bsame|again|last time|usual\b/i.test(userText)
          ? ["repeat order"]
          : [],
        notes: ["Mock memory update generated from pasted text."]
      });
    }

    if (task === "generateSuggestedReplies") {
      return JSON.stringify({
        suggestions: suggestedRepliesForPrompt(userText)
      });
    }

    if (task === "analyzeBrandStyle") {
      return JSON.stringify({
        toneSummary:
          "Friendly, clear, practical, and confirmation-oriented for scheduled food orders.",
        commonPhrases: ["Sure", "Please confirm", "I can help"],
        doRules: [
          "Ask for missing delivery date, time, address, and payment details.",
          "Keep replies concise and human-approved."
        ],
        dontRules: [
          "Do not promise instant delivery.",
          "Do not claim payment is confirmed unless the business confirms it."
        ],
        exampleReplies: [
          "Sure, for which date would you like to schedule delivery?",
          "Please share your address/location so I can confirm availability."
        ]
      });
    }

    return "Hello from the mock AI provider. Human approval is still required.";
  }
}
