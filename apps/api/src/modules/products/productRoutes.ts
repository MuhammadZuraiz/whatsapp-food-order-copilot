import { Router } from "express";
import { prisma } from "../../db/prisma.js";
import { NotFoundError } from "../../errors.js";
import { idParamsSchema } from "../../schemas/common.js";
import {
  createProductSchema,
  updateProductSchema
} from "../../schemas/productSchemas.js";

export const productRoutes = Router();

productRoutes.get("/", async (_request, response) => {
  const products = await prisma.product.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }]
  });

  response.json(products);
});

productRoutes.post("/", async (request, response) => {
  const data = createProductSchema.parse(request.body);

  const product = await prisma.product.create({
    data
  });

  response.status(201).json(product);
});

productRoutes.patch("/:id", async (request, response) => {
  const { id } = idParamsSchema.parse(request.params);
  const data = updateProductSchema.parse(request.body);

  const existingProduct = await prisma.product.findUnique({
    where: { id }
  });

  if (!existingProduct) {
    throw new NotFoundError("Product");
  }

  const product = await prisma.product.update({
    where: { id },
    data
  });

  response.json(product);
});

productRoutes.delete("/:id", async (request, response) => {
  const { id } = idParamsSchema.parse(request.params);

  const existingProduct = await prisma.product.findUnique({
    where: { id }
  });

  if (!existingProduct) {
    throw new NotFoundError("Product");
  }

  await prisma.product.delete({
    where: { id }
  });

  response.status(204).send();
});
