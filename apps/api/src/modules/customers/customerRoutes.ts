import { Router } from "express";
import { prisma } from "../../db/prisma.js";
import { NotFoundError } from "../../errors.js";
import { idParamsSchema } from "../../schemas/common.js";
import {
  createCustomerNoteSchema,
  createCustomerSchema
} from "../../schemas/customerSchemas.js";

export const customerRoutes = Router();

customerRoutes.get("/", async (_request, response) => {
  const customers = await prisma.customer.findMany({
    orderBy: [{ updatedAt: "desc" }, { displayName: "asc" }]
  });

  response.json(customers);
});

customerRoutes.get("/:id", async (request, response) => {
  const { id } = idParamsSchema.parse(request.params);

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      customerNotes: {
        orderBy: { createdAt: "desc" }
      },
      conversations: {
        orderBy: { updatedAt: "desc" }
      },
      orders: {
        orderBy: { updatedAt: "desc" }
      }
    }
  });

  if (!customer) {
    throw new NotFoundError("Customer");
  }

  response.json(customer);
});

customerRoutes.post("/", async (request, response) => {
  const data = createCustomerSchema.parse(request.body);

  const customer = await prisma.customer.create({
    data
  });

  response.status(201).json(customer);
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

  response.status(201).json(note);
});
