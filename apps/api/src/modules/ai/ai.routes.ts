import { Router } from "express";
import { AiService } from "../../ai/AiService.js";
import { aiTestRequestSchema, type AiTestTask } from "../../ai/types.js";

export const aiRoutes = Router();

async function runTask(service: AiService, task: AiTestTask, text: string) {
  if (task === "classifyIntent") {
    return service.classifyIntent(text);
  }

  if (task === "extractOrder") {
    return service.extractOrder(text);
  }

  if (task === "generateSuggestedReplies") {
    return service.generateSuggestedReplies(text);
  }

  return service.analyzeBrandStyle(text);
}

aiRoutes.post("/test", async (request, response) => {
  const input = aiTestRequestSchema.parse(request.body);
  const service = new AiService();
  const result = await runTask(service, input.task, input.text);

  response.json({
    provider: service.providerName,
    result
  });
});
