import "server-only";

export class ServiceError extends Error {
  constructor(public code: string, public status: number, message: string, public retryable = false) {
    super(message);
  }
}
export const unavailable = (message = "Service configuration is unavailable.") => new ServiceError("SERVICE_UNAVAILABLE", 503, message, true);
export const badInput = (message = "Invalid request.") => new ServiceError("BAD_INPUT", 400, message);
