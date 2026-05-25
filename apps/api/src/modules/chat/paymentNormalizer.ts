import type {
  ParsedChatMessage,
  PaymentStatus
} from "./chat.schemas.js";

function textForSender(messages: ParsedChatMessage[], senderType: "customer" | "business") {
  return messages
    .filter((message) => message.senderType === senderType)
    .map((message) => message.text)
    .join("\n");
}

function allText(messages: ParsedChatMessage[]) {
  return messages.map((message) => message.text).join("\n");
}

export function detectPaymentInquiryText(text: string) {
  return (
    /\b(what|which|how|do you|can i|can we).{0,60}\b(payment|pay|cash|card|transfer|methods?|options?|accept)\b/i.test(
      text
    ) || /\b(payment methods?|payment options?|how should i pay)\b/i.test(text)
  );
}

export function detectPaymentInquiry(messages: ParsedChatMessage[]) {
  return detectPaymentInquiryText(textForSender(messages, "customer"));
}

function customerSelectedPaymentMethod(customerText: string) {
  return /\b(i can pay|i will pay|i'll pay|i would like to pay|i want to pay|i prefer|i choose|pay by|pay via|cash is fine|cash works|transfer is fine|bank transfer is fine|card is fine)\b/i.test(
    customerText
  );
}

export function extractPaymentMethod(messages: ParsedChatMessage[]) {
  const customerText = textForSender(messages, "customer");
  const normalized = customerText.toLocaleLowerCase();

  if (detectPaymentInquiryText(customerText) && !customerSelectedPaymentMethod(customerText)) {
    return null;
  }

  if (!customerSelectedPaymentMethod(customerText)) {
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

export function hasBusinessPaymentConfirmation(messages: ParsedChatMessage[]) {
  return /\b(payment confirmed|payment received|received your payment|payment has been received)\b/i.test(
    textForSender(messages, "business")
  );
}

export function hasCustomerPaymentProof(messages: ParsedChatMessage[]) {
  return /\b(paid|sent payment|payment sent|sent the payment|sent the transfer|transferred|screenshot attached|screenshot|receipt|proof)\b/i.test(
    textForSender(messages, "customer")
  );
}

function hasPaymentIssue(messages: ParsedChatMessage[]) {
  return /\b(payment failed|payment issue|declined|payment not received|not received payment)\b/i.test(
    allText(messages)
  );
}

function hasPaymentDetailsSent(messages: ParsedChatMessage[]) {
  return /\b(payment details|bank details|account|iban|please transfer|send payment)\b/i.test(
    textForSender(messages, "business")
  );
}

function hasAwaitingPayment(messages: ParsedChatMessage[]) {
  return /\b(awaiting payment|payment pending|pending payment)\b/i.test(
    allText(messages)
  );
}

export function extractPaymentStatus(
  messages: ParsedChatMessage[],
  _paymentMethod: string | null
): PaymentStatus {
  if (hasPaymentIssue(messages)) {
    return "payment_issue";
  }

  if (hasBusinessPaymentConfirmation(messages)) {
    return "paid_confirmed";
  }

  if (hasCustomerPaymentProof(messages)) {
    return "proof_received";
  }

  if (hasPaymentDetailsSent(messages)) {
    return "payment_details_sent";
  }

  if (hasAwaitingPayment(messages)) {
    return "awaiting_payment";
  }

  return "not_discussed";
}

export function normalizePaymentStatusFromEvidence(
  ruleStatus: PaymentStatus,
  aiStatus: PaymentStatus,
  messages: ParsedChatMessage[]
): PaymentStatus {
  if (hasPaymentIssue(messages)) {
    return "payment_issue";
  }

  if (hasBusinessPaymentConfirmation(messages)) {
    return "paid_confirmed";
  }

  if (hasCustomerPaymentProof(messages)) {
    return "proof_received";
  }

  if (ruleStatus === "payment_details_sent" || aiStatus === "payment_details_sent") {
    return "payment_details_sent";
  }

  if (ruleStatus === "awaiting_payment" || aiStatus === "awaiting_payment") {
    return "awaiting_payment";
  }

  return "not_discussed";
}
