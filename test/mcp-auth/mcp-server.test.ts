import { McpUnauthorizedError } from '../../src/mcp-auth/mcp/errors';
import { createMcpServer, McpServerHandle } from '../../src/mcp-auth/mcp/server';
import type { McpCredentialResolver, McpToolDefinition, McpServerOptions } from '../../src/mcp-auth/mcp/types';

interface TestPrincipal {
  userId: string;
}

function makeServer(overrides: Partial<McpServerOptions<TestPrincipal>> = {}): McpServerHandle {
  const defaultResolver: McpCredentialResolver<TestPrincipal> = {
    resolve: async () => ({ userId: 'user-123' }),
  };

  const defaultTool: McpToolDefinition<TestPrincipal> = {
    name: 'echo',
    description: 'Echo the input',
    inputSchema: { type: 'object', properties: { message: { type: 'string' } } },
    invoke: async (_principal, args) => ({
      content: [{ type: 'text', text: (args as any)?.message ?? 'no message' }],
    }),
  };

  return createMcpServer<TestPrincipal>({
    serverInfo: { name: 'test-server', version: '1.0.0' },
    protocolVersions: ['2025-11-25', '2025-03-26'],
    resolver: defaultResolver,
    tools: [defaultTool],
    ...overrides,
  });
}

function rpcBody(method: string, params?: unknown, id: unknown = 1) {
  return { jsonrpc: '2.0', id, method, params };
}

