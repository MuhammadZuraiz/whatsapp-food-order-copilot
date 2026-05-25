import { Router } from "express";
import { brandStyleAnalyzeRequestSchema } from "@wfo/shared";
import {
  analyzeBrandStyleFromStoredConversations,
  getCurrentBrandStyleProfile
} from "./brandStyle.service.js";

export const brandStyleRoutes = Router();

brandStyleRoutes.get("/", async (_request, response) => {
  response.json(await getCurrentBrandStyleProfile());
});

brandStyleRoutes.post("/analyze", async (request, response) => {
  const input = brandStyleAnalyzeRequestSchema.parse(request.body);
  const result = await analyzeBrandStyleFromStoredConversations(input);

  response.json(result);
});
