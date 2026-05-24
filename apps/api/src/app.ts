import express from "express";
import type { AppHealth } from "@wfo/shared";

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

  return app;
}
