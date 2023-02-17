
export class HttpError extends Error {
  constructor(public readonly statusCode: number, message?: string) {
    super(message);
  }
}

export class BadRequestError extends HttpError {
  constructor(message?: string) {
    super(400, message);
  }
}

export class UnauthenticatedError extends HttpError {
  constructor(message?: string) {
    super(401, message);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message?: string) {
    super(403, message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message?: string) {
    super(404, message);
  }
}
