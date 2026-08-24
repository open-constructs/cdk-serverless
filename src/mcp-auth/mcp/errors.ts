export class McpUnauthorizedError extends Error {
  public readonly challenge: string;
  constructor(challenge: string, message = 'Unauthorized') {
    super(message);
    this.name = 'McpUnauthorizedError';
    this.challenge = challenge;
  }
}

export class McpProtocolError extends Error {
  public readonly code: number;
  constructor(code: number, message: string) {
    super(message);
    this.name = 'McpProtocolError';
    this.code = code;
  }
}
