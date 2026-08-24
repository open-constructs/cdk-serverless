import { McpUnauthorizedError } from './errors';
import { jsonRpcError, jsonRpcSuccess, INTERNAL_ERROR, INVALID_PARAMS, METHOD_NOT_FOUND, parseJsonRpcRequest } from './jsonrpc';
import type { McpResponse, McpServerOptions } from './types';

export interface McpServerHandle {
  handle(body: unknown, headers: Record<string, string | undefined>): Promise<McpResponse>;
}

/**
 * Creates an MCP JSON-RPC server that authenticates callers,
 * advertises tools, and dispatches tool invocations.
 */
export function createMcpServer<TPrincipal>(options: McpServerOptions<TPrincipal>): McpServerHandle {
  return { handle };

  async function handle(body: unknown, headers: Record<string, string | undefined>): Promise<McpResponse> {
    // 1. Resolve credentials
    let principal: TPrincipal;
    try {
      principal = await options.resolver.resolve(headers);
    } catch (err) {
      if (err instanceof McpUnauthorizedError) {
        return {
          statusCode: 401,
          headers: {
            'Content-Type': 'application/json',
            'WWW-Authenticate': err.challenge,
          },
          body: JSON.stringify({ error: err.message }),
        };
      }
      throw err;
    }

    // 2. Parse JSON-RPC request
    let request;
    try {
      request = parseJsonRpcRequest(body);
    } catch (err: unknown) {
      const code = (err as { code?: number }).code ?? -32600;
      const message = (err as { message?: string }).message ?? 'Invalid request';
      return jsonResponse(200, jsonRpcError(null, code, message));
    }

    // 3. Dispatch on method
    const { id, method, params } = request;

    switch (method) {
      case 'initialize':
        return handleInitialize(id, params);
      case 'notifications/initialized':
        return { statusCode: 202, headers: { 'Content-Type': 'application/json' }, body: '' };
      case 'tools/list':
        return handleToolsList(id, principal);
      case 'tools/call':
        return handleToolsCall(id, principal, params);
      default:
        return jsonResponse(200, jsonRpcError(id, METHOD_NOT_FOUND, `Method not found: ${method}`));
    }
  }

  function handleInitialize(id: unknown, params: unknown): McpResponse {
    const clientVersion = (params as Record<string, unknown> | undefined)?.protocolVersion as string | undefined;

    if (!clientVersion || !options.protocolVersions.includes(clientVersion)) {
      return jsonResponse(200, jsonRpcError(id, INVALID_PARAMS, `Unsupported protocol version. Supported: ${options.protocolVersions.join(', ')}`));
    }

    return jsonResponse(200, jsonRpcSuccess(id, {
      protocolVersion: clientVersion,
      capabilities: { tools: {} },
      serverInfo: options.serverInfo,
    }));
  }

  async function handleToolsList(id: unknown, principal: TPrincipal): Promise<McpResponse> {
    const tools = await Promise.all(
      options.tools.map(async (tool) => {
        const description = typeof tool.description === 'function'
          ? await tool.description(principal)
          : tool.description;
        return {
          name: tool.name,
          description,
          inputSchema: tool.inputSchema,
        };
      }),
    );

    return jsonResponse(200, jsonRpcSuccess(id, { tools }));
  }

  async function handleToolsCall(id: unknown, principal: TPrincipal, params: unknown): Promise<McpResponse> {
    const p = params as Record<string, unknown> | undefined;
    const toolName = p?.name as string | undefined;

    if (!toolName) {
      return jsonResponse(200, jsonRpcError(id, INVALID_PARAMS, 'Missing params.name'));
    }

    const tool = options.tools.find((t) => t.name === toolName);
    if (!tool) {
      return jsonResponse(200, jsonRpcError(id, INVALID_PARAMS, `Unknown tool: ${toolName}`));
    }

    try {
      const result = await tool.invoke(principal, p?.arguments);
      return jsonResponse(200, jsonRpcSuccess(id, result));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal error';
      return jsonResponse(200, jsonRpcError(id, INTERNAL_ERROR, message));
    }
  }

  function jsonResponse(statusCode: number, body: object): McpResponse {
    return {
      statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    };
  }
}
