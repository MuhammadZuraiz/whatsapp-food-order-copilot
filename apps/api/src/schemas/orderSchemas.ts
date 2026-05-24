import { z } from "zod";
import {
  nullableDateSchema,
  nullableJsonStringSchema,
  nullableStringSchema,
  requireAtLeastOneField,
  requiredStringSchema
} from "./common.js";

export const updateOrderSchema = z
  .object({
    status: requiredStringSchema.optional(),
    itemsJson: nullableJsonStringSchema,
    deliveryDate: nullableDateSchema,
    deliveryTime: nullableStringSchema,
    address: nullableStringSchema,
    paymentMethod: nullableStringSchema,
    paymentStatus: nullableStringSchema,
    customRequestsJson: nullableJsonStringSchema,
    missingFieldsJson: nullableJsonStringSchema,
    summary: nullableStringSchema
  })
  .refine(requireAtLeastOneField, {
    message: "At least one field is required"
  });
