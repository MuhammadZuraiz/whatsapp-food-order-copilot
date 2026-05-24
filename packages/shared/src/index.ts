import { z } from "zod";

export const appHealthSchema = z.object({
  status: z.literal("ok"),
  service: z.string(),
  timestamp: z.string().datetime()
});

export type AppHealth = z.infer<typeof appHealthSchema>;

export type DeliveryMode = "future_delivery";

export type HumanApprovalMode = "required";
