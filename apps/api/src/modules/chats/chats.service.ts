import type {
  ChatImportRequest,
  ChatImportResponse,
  ParsedChatMessage
} from "@wfo/shared";
import { AiService } from "../../ai/AiService.js";
import type { CustomerMemoryUpdateResult } from "../../ai/types.js";
import { prisma } from "../../db/prisma.js";
import { toJsonField, parseJsonField } from "../../utils/jsonFields.js";
import { analyzeAndSaveBrandStyleFromTexts } from "../brandStyle/brandStyle.service.js";
import { findOrCreateCustomer } from "../customers/customerLookup.js";
import { parseWhatsAppExport } from "../chat/whatsappParser.js";

const importedTxtSource = "imported_txt" as const;

function toDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getLastMessageAt(messages: ParsedChatMessage[]) {
  const timestamps = messages
    .map((message) => toDate(message.timestamp))
    .filter((date): date is Date => date !== null)
    .sort((left, right) => right.getTime() - left.getTime());

  return timestamps[0] ?? null;
}

function conversationText(messages: ParsedChatMessage[]) {
  return messages
    .map((message) => {
      const sender = message.senderName ?? message.senderType;

      return `${sender} (${message.senderType}): ${message.text}`;
    })
    .join("\n");
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function mergeNotes(existingNotes: string | null, newNotes: string[]) {
  const notes = unique([
    ...(existingNotes ?? "")
      .split("\n")
      .map((note) => note.trim())
      .filter(Boolean),
    ...newNotes
  ]);

  return notes.length > 0 ? notes.join("\n") : existingNotes;
}

async function updateCustomerMemory(
  customerId: string,
  memory: CustomerMemoryUpdateResult
) {
  const existingCustomer = await prisma.customer.findUnique({
    where: {
      id: customerId
    }
  });

  if (!existingCustomer) {
    return;
  }

  const existingPreferences = parseJsonField<string[]>(
    existingCustomer.preferencesJson,
    []
  );
  const preferences = unique([
    ...existingPreferences,
    ...memory.preferences,
    ...memory.repeatOrderPatterns
  ]);
  const data = {
    profileSummary:
      memory.profileSummary?.trim() || existingCustomer.profileSummary,
    usualAddress: memory.usualAddress?.trim() || existingCustomer.usualAddress,
    preferencesJson:
      preferences.length > 0
        ? toJsonField(preferences)
        : existingCustomer.preferencesJson,
    notes: mergeNotes(existingCustomer.notes, [
      ...memory.notes,
      ...(memory.paymentBehavior ? [`Payment behavior: ${memory.paymentBehavior}`] : []),
      ...memory.complaintHistory.map((item) => `Complaint note: ${item}`)
    ])
  };

  await prisma.customer.update({
    where: {
      id: customerId
    },
    data
  });
}

async function runCustomerMemoryUpdate(
  customerId: string,
  text: string,
  warnings: string[]
) {
  const service = new AiService();
  const memory = await service.updateCustomerMemory(text);

  if (service.usedFallback) {
    warnings.push("Customer memory AI task failed; import continued.");
    return;
  }

  await updateCustomerMemory(customerId, memory);
}

export async function importChat(
  input: ChatImportRequest
): Promise<ChatImportResponse> {
  const parsed = parseWhatsAppExport(input.rawText, input.businessSenderNames);
  const warnings = [...parsed.warnings];
  const stored = await prisma.$transaction(async (transaction) => {
    const customer = await findOrCreateCustomer(transaction, input);
    const conversation = await transaction.conversation.create({
      data: {
        customerId: customer.id,
        source: importedTxtSource,
        whatsappChatName: input.chatName,
        lastMessageAt: getLastMessageAt(parsed.messages),
        summary: `Imported ${parsed.messages.length} messages from WhatsApp export.`
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
          source: importedTxtSource
        }))
      });
    }

    return {
      conversation,
      customer
    };
  });

  if (input.runCustomerMemoryUpdate) {
    try {
      await runCustomerMemoryUpdate(
        stored.customer.id,
        conversationText(parsed.messages),
        warnings
      );
    } catch {
      warnings.push("Customer memory update failed; import continued.");
    }
  }

  const businessMessages = parsed.messages
    .filter((message) => message.senderType === "business")
    .map((message) => message.text);
  let brandStyle: ChatImportResponse["brandStyle"] = {
    updated: false,
    profile: null
  };

  if (input.runBrandStyleAnalysis) {
    try {
      const result = await analyzeAndSaveBrandStyleFromTexts(businessMessages);

      warnings.push(...result.warnings);
      brandStyle = {
        updated: result.updated,
        profile: result.profile
      };
    } catch {
      warnings.push("Brand style analysis failed; import continued.");
    }
  }

  return {
    conversation: {
      id: stored.conversation.id,
      chatName: input.chatName,
      source: importedTxtSource
    },
    customer: {
      id: stored.customer.id,
      displayName: stored.customer.displayName
    },
    import: {
      messageCount: parsed.messages.length,
      businessMessageCount: parsed.messages.filter(
        (message) => message.senderType === "business"
      ).length,
      customerMessageCount: parsed.messages.filter(
        (message) => message.senderType === "customer"
      ).length,
      warnings
    },
    brandStyle
  };
}
