import { z } from "zod";
import {
  nullableJsonStringSchema,
  nullableStringSchema,
  requireAtLeastOneField,
  requiredStringSchema
} from "./common.js";

export const createCustomerSchema = z.object({
  displayName: requiredStringSchema,
  phoneHash: nullableStringSchema,
  phoneRaw: nullableStringSchema,
  profileSummary: nullableStringSchema,
  usualAddress: nullableStringSchema,
  preferencesJson: nullableJsonStringSchema,
  notes: nullableStringSchema
});

export const createCustomerNoteSchema = z.object({
  note: requiredStringSchema
});

export const updateCustomerSchema = z
  .object({
    displayName: requiredStringSchema.optional(),
    phoneRaw: nullableStringSchema,
    profileSummary: nullableStringSchema,
    usualAddress: nullableStringSchema,
    preferencesJson: nullableJsonStringSchema,
    preferences: z
      .union([
        z.array(z.string().trim().min(1)),
        z.string().trim().min(1)
      ])
      .optional(),
    notes: nullableStringSchema
  })
  .refine(requireAtLeastOneField, {
    message: "At least one field is required"
  });

export const customerListQuerySchema = z.object({
  search: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0)
});