describe('createMcpServer', () => {
  describe('initialize handshake', () => {
    test('returns server info and capabilities for a supported protocol version', async () => {
      const server = makeServer();
      const result = await server.handle(
        rpcBody('initialize', { protocolVersion: '2025-11-25' }),
        {},
      );

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.result.protocolVersion).toBe('2025-11-25');
      expect(body.result.capabilities).toEqual({ tools: {} });
      expect(body.result.serverInfo).toEqual({ name: 'test-server', version: '1.0.0' });
    });

    test('accepts any supported version', async () => {
      const server = makeServer();
      const result = await server.handle(
        rpcBody('initialize', { protocolVersion: '2025-03-26' }),
        {},
      );

      const body = JSON.parse(result.body);
      expect(body.result.protocolVersion).toBe('2025-03-26');
    });

    test('rejects unsupported protocol version', async () => {
      const server = makeServer();
      const result = await server.handle(
        rpcBody('initialize', { protocolVersion: '1999-01-01' }),
        {},
      );

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe(-32602); // INVALID_PARAMS
      expect(body.error.message).toContain('Unsupported protocol version');
    });

    test('rejects missing protocol version', async () => {
      const server = makeServer();
      const result = await server.handle(
        rpcBody('initialize', {}),
        {},
      );

      const body = JSON.parse(result.body);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe(-32602);
    });
  });

  describe('notifications/initialized', () => {
    test('returns 202 for initialized notification', async () => {
      const server = makeServer();
      const result = await server.handle(
        rpcBody('notifications/initialized'),
        {},
      );

      expect(result.statusCode).toBe(202);
    });
  });

  describe('tools/list', () => {
    test('returns list of available tools', async () => {
      const server = makeServer();
      const result = await server.handle(rpcBody('tools/list'), {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.result.tools).toHaveLength(1);
      expect(body.result.tools[0].name).toBe('echo');
      expect(body.result.tools[0].description).toBe('Echo the input');
      expect(body.result.tools[0].inputSchema).toEqual({
        type: 'object',
        properties: { message: { type: 'string' } },
      });
    });

    test('supports dynamic description function', async () => {
      const server = makeServer({
        tools: [{
          name: 'dynamic',
          description: async (principal: TestPrincipal) => `Hello ${principal.userId}`,
          inputSchema: { type: 'object' },
          invoke: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
        }],
      });

      const result = await server.handle(rpcBody('tools/list'), {});
      const body = JSON.parse(result.body);
      expect(body.result.tools[0].description).toBe('Hello user-123');
    });

    test('returns multiple tools', async () => {
      const server = makeServer({
        tools: [
          {
            name: 'tool-a',
            description: 'Tool A',
            inputSchema: { type: 'object' },
            invoke: async () => ({ content: [{ type: 'text', text: 'a' }] }),
          },
          {
            name: 'tool-b',
            description: 'Tool B',
            inputSchema: { type: 'object' },
            invoke: async () => ({ content: [{ type: 'text', text: 'b' }] }),
          },
        ],
      });

      const result = await server.handle(rpcBody('tools/list'), {});
      const body = JSON.parse(result.body);
      expect(body.result.tools).toHaveLength(2);
      expect(body.result.tools.map((t: any) => t.name)).toEqual(['tool-a', 'tool-b']);
    });
  });

  describe('tools/call', () => {
    test('dispatches to the correct tool and returns result', async () => {
      const server = makeServer();
      const result = await server.handle(
        rpcBody('tools/call', { name: 'echo', arguments: { message: 'hello' } }),
        {},
      );

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.result.content).toEqual([{ type: 'text', text: 'hello' }]);
    });

    test('passes principal to tool invoke', async () => {
      const invokeFn = jest.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });
      const server = makeServer({
        tools: [{
          name: 'auth-tool',
          description: 'Needs auth',
          inputSchema: { type: 'object' },
          invoke: invokeFn,
        }],
      });

      await server.handle(rpcBody('tools/call', { name: 'auth-tool', arguments: {} }), {});
      expect(invokeFn).toHaveBeenCalledWith({ userId: 'user-123' }, {});
    });

    test('returns error for unknown tool name', async () => {
      const server = makeServer();
      const result = await server.handle(
        rpcBody('tools/call', { name: 'nonexistent', arguments: {} }),
        {},
      );

      const body = JSON.parse(result.body);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe(-32602); // INVALID_PARAMS
      expect(body.error.message).toContain('Unknown tool: nonexistent');
    });

    test('returns error when tool name is missing', async () => {
      const server = makeServer();
      const result = await server.handle(
        rpcBody('tools/call', {}),
        {},
      );

      const body = JSON.parse(result.body);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe(-32602);
      expect(body.error.message).toContain('Missing params.name');
    });

    test('returns internal error when tool throws', async () => {
      const server = makeServer({
        tools: [{
          name: 'failing',
          description: 'Always fails',
          inputSchema: { type: 'object' },
          invoke: async () => { throw new Error('boom'); },
        }],
      });

      const result = await server.handle(
        rpcBody('tools/call', { name: 'failing', arguments: {} }),
        {},
      );

      const body = JSON.parse(result.body);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe(-32603); // INTERNAL_ERROR
      expect(body.error.message).toBe('boom');
    });
  });

  describe('unknown method', () => {
    test('returns METHOD_NOT_FOUND for unknown methods', async () => {
      const server = makeServer();
      const result = await server.handle(
        rpcBody('unknown/method'),
        {},
      );

      const body = JSON.parse(result.body);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe(-32601); // METHOD_NOT_FOUND
      expect(body.error.message).toContain('Method not found: unknown/method');
    });
  });

  describe('unauthorized handling', () => {
    test('returns 401 with WWW-Authenticate when resolver throws McpUnauthorizedError', async () => {
      const server = makeServer({
        resolver: {
          resolve: async () => {
            throw new McpUnauthorizedError('Bearer realm="mcp"', 'Invalid token');
          },
        },
      });

      const result = await server.handle(rpcBody('tools/list'), {});

      expect(result.statusCode).toBe(401);
      expect(result.headers['WWW-Authenticate']).toBe('Bearer realm="mcp"');
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Invalid token');
    });

    test('re-throws non-McpUnauthorizedError from resolver', async () => {
      const server = makeServer({
        resolver: {
          resolve: async () => { throw new Error('Unexpected'); },
        },
      });

      await expect(
        server.handle(rpcBody('tools/list'), {}),
      ).rejects.toThrow('Unexpected');
    });

    test('passes headers to resolver', async () => {
      const resolveFn = jest.fn().mockResolvedValue({ userId: 'from-header' });
      const server = makeServer({
        resolver: { resolve: resolveFn },
      });

      await server.handle(rpcBody('tools/list'), { authorization: 'Bearer tok123' });
      expect(resolveFn).toHaveBeenCalledWith({ authorization: 'Bearer tok123' });
    });
  });

  describe('JSON-RPC parsing', () => {
    test('rejects non-object body', async () => {
      const server = makeServer();
      const result = await server.handle('not-an-object', {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe(-32600); // INVALID_REQUEST
    });

    test('rejects body with missing jsonrpc version', async () => {
      const server = makeServer();
      const result = await server.handle({ method: 'initialize', id: 1 }, {});

      const body = JSON.parse(result.body);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe(-32600);
    });

    test('rejects body with missing method', async () => {
      const server = makeServer();
      const result = await server.handle({ jsonrpc: '2.0', id: 1 }, {});

      const body = JSON.parse(result.body);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe(-32600);
    });

    test('preserves request id in responses', async () => {
      const server = makeServer();
      const result = await server.handle(
        rpcBody('initialize', { protocolVersion: '2025-11-25' }, 42),
        {},
      );

      const body = JSON.parse(result.body);
      expect(body.id).toBe(42);
    });

    test('uses null id when request id is missing', async () => {
      const server = makeServer();
      const result = await server.handle(
        { jsonrpc: '2.0', method: 'initialize', params: { protocolVersion: '2025-11-25' } },
        {},
      );

      const body = JSON.parse(result.body);
      expect(body.id).toBeNull();
    });
  });
});
