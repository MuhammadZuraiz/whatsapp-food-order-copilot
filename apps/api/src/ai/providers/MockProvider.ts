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

function classifyIntent(text: string) {
  const normalized = text.toLocaleLowerCase();

  if (/\bsame order|same as last|repeat|again\b/.test(normalized)) {
    return {
      intent: "repeat_order",
      confidence: 0.82,
      orderLikely: true,
      reason: "The text refers to repeating a previous order."
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

  return {
    intent: "general_question",
    confidence: 0.64,
    orderLikely: false,
    reason: "No strong order-specific signal was detected."
  };
}

function extractOrder(text: string) {
  const normalized = text.toLocaleLowerCase();
  const hasTwo = /\b2\b|\btwo\b/.test(normalized);
  const items = [];

  if (/\bbiryani\b/.test(normalized)) {
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
  const addressMatch = text.match(
    /\b(address|location)\b[^\n.]*(?:[.\n]|$)/i
  );
  const paymentMethod = /\bbank transfer|transfer\b/.test(normalized)
    ? "bank_transfer"
    : /\bcash\b/.test(normalized)
      ? "cash"
      : /\bcard\b/.test(normalized)
        ? "card"
        : null;
  const paymentStatus = /\bpaid|transferred|screenshot|receipt\b/.test(
    normalized
  )
    ? "proof_received"
    : paymentMethod
      ? "method_selected"
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
    paymentStatus === "proof_received" ? null : "paymentStatus"
  ].filter((field): field is string => field !== null);

  return {
    items,
    quantity: hasTwo ? 2 : null,
    deliveryDate,
    deliveryTime,
    address: addressMatch?.[0].trim() ?? null,
    paymentMethod,
    paymentStatus,
    customRequests,
    missingFields,
    summary:
      items.length > 0
        ? `Possible order for ${items.join(", ")}.`
        : "No clear item was detected by the mock provider."
  };
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
        shouldUpdate: true,
        profileSummary: "Customer is interested in scheduled food delivery.",
        usualAddress: null,
        preferences: userText.toLocaleLowerCase().includes("less spicy")
          ? ["less spicy"]
          : [],
        notes: ["Mock memory update generated from pasted text."]
      });
    }

    if (task === "generateSuggestedReplies") {
      return JSON.stringify({
        suggestedReplies: [
          {
            text: "Sure, I can help. What delivery date and time would you prefer?",
            type: "clarifying_question",
            reason: "Scheduled delivery details need human confirmation."
          },
          {
            text: "Please send your delivery address/location so I can confirm availability.",
            type: "clarifying_question",
            reason: "The delivery address may still be missing."
          }
        ],
        safety: {
          requiresHumanApproval: true,
          autoSendAllowed: false
        }
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

    return JSON.stringify({
      message: "MockProvider received an unknown task."
    });
  }
}
