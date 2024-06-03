/**
 * A base class for HTTP errors.
 */
export class HttpError extends Error {
  /**
   * Creates an instance of HttpError.
   *
   * @param statusCode - The HTTP status code for the error.
   * @param [message] - The error message.
   */
  constructor(public readonly statusCode: number, message?: string) {
    super(message);
  }
}

/**
 * Represents a 400 Bad Request error.
 */
export class BadRequestError extends HttpError {
  /**
   * Creates an instance of BadRequestError.
   *
   * @param [message] - The error message.
   */
  constructor(message?: string) {
    super(400, message);
  }
}

/**
 * Represents a 401 Unauthenticated error.
 */
export class UnauthenticatedError extends HttpError {
  /**
   * Creates an instance of UnauthenticatedError.
   *
   * @param [message] - The error message.
   */
  constructor(message?: string) {
    super(401, message);
  }
}

/**
 * Represents a 403 Forbidden error.
 */
export class ForbiddenError extends HttpError {
  /**
   * Creates an instance of ForbiddenError.
   *
   * @param [message] - The error message.
   */
  constructor(message?: string) {
    super(403, message);
  }
}

/**
 * Represents a 404 Not Found error.
 */
export class NotFoundError extends HttpError {
  /**
   * Creates an instance of NotFoundError.
   *
   * @param [message] - The error message.
   */
  constructor(message?: string) {
    super(404, message);
  }
}
