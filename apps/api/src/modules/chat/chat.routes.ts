import { Router } from "express";
import { manualChatAnalysisRequestSchema } from "./chat.schemas.js";
import { analyzeManualChat } from "./chat.service.js";

export const chatRoutes = Router();

chatRoutes.post("/analyze-manual", async (request, response) => {
  const input = manualChatAnalysisRequestSchema.parse(request.body);
  const result = await analyzeManualChat(input);

  response.status(201).json(result);
});
