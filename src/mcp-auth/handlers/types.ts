/**
 * A generic Lambda-like handler: receives an event (simplified) and returns
 * a response with statusCode, headers, and body.
 */
export interface McpOAuthResponse {
  statusCode: number;
  headers: Record<string, string>;
  body?: string;
}

export interface McpOAuthEvent {
  httpMethod: string;
  path: string;
  headers: Record<string, string | undefined>;
  queryStringParameters: Record<string, string | undefined> | null;
  body: string | null;
  isBase64Encoded: boolean;
}

/**
 * Handler function signature returned by all factories.
 */
export type McpOAuthHandler = (event: McpOAuthEvent) => Promise<McpOAuthResponse>;
