import { z } from "zod";
import {
  nullableJsonStringSchema,
  nullableStringSchema,
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
