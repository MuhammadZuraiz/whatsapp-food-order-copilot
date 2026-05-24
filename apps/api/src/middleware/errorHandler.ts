import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { ApiError } from "../errors.js";

function isJsonSyntaxError(error: unknown) {
  return (
    error instanceof SyntaxError &&
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === 400 &&
    "body" in error
  );
}

export const notFoundHandler: RequestHandler = (request, response) => {
  response.status(404).json({
    error: {
      message: `Route ${request.method} ${request.originalUrl} not found`
    }
  });
};

export const errorHandler: ErrorRequestHandler = (
  error,
  _request,
  response,
  _next
) => {
  if (isJsonSyntaxError(error)) {
    response.status(400).json({
      error: {
        message: "Invalid JSON body"
      }
    });
    return;
  }

  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        message: "Invalid request body",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      }
    });
    return;
  }

  if (error instanceof ApiError) {
    response.status(error.statusCode).json({
      error: {
        message: error.message
      }
    });
    return;
  }

  console.error(error);

  response.status(500).json({
    error: {
      message: "Internal server error"
    }
  });
};
