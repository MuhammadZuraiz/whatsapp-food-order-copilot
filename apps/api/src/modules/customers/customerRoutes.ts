import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { NotFoundError } from "../../errors.js";
import { idParamsSchema } from "../../schemas/common.js";
import {
  createCustomerNoteSchema,
  createCustomerSchema,
  customerListQuerySchema,
  updateCustomerSchema
} from "../../schemas/customerSchemas.js";
import { parseJsonField, toJsonField } from "../../utils/jsonFields.js";
import { refreshCustomerMemory } from "./customerMemory.js";

export const customerRoutes = Router();

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

function parseNotes(value: string | null | undefined) {
  return (value ?? "")
    .split("\n")
    .map((note) => note.trim())
    .filter(Boolean);
}

function parseItemsJson(value: string | null | undefined) {
  const parsed = parseJsonField<unknown>(value, null);

  if (
    parsed &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    "items" in parsed &&
    Array.isArray((parsed as { items: unknown }).items)
  ) {
    return (parsed as { items: unknown[] }).items.filter(
      (item): item is string => typeof item === "string"
    );
  }

  return [];
}

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

function buildCustomerUpdateData(
  input: ReturnType<typeof updateCustomerSchema.parse>
) {
  const data: Prisma.CustomerUpdateInput = {};

  if ("displayName" in input) {
    data.displayName = input.displayName;
  }

  if ("phoneRaw" in input) {
    data.phoneRaw = input.phoneRaw;
  }

  if ("profileSummary" in input) {
    data.profileSummary = input.profileSummary;
  }

  if ("usualAddress" in input) {
    data.usualAddress = input.usualAddress;
  }

  if ("notes" in input) {
    data.notes = input.notes;
  }

  if ("preferences" in input && input.preferences !== undefined) {
    data.preferencesJson = toJsonField(
      Array.isArray(input.preferences)
        ? input.preferences
        : input.preferences
            .split(/\n|,|;/)
            .map((item) => item.trim())
            .filter(Boolean)
    );
  } else if ("preferencesJson" in input) {
    data.preferencesJson =
      input.preferencesJson === null || input.preferencesJson === undefined
        ? input.preferencesJson
        : typeof input.preferencesJson === "string"
          ? input.preferencesJson
          : toJsonField(input.preferencesJson);
  }

  return data;
}

function orderToDto(order: {
  id: string;
  status: string;
  itemsJson: string | null;
  deliveryDate: Date | null;
  deliveryTime: string | null;
  address: string | null;
  paymentMethod: string | null;
  paymentStatus: string | null;
  summary: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...order,
    items: parseItemsJson(order.itemsJson),
    deliveryDate: order.deliveryDate?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString()
  };
}

customerRoutes.get("/", async (request, response) => {
  const query = customerListQuerySchema.parse(request.query);
  const where: Prisma.CustomerWhereInput = query.search
    ? {
        OR: [
          {
            displayName: {
              contains: query.search
            }
          },
          {
            phoneRaw: {
              contains: query.search
            }
          },
          {
            profileSummary: {
              contains: query.search
            }
          }
        ]
      }
    : {};

  const customers = await prisma.customer.findMany({
    where,
    skip: query.offset,
    take: query.limit,
    include: {
      _count: {
        select: {
          conversations: true,
          orders: true,
          customerNotes: true
        }
      },
      conversations: {
        orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
        take: 1,
        select: {
          lastMessageAt: true,
          updatedAt: true
        }
      }
    },
    orderBy: [{ updatedAt: "desc" }, { displayName: "asc" }]
  });

  response.json(
    customers.map((customer) => ({
      id: customer.id,
      displayName: customer.displayName,
      phoneRaw: customer.phoneRaw,
      profileSummary: customer.profileSummary,
      usualAddress: customer.usualAddress,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
      counts: {
        conversationCount: customer._count.conversations,
        orderCount: customer._count.orders,
        noteCount: customer._count.customerNotes
      },
      lastConversationAt:
        customer.conversations[0]?.lastMessageAt?.toISOString() ??
        customer.conversations[0]?.updatedAt.toISOString() ??
        null
    }))
  );
});

