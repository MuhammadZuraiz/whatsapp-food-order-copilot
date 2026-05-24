export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super(404, `${resource} not found`);
    this.name = "NotFoundError";
  }
}
