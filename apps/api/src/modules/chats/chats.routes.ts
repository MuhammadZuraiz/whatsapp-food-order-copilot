import { Router } from "express";
import { chatImportRequestSchema } from "@wfo/shared";
import { importChat } from "./chats.service.js";

export const chatsRoutes = Router();

chatsRoutes.post("/import", async (request, response) => {
  const input = chatImportRequestSchema.parse(request.body);
  const result = await importChat(input);

  response.status(201).json(result);
});
