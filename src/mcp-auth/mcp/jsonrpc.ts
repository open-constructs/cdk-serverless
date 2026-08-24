import { McpProtocolError } from './errors';

/** Standard JSON-RPC error codes. */
export const PARSE_ERROR = -32700;
export const INVALID_REQUEST = -32600;
export const METHOD_NOT_FOUND = -32601;
export const INVALID_PARAMS = -32602;
export const INTERNAL_ERROR = -32603;

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: unknown;
  method: string;
  params?: unknown;
}

/**
 * Validate and parse a JSON-RPC request from a raw body value.
 * Throws McpProtocolError if the body is malformed.
 */
export function parseJsonRpcRequest(body: unknown): JsonRpcRequest {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new McpProtocolError(INVALID_REQUEST, 'Request body must be a JSON object');
  }

  const obj = body as Record<string, unknown>;

  if (obj.jsonrpc !== '2.0') {
    throw new McpProtocolError(INVALID_REQUEST, 'Invalid or missing jsonrpc version, must be "2.0"');
  }

  if (typeof obj.method !== 'string' || obj.method.length === 0) {
    throw new McpProtocolError(INVALID_REQUEST, 'Missing or invalid method field');
  }

  return {
    jsonrpc: '2.0',
    id: obj.id,
    method: obj.method,
    params: obj.params,
  };
}

/** Build a JSON-RPC success response object. */
export function jsonRpcSuccess(id: unknown, result: unknown): object {
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    result,
  };
}

/** Build a JSON-RPC error response object. */
export function jsonRpcError(id: unknown, code: number, message: string, data?: unknown): object {
  const error: Record<string, unknown> = { code, message };
  if (data !== undefined) {
    error.data = data;
  }
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    error,
  };
}
