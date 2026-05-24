import { z } from "zod";

export const idParamsSchema = z.object({
  id: z.string().trim().min(1)
});

export const requiredStringSchema = z.string().trim().min(1);

export const nullableStringSchema = z
  .string()
  .trim()
  .min(1)
  .nullable()
  .optional();

const jsonValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.unknown()),
  z.record(z.string(), z.unknown())
]);

export const nullableJsonStringSchema = jsonValueSchema
  .optional()
  .transform((value) => {
    if (value === undefined || value === null) {
      return value;
    }

    return typeof value === "string" ? value : JSON.stringify(value);
  });

export const nullableDateSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Invalid date"
  })
  .nullable()
  .optional()
  .transform((value) => {
    if (value === undefined || value === null) {
      return value;
    }

    return new Date(value);
  });

export function requireAtLeastOneField<T extends Record<string, unknown>>(
  value: T
) {
  return Object.keys(value).length > 0;
}
