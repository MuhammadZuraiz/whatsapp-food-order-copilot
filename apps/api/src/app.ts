import express from "express";
import type { AppHealth } from "@wfo/shared";
import {
  errorHandler,
  notFoundHandler
} from "./middleware/errorHandler.js";
import { apiRoutes } from "./routes/index.js";

export function createApp() {
  const app = express();

  app.use(express.json());

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
