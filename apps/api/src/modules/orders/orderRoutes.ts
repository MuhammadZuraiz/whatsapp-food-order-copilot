import { Router } from "express";
import { prisma } from "../../db/prisma.js";
import { NotFoundError } from "../../errors.js";
import { idParamsSchema } from "../../schemas/common.js";
import { updateOrderSchema } from "../../schemas/orderSchemas.js";

export const orderRoutes = Router();

orderRoutes.get("/", async (_request, response) => {
  const orders = await prisma.order.findMany({
    include: {
      customer: true,
      conversation: true
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
  });

  response.json(orders);
});

orderRoutes.get("/:id", async (request, response) => {
  const { id } = idParamsSchema.parse(request.params);

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      conversation: true,
      suggestedReplies: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!order) {
    throw new NotFoundError("Order");
  }

  response.json(order);
});

orderRoutes.patch("/:id", async (request, response) => {
  const { id } = idParamsSchema.parse(request.params);
  const data = updateOrderSchema.parse(request.body);

  const existingOrder = await prisma.order.findUnique({
    where: { id }
  });

  if (!existingOrder) {
    throw new NotFoundError("Order");
  }

  const order = await prisma.order.update({
    where: { id },
    data
  });

  response.json(order);
});
