import type { Customer } from "@prisma/client";
import { AiService } from "../../ai/AiService.js";
import type { CustomerMemoryUpdateResult } from "../../ai/types.js";
import { prisma } from "../../db/prisma.js";
import { parseJsonField, toJsonField } from "../../utils/jsonFields.js";
import { findCustomerByLookup, type CustomerLookupInput } from "./customerLookup.js";

export type CustomerMemoryContext = {
  customerId: string;
  displayName: string;
  profileSummary: string | null;
  usualAddress: string | null;
  preferences: string[];
  notes: string | null;
  recentOrderSummaries: string[];
};

function unique(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLocaleLowerCase();

    if (!trimmed || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

function parsePreferences(value: string | null | undefined) {
  const parsed = parseJsonField<unknown>(value, []);

  if (Array.isArray(parsed)) {
    return parsed.filter((item): item is string => typeof item === "string");
  }

  if (typeof parsed === "string") {
    return parsed
      .split(/\n|,|;/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function splitNotes(value: string | null | undefined) {
  return (value ?? "")
    .split("\n")
    .map((note) => note.trim())
    .filter(Boolean);
}

function mergeNotes(existingNotes: string | null, newNotes: string[]) {
  const notes = unique([...splitNotes(existingNotes), ...newNotes]);

  return notes.length > 0 ? notes.join("\n") : existingNotes;
}

function customerToMemoryContext(
  customer: Customer,
  recentOrderSummaries: string[] = []
): CustomerMemoryContext {
  return {
    customerId: customer.id,
    displayName: customer.displayName,
    profileSummary: customer.profileSummary,
    usualAddress: customer.usualAddress,
    preferences: parsePreferences(customer.preferencesJson),
    notes: customer.notes,
    recentOrderSummaries
  };
}

export async function getCustomerMemoryByLookup(input: CustomerLookupInput) {
  const customer = await findCustomerByLookup(input);

  if (!customer) {
    return null;
  }

  const recentOrders = await prisma.order.findMany({
    where: {
      customerId: customer.id
    },
    orderBy: {
      updatedAt: "desc"
    },
    take: 3,
    select: {
      summary: true,
      itemsJson: true,
      deliveryTime: true
    }
  });

  return customerToMemoryContext(
    customer,
    recentOrders
      .map((order) => order.summary ?? order.itemsJson ?? order.deliveryTime)
      .filter((summary): summary is string => Boolean(summary))
  );
}

export function formatCustomerMemoryContext(
  memory: CustomerMemoryContext | null
) {
  if (!memory) {
    return "Customer memory: none found.";
  }

  return [
    "Customer memory for advisory wording only:",
    `Customer: ${memory.displayName}`,
    memory.profileSummary ? `Profile summary: ${memory.profileSummary}` : null,
    memory.usualAddress
      ? `Usual address: ${memory.usualAddress}`
      : null,
    memory.preferences.length > 0
      ? `Preferences: ${memory.preferences.join(", ")}`
      : null,
    memory.notes ? `Notes: ${memory.notes}` : null,
    memory.recentOrderSummaries.length > 0
      ? `Recent order summaries: ${memory.recentOrderSummaries.join(" | ")}`
      : null,
    "Memory is advisory only. Do not auto-fill required fields unless the current chat confirms them.",
    "Current chat wins over memory. Do not confirm orders based only on memory."
  ]
    .filter(Boolean)
    .join("\n");
}

export function applyCustomerMemoryUpdate(
  customer: Customer,
  memory: CustomerMemoryUpdateResult
) {
  const preferences = unique([
    ...parsePreferences(customer.preferencesJson),
    ...memory.preferences,
    ...memory.repeatOrderPatterns
  ]);
  const newNotes = unique([
    ...memory.notes,
    ...(memory.paymentBehavior
      ? [`Payment behavior: ${memory.paymentBehavior}`]
      : []),
    ...memory.complaintHistory.map((item) => `Complaint note: ${item}`)
  ]);

  return {
    profileSummary: memory.profileSummary?.trim() || customer.profileSummary,
    usualAddress: memory.usualAddress?.trim() || customer.usualAddress,
    preferencesJson:
      preferences.length > 0 ? toJsonField(preferences) : customer.preferencesJson,
    notes: mergeNotes(customer.notes, newNotes)
  };
}

export async function refreshCustomerMemory(customerId: string) {
  const warnings: string[] = [];
  const customer = await prisma.customer.findUnique({
    where: {
      id: customerId
    }
  });

  if (!customer) {
    return null;
  }

  const messages = await prisma.message.findMany({
    where: {
      conversation: {
        customerId
      }
    },
    include: {
      conversation: true
    },
    orderBy: [{ timestamp: "desc" }, { createdAt: "desc" }],
    take: 200
  });
  const text = messages
    .reverse()
    .map((message) => {
      const sender = message.senderName ?? message.senderType;

      return `${sender} (${message.senderType}): ${message.messageText}`;
    })
    .join("\n");

  if (!text.trim()) {
    return {
      customer,
      warnings: ["No stored messages were available for memory refresh."]
    };
  }

  const service = new AiService();
  const memory = await service.updateCustomerMemory(text);

  if (service.usedFallback) {
    return {
      customer,
      warnings: ["Customer memory AI task failed; existing profile was kept."]
    };
  }

  const data = applyCustomerMemoryUpdate(customer, memory);
  const updatedCustomer = await prisma.customer.update({
    where: {
      id: customerId
    },
    data
  });

  const usefulNote = memory.notes.find((note) => note.trim().length >= 8);

  if (usefulNote) {
    await prisma.customerNote.create({
      data: {
        customerId,
        note: usefulNote
      }
    });
  }

  return {
    customer: updatedCustomer,
    warnings
  };
}

export function customerMemorySummary(memory: CustomerMemoryContext | null) {
  if (!memory) {
    return null;
  }

  return [
    memory.profileSummary,
    memory.preferences.length > 0
      ? `Preferences: ${memory.preferences.join(", ")}`
      : null,
    memory.usualAddress ? `Usual address on file.` : null
  ]
    .filter(Boolean)
    .join(" ")
    .trim() || null;
}
