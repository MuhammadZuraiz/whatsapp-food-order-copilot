import { z } from "zod";
import {
  nullableJsonStringSchema,
  nullableStringSchema,
  requireAtLeastOneField,
  requiredStringSchema
} from "./common.js";

const productFieldsSchema = {
  name: requiredStringSchema,
  category: nullableStringSchema,
  price: z.number().finite().nonnegative().nullable().optional(),
  description: nullableStringSchema,
  availabilityJson: nullableJsonStringSchema,
  customOptionsJson: nullableJsonStringSchema,
  minimumNoticeHours: z.number().int().min(0).nullable().optional(),
  isActive: z.boolean().optional(),
  notes: nullableStringSchema
};

export const createProductSchema = z.object(productFieldsSchema);

export const updateProductSchema = z
  .object({
    ...productFieldsSchema,
    name: requiredStringSchema.optional()
  })
  .refine(requireAtLeastOneField, {
    message: "At least one field is required"
  });
