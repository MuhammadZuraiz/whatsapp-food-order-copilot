import { Router } from "express";
import { AiService } from "../../ai/AiService.js";
import { getAiRuntimeConfig } from "../../ai/config.js";
import { aiTestRequestSchema, type AiTestTask } from "../../ai/types.js";

export const aiRoutes = Router();

async function runTask(service: AiService, task: AiTestTask, text: string) {
  if (task === "generate") {
    return {
      text: await service.generateText(text)
    };
  }

  if (task === "classifyIntent") {
    return service.classifyIntent(text);
  }

  if (task === "extractOrder") {
    return service.extractOrder(text);
  }

  if (task === "updateCustomerMemory") {
    return service.updateCustomerMemory(text);
  }

  if (task === "generateSuggestedReplies") {
    return service.generateSuggestedReplies(text);
  }

  return service.analyzeBrandStyle(text);
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown AI provider error.";
}

aiRoutes.get("/config", (_request, response) => {
  response.json(getAiRuntimeConfig());
});

aiRoutes.post("/test", async (request, response) => {
  const input = aiTestRequestSchema.parse(request.body);
  const service = new AiService();

  try {
    const result = await runTask(service, input.task, input.text);

    if (service.usedFallback) {
      response.status(502).json({
        provider: service.providerName,
        error: {
          message:
            "AI provider failed or returned invalid structured output; safe fallback result returned.",
          warnings: service.warnings
        },
        result
      });
      return;
    }

    response.json({
      provider: service.providerName,
      result
    });
  } catch (error) {
    response.status(502).json({
      provider: service.providerName,
      error: {
        message: safeErrorMessage(error)
      }
    });
  }
});
