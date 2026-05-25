export type ParsedChatMessage = {
  senderName: string | null;
  senderType: "customer" | "business" | "unknown";
  text: string;
  timestamp: string | null;
  raw: string;
};

export type SuggestedReplyDto = {
  text: string;
  type:
    | "clarifying_question"
    | "confirmation"
    | "menu_response"
    | "payment_followup"
    | "complaint_response"
    | "delivery_update"
    | "general";
  reason: string;
};

export type ManualChatAnalysisResponse = {
  conversation: {
    id: string;
    chatName: string;
    source: "manual_paste";
  };
  messages: ParsedChatMessage[];
  analysis: {
    source: "rule_based" | "ai_assisted" | "ai_fallback";
    customerSummary: string | null;
    intent:
      | "menu_request"
      | "price_question"
      | "availability_question"
      | "new_order"
      | "repeat_order"
      | "custom_request"
      | "payment_question"
      | "delivery_update"
      | "complaint"
      | "general_question";
    orderLikely: boolean;
    order: {
      items: string[];
      quantity: number | null;
      deliveryDate: string | null;
      deliveryTime: string | null;
      address: string | null;
      paymentMethod: string | null;
      paymentStatus:
        | "not_discussed"
        | "method_selected"
        | "payment_details_sent"
        | "awaiting_payment"
        | "proof_received"
        | "paid_confirmed"
        | "payment_issue";
      paymentInquiryDetected?: boolean;
      customRequests: string[];
      missingFields: string[];
      summary: string;
    };
    suggestedReplies: SuggestedReplyDto[];
    warnings: string[];
  };
};

export type ManualChatAnalysisRequest = {
  chatName: string;
  customerKey?: string;
  customerPhone?: string;
  businessSenderNames: string[];
  rawText: string;
  useAi?: boolean;
};

type ApiErrorResponse = {
  error?: {
    message?: string;
  };
};

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export async function analyzeManualChat(
  input: ManualChatAnalysisRequest
): Promise<ManualChatAnalysisResponse> {
  const response = await fetch(`${apiBaseUrl}/api/chat/analyze-manual`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as
      | ApiErrorResponse
      | null;

    throw new Error(
      errorBody?.error?.message ?? `Request failed with ${response.status}`
    );
  }

  return response.json() as Promise<ManualChatAnalysisResponse>;
}