customerRoutes.get("/:id", async (request, response) => {
  const { id } = idParamsSchema.parse(request.params);

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          conversations: true,
          orders: true,
          customerNotes: true
        }
      },
      customerNotes: {
        orderBy: { createdAt: "desc" },
        take: 20
      },
      conversations: {
        orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
        take: 10,
        include: {
          _count: {
            select: {
              messages: true,
              orders: true,
              suggestedReplies: true
            }
          }
        }
      },
      orders: {
        orderBy: { updatedAt: "desc" },
        take: 10
      }
    }
  });

  if (!customer) {
    throw new NotFoundError("Customer");
  }

  response.json({
    id: customer.id,
    displayName: customer.displayName,
    phoneHash: customer.phoneHash,
    phoneRaw: customer.phoneRaw,
    profileSummary: customer.profileSummary,
    usualAddress: customer.usualAddress,
    preferencesJson: customer.preferencesJson,
    preferences: parsePreferences(customer.preferencesJson),
    notes: customer.notes,
    parsedNotes: parseNotes(customer.notes),
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
    counts: {
      conversationCount: customer._count.conversations,
      orderCount: customer._count.orders,
      noteCount: customer._count.customerNotes
    },
    customerNotes: customer.customerNotes.map((note) => ({
      ...note,
      createdAt: note.createdAt.toISOString()
    })),
    recentConversations: customer.conversations.map((conversation) => ({
      id: conversation.id,
      source: conversation.source,
      whatsappChatName: conversation.whatsappChatName,
      lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
      summary: conversation.summary,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      counts: {
        messageCount: conversation._count.messages,
        orderCount: conversation._count.orders,
        suggestedReplyCount: conversation._count.suggestedReplies
      }
    })),
    recentOrders: customer.orders.map(orderToDto)
  });
});

customerRoutes.get("/:id/timeline", async (request, response) => {
  const { id } = idParamsSchema.parse(request.params);

  const existingCustomer = await prisma.customer.findUnique({
    where: { id }
  });

  if (!existingCustomer) {
    throw new NotFoundError("Customer");
  }

  const [conversations, orders, notes] = await Promise.all([
    prisma.conversation.findMany({
      where: { customerId: id },
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
      take: 30
    }),
    prisma.order.findMany({
      where: { customerId: id },
      orderBy: { updatedAt: "desc" },
      take: 30
    }),
    prisma.customerNote.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
      take: 30
    })
  ]);

  response.json({
    conversations: conversations.map((conversation) => ({
      ...conversation,
      lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString()
    })),
    orders: orders.map(orderToDto),
    notes: notes.map((note) => ({
      ...note,
      createdAt: note.createdAt.toISOString()
    }))
  });
});

customerRoutes.post("/", async (request, response) => {
  const data = createCustomerSchema.parse(request.body);

  const customer = await prisma.customer.create({
    data
  });

  response.status(201).json(customer);
});

customerRoutes.patch("/:id", async (request, response) => {
  const { id } = idParamsSchema.parse(request.params);
  const input = updateCustomerSchema.parse(request.body);

  const existingCustomer = await prisma.customer.findUnique({
    where: { id }
  });

  if (!existingCustomer) {
    throw new NotFoundError("Customer");
  }

  const customer = await prisma.customer.update({
    where: { id },
    data: buildCustomerUpdateData(input)
  });

  response.json({
    ...customer,
    preferences: parsePreferences(customer.preferencesJson),
    parsedNotes: parseNotes(customer.notes)
  });
});

customerRoutes.post("/:id/notes", async (request, response) => {
  const { id } = idParamsSchema.parse(request.params);
  const data = createCustomerNoteSchema.parse(request.body);

  const existingCustomer = await prisma.customer.findUnique({
    where: { id }
  });

  if (!existingCustomer) {
    throw new NotFoundError("Customer");
  }

  const note = await prisma.customerNote.create({
    data: {
      customerId: id,
      note: data.note
    }
  });

  response.status(201).json({
    ...note,
    createdAt: note.createdAt.toISOString()
  });
});

customerRoutes.post("/:id/refresh-memory", async (request, response) => {
  const { id } = idParamsSchema.parse(request.params);
  const result = await refreshCustomerMemory(id);

  if (!result) {
    throw new NotFoundError("Customer");
  }

  response.json({
    customer: {
      ...result.customer,
      preferences: parsePreferences(result.customer.preferencesJson),
      parsedNotes: parseNotes(result.customer.notes)
    },
    warnings: result.warnings
  });
});
