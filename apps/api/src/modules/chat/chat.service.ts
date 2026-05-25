import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { toJsonField } from "../../utils/jsonFields.js";
import type {
  ManualChatAnalysis,
  ManualChatAnalysisRequest,
  ManualChatAnalysisResponse
} from "./chat.schemas.js";
import { buildAiAssistedAnalysis } from "./aiAnalysis.js";
import { extractOrderRules } from "./orderRuleExtractor.js";
import { buildSuggestedReplies } from "./suggestedReplyRules.js";
import { parseWhatsAppExport } from "./whatsappParser.js";

const manualPasteSource = "manual_paste" as const;

function toDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getLastMessageAt(messages: ManualChatAnalysisResponse["messages"]) {
  const timestamps = messages
    .map((message) => toDate(message.timestamp))
    .filter((date): date is Date => date !== null)
    .sort((left, right) => right.getTime() - left.getTime());

  return timestamps[0] ?? null;
}

function isAiAnalyzerEnabled() {
  return process.env.AI_ANALYZER_ENABLED?.toLocaleLowerCase() !== "false";
}

function buildRuleBasedAnalysis(
  analysisWithoutReplies: Omit<ManualChatAnalysis, "suggestedReplies">
): ManualChatAnalysis {
  return {
    ...analysisWithoutReplies,
    source: "rule_based",
    customerSummary: null,
    suggestedReplies: buildSuggestedReplies(analysisWithoutReplies)
  };
}

function buildAiFallbackAnalysis(
  analysisWithoutReplies: Omit<ManualChatAnalysis, "suggestedReplies">,
  warning: string
): ManualChatAnalysis {
  const fallbackAnalysis = {
    ...analysisWithoutReplies,
    source: "ai_fallback" as const,
    customerSummary: null,
    warnings: [...analysisWithoutReplies.warnings, warning]
  };

  return {
    ...fallbackAnalysis,
    suggestedReplies: buildSuggestedReplies(fallbackAnalysis)
  };
}

async function buildAnalysis(
  input: ManualChatAnalysisRequest,
  analysisWithoutReplies: Omit<ManualChatAnalysis, "suggestedReplies">,
  messages: ManualChatAnalysisResponse["messages"]
) {
  if (input.useAi !== true) {
    return buildRuleBasedAnalysis(analysisWithoutReplies);
  }

  if (!isAiAnalyzerEnabled()) {
    return buildRuleBasedAnalysis({
      ...analysisWithoutReplies,
      warnings: [
        ...analysisWithoutReplies.warnings,
        "AI analyzer is disabled by AI_ANALYZER_ENABLED=false; used rule-based analysis."
      ]
    });
  }

  try {
    return await buildAiAssistedAnalysis(messages, analysisWithoutReplies);
  } catch (error) {
    console.warn(
      `[AI] Manual chat analyzer failed; using rule-based fallback. ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
    return buildAiFallbackAnalysis(
      analysisWithoutReplies,
      "AI-assisted analysis failed; used rule-based fallback."
    );
  }
}

async function findOrCreateCustomer(
  transaction: Prisma.TransactionClient,
  input: ManualChatAnalysisRequest
) {
  const customerPhone = input.customerPhone?.trim();
  const customerKey = input.customerKey?.trim();
  const where = customerPhone
    ? { phoneRaw: customerPhone }
    : customerKey
      ? { phoneHash: customerKey }
      : { displayName: input.chatName };

  const existingCustomer = await transaction.customer.findFirst({
    where,
    orderBy: {
      updatedAt: "desc"
    }
  });

  if (existingCustomer) {
    return existingCustomer;
  }

  return transaction.customer.create({
    data: {
      displayName: input.chatName,
      phoneRaw: customerPhone,
      phoneHash: customerKey
    }
  });
}

export async function analyzeManualChat(
  input: ManualChatAnalysisRequest
): Promise<ManualChatAnalysisResponse> {
  const parsed = parseWhatsAppExport(input.rawText, input.businessSenderNames);
  const analysisWithoutReplies = extractOrderRules(
    parsed.messages,
    parsed.warnings
  );
  const analysis = await buildAnalysis(
    input,
    analysisWithoutReplies,
    parsed.messages
  );

  const stored = await prisma.$transaction(async (transaction) => {
    const customer = await findOrCreateCustomer(transaction, input);

    const conversation = await transaction.conversation.create({
      data: {
        customerId: customer.id,
        source: manualPasteSource,
        whatsappChatName: input.chatName,
        lastMessageAt: getLastMessageAt(parsed.messages),
        summary: analysis.order.summary
      }
    });

    if (parsed.messages.length > 0) {
      await transaction.message.createMany({
        data: parsed.messages.map((message) => ({
          conversationId: conversation.id,
          senderType: message.senderType,
          senderName: message.senderName,
          messageText: message.text,
          timestamp: toDate(message.timestamp),
          source: manualPasteSource
        }))
      });
    }

    const order = analysis.orderLikely
      ? await transaction.order.create({
          data: {
            customerId: customer.id,
            conversationId: conversation.id,
            status: "draft",
            itemsJson: toJsonField({
              items: analysis.order.items,
              quantity: analysis.order.quantity
            }),
            deliveryDate: toDate(analysis.order.deliveryDate),
            deliveryTime: analysis.order.deliveryTime,
            address: analysis.order.address,
            paymentMethod: analysis.order.paymentMethod,
            paymentStatus: analysis.order.paymentStatus,
            customRequestsJson: toJsonField(analysis.order.customRequests),
            missingFieldsJson: toJsonField(analysis.order.missingFields),
            summary: analysis.order.summary
          }
        })
      : null;

    if (analysis.suggestedReplies.length > 0) {
      await transaction.suggestedReply.createMany({
        data: analysis.suggestedReplies.map((reply) => ({
          conversationId: conversation.id,
          orderId: order?.id ?? null,
          replyText: reply.text,
          replyType: reply.type,
          reason: reply.reason
        }))
      });
    }

    return conversation;
  });

  return {
    conversation: {
      id: stored.id,
      chatName: input.chatName,
      source: manualPasteSource
    },
    messages: parsed.messages,
    analysis
  };
}
