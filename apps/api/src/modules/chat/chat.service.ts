import { prisma } from "../../db/prisma.js";
import type {
  ManualChatAnalysisRequest,
  ManualChatAnalysisResponse
} from "./chat.schemas.js";
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

export async function analyzeManualChat(
  input: ManualChatAnalysisRequest
): Promise<ManualChatAnalysisResponse> {
  const parsed = parseWhatsAppExport(input.rawText, input.businessSenderNames);
  const analysisWithoutReplies = extractOrderRules(
    parsed.messages,
    parsed.warnings
  );
  const suggestedReplies = buildSuggestedReplies(analysisWithoutReplies);
  const analysis = {
    ...analysisWithoutReplies,
    suggestedReplies
  };

  const stored = await prisma.$transaction(async (transaction) => {
    const existingCustomer = await transaction.customer.findFirst({
      where: {
        displayName: input.chatName
      },
      orderBy: {
        updatedAt: "desc"
      }
    });

    const customer =
      existingCustomer ??
      (await transaction.customer.create({
        data: {
          displayName: input.chatName
        }
      }));

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
            itemsJson: JSON.stringify({
              items: analysis.order.items,
              quantity: analysis.order.quantity
            }),
            deliveryDate: toDate(analysis.order.deliveryDate),
            deliveryTime: analysis.order.deliveryTime,
            address: analysis.order.address,
            paymentMethod: analysis.order.paymentMethod,
            paymentStatus: analysis.order.paymentStatus,
            customRequestsJson: JSON.stringify(analysis.order.customRequests),
            missingFieldsJson: JSON.stringify(analysis.order.missingFields),
            summary: analysis.order.summary
          }
        })
      : null;

    if (suggestedReplies.length > 0) {
      await transaction.suggestedReply.createMany({
        data: suggestedReplies.map((reply) => ({
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
