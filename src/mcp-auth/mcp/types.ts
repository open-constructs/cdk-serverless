export interface McpToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export interface McpToolDefinition<TPrincipal> {
  name: string;
  /** Static text, or resolved per-caller (e.g., personalized source hints). */
  description: string | ((principal: TPrincipal) => Promise<string>);
  inputSchema: object; // JSON Schema
  invoke(principal: TPrincipal, args: unknown): Promise<McpToolResult>;
}

export interface McpCredentialResolver<TPrincipal> {
  /** Throws McpUnauthorizedError when credentials are missing/invalid. */
  resolve(headers: Record<string, string | undefined>): Promise<TPrincipal>;
}

export interface McpServerOptions<TPrincipal> {
  serverInfo: { name: string; version: string };
  protocolVersions: string[]; // Supported versions, newest first
  resolver: McpCredentialResolver<TPrincipal>;
  tools: Array<McpToolDefinition<TPrincipal>>;
}

export interface McpResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}
