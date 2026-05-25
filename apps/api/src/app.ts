import express from "express";
import type { AppHealth } from "@wfo/shared";
import {
  errorHandler,
  notFoundHandler
} from "./middleware/errorHandler.js";
import { apiRoutes } from "./routes/index.js";

export function createApp() {
  const app = express();
  const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";

  app.use((request, response, next) => {
    response.setHeader("Access-Control-Allow-Origin", corsOrigin);
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    response.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PATCH,DELETE,OPTIONS"
    );

    if (request.method === "OPTIONS") {
      response.status(204).send();
      return;
    }

    next();
  });

  app.use(express.json({ limit: "10mb" }));

  app.get("/health", (_request, response) => {
    const health: AppHealth = {
      status: "ok",
      service: "api",
      timestamp: new Date().toISOString()
    };

    response.status(200).json(health);
  });

  app.use("/api", apiRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
