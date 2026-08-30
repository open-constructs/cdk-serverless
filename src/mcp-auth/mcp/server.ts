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

    if (!clientVersion) {
      return jsonResponse(200, jsonRpcError(id, INVALID_PARAMS, `Unsupported protocol version. Supported: ${options.protocolVersions.join(', ')}`));
    }

    // Per the MCP lifecycle spec: echo the requested version when we support it,
    // otherwise negotiate to a version we do support. We negotiate *downwards* —
    // the highest supported version that is not newer than the one requested —
    // because clients (e.g. @modelcontextprotocol/sdk <= 1.16.0) reject any
    // negotiated version outside their own accepted set. Answering with a newer
    // version than the client asked for would fail the handshake.
    const negotiatedVersion = negotiateProtocolVersion(clientVersion, options.protocolVersions);

    if (!negotiatedVersion) {
      return jsonResponse(200, jsonRpcError(id, INVALID_PARAMS, `Unsupported protocol version. Supported: ${options.protocolVersions.join(', ')}`));
    }

    return jsonResponse(200, jsonRpcSuccess(id, {
      protocolVersion: negotiatedVersion,
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

/**
 * Selects the protocol version to use for the handshake.
 *
 * Returns the requested version when supported. Otherwise returns the highest
 * supported version that is not newer than the requested one (downward
 * negotiation). Returns undefined when every supported version is newer than
 * the requested one, i.e. no safe downgrade exists.
 *
 * MCP protocol versions are ISO-like `YYYY-MM-DD` strings, so lexicographic
 * comparison matches chronological order.
 */
export function negotiateProtocolVersion(requested: string, supported: string[]): string | undefined {
  if (supported.includes(requested)) {
    return requested;
  }

  const candidates = supported
    .filter((v) => v <= requested)
    .sort();

  return candidates.length > 0 ? candidates[candidates.length - 1] : undefined;
}
