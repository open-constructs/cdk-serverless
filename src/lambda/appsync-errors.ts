/**
 * A base class for typed AppSync resolver errors.
 *
 * When thrown inside a `createAppSyncHandler` resolver, the handler returns a
 * direct-Lambda error envelope so AppSync surfaces the error as a GraphQL error
 * on a successful Lambda invocation.
 */
export class AppSyncError extends Error {
  /**
   * Creates an instance of AppSyncError.
   *
   * @param errorType - The error type reported to AppSync.
   * @param [message] - The error message.
   * @param [errorInfo] - Optional additional error information passed through to the client.
   */
  constructor(
    public readonly errorType: string,
    message?: string,
    public readonly errorInfo?: Record<string, any>,
  ) {
    super(message);
    this.name = 'AppSyncError';
  }
}

/**
 * Represents a Forbidden AppSync error.
 */
export class ForbiddenError extends AppSyncError {
  /**
   * Creates an instance of ForbiddenError.
   *
   * @param [message] - The error message.
   * @param [errorInfo] - Optional additional error information passed through to the client.
   */
  constructor(message?: string, errorInfo?: Record<string, any>) {
    super('Forbidden', message, errorInfo);
    this.name = 'ForbiddenError';
  }
}

/**
 * Represents a NotFound AppSync error.
 */
export class NotFoundError extends AppSyncError {
  /**
   * Creates an instance of NotFoundError.
   *
   * @param [message] - The error message.
   * @param [errorInfo] - Optional additional error information passed through to the client.
   */
  constructor(message?: string, errorInfo?: Record<string, any>) {
    super('NotFound', message, errorInfo);
    this.name = 'NotFoundError';
  }
}

/**
 * Represents a ValidationError AppSync error.
 */
export class ValidationError extends AppSyncError {
  /**
   * Creates an instance of ValidationError.
   *
   * @param [message] - The error message.
   * @param [errorInfo] - Optional additional error information passed through to the client.
   */
  constructor(message?: string, errorInfo?: Record<string, any>) {
    super('ValidationError', message, errorInfo);
    this.name = 'ValidationError';
  }
}

/**
 * Represents a Conflict AppSync error.
 */
export class ConflictError extends AppSyncError {
  /**
   * Creates an instance of ConflictError.
   *
   * @param [message] - The error message.
   * @param [errorInfo] - Optional additional error information passed through to the client.
   */
  constructor(message?: string, errorInfo?: Record<string, any>) {
    super('Conflict', message, errorInfo);
    this.name = 'ConflictError';
  }
}
