import type { McpAuthConfig } from '../../src/mcp-auth/config';
import { createAuthorizationServerHandler } from '../../src/mcp-auth/handlers/authorization-server';
import { createAuthorizeHandler } from '../../src/mcp-auth/handlers/authorize';
import { createProtectedResourceHandler } from '../../src/mcp-auth/handlers/protected-resource';
import { createRegisterHandler } from '../../src/mcp-auth/handlers/register';
import { createTokenHandler } from '../../src/mcp-auth/handlers/token';
import type { McpOAuthEvent } from '../../src/mcp-auth/handlers/types';
import { validateRedirectUris, DEFAULT_ALLOWED_REDIRECT_URIS } from '../../src/mcp-auth/handlers/validate-redirect-uris';

const baseConfig: McpAuthConfig = {
  apiDomain: 'api.example.com',
  authorizeEndpoint: 'https://auth.example.com/oauth2/authorize',
  tokenEndpoint: 'https://auth.example.com/oauth2/token',
  allowedRedirectUris: ['https://claude.ai/oauth/callback', 'https://chatgpt.com/oauth/callback'],
  clientId: 'test-client-id',
  serverInfo: { name: 'test-server', version: '1.0.0' },
  protocolVersions: ['2025-11-25', '2025-03-26'],
  scopes: ['openid', 'email'],
  stripParameters: ['resource'],
};

function makeEvent(overrides: Partial<McpOAuthEvent> = {}): McpOAuthEvent {
  return {
    httpMethod: 'GET',
    path: '/',
    headers: {},
    queryStringParameters: null,
    body: null,
    isBase64Encoded: false,
    ...overrides,
  };
}

describe('createProtectedResourceHandler', () => {
  test('returns resource and authorization_servers based on apiDomain', async () => {
    const handler = createProtectedResourceHandler(baseConfig);
    const result = await handler(makeEvent());

    expect(result.statusCode).toBe(200);
    expect(result.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(result.body!);
    expect(body.resource).toBe('https://api.example.com/mcp');
    expect(body.authorization_servers).toEqual(['https://api.example.com']);
  });
});

describe('createAuthorizationServerHandler', () => {
  test('returns correct OAuth metadata', async () => {
    const handler = createAuthorizationServerHandler(baseConfig);
    const result = await handler(makeEvent());

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body!);

    expect(body.issuer).toBe('https://api.example.com');
    expect(body.authorization_endpoint).toBe('https://api.example.com/oauth/authorize');
    expect(body.token_endpoint).toBe('https://api.example.com/oauth/token');
    expect(body.registration_endpoint).toBe('https://api.example.com/oauth/register');
    expect(body.scopes_supported).toEqual(['openid', 'email']);
    expect(body.response_types_supported).toEqual(['code']);
    expect(body.grant_types_supported).toEqual(['authorization_code', 'refresh_token']);
    expect(body.code_challenge_methods_supported).toEqual(['S256']);
    expect(body.token_endpoint_auth_methods_supported).toEqual(['none']);
  });

  test('uses default scopes when not configured', async () => {
    const config: McpAuthConfig = { ...baseConfig, scopes: undefined };
    const handler = createAuthorizationServerHandler(config);
    const result = await handler(makeEvent());

    const body = JSON.parse(result.body!);
    expect(body.scopes_supported).toEqual(['openid', 'email', 'profile']);
  });
});

describe('createAuthorizeHandler', () => {
  test('redirects to authorizeEndpoint with query params', async () => {
    const handler = createAuthorizeHandler(baseConfig);
    const result = await handler(makeEvent({
      queryStringParameters: {
        client_id: 'my-client',
        redirect_uri: 'https://example.com/callback',
        response_type: 'code',
        state: 'abc123',
      },
    }));

    expect(result.statusCode).toBe(302);
    expect(result.headers['Cache-Control']).toBe('no-cache, no-store');

    const location = result.headers.Location;
    expect(location).toContain('https://auth.example.com/oauth2/authorize?');
    expect(location).toContain('client_id=my-client');
    expect(location).toContain('redirect_uri=');
    expect(location).toContain('response_type=code');
    expect(location).toContain('state=abc123');
  });

  test('strips configured parameters (resource by default)', async () => {
    const handler = createAuthorizeHandler(baseConfig);
    const result = await handler(makeEvent({
      queryStringParameters: {
        client_id: 'my-client',
        resource: 'https://api.example.com/mcp',
        response_type: 'code',
      },
    }));

    const location = result.headers.Location;
    expect(location).not.toContain('resource=');
    expect(location).toContain('client_id=my-client');
    expect(location).toContain('response_type=code');
  });

  test('strips custom parameters when configured', async () => {
    const config: McpAuthConfig = { ...baseConfig, stripParameters: ['resource', 'audience'] };
    const handler = createAuthorizeHandler(config);
    const result = await handler(makeEvent({
      queryStringParameters: {
        client_id: 'my-client',
        resource: 'https://api.example.com/mcp',
        audience: 'aud',
        response_type: 'code',
      },
    }));

    const location = result.headers.Location;
    expect(location).not.toContain('resource=');
    expect(location).not.toContain('audience=');
    expect(location).toContain('client_id=my-client');
  });

  test('uses default stripParameters when not configured', async () => {
    const config: McpAuthConfig = { ...baseConfig, stripParameters: undefined };
    const handler = createAuthorizeHandler(config);
    const result = await handler(makeEvent({
      queryStringParameters: {
        client_id: 'my-client',
        resource: 'should-be-stripped',
      },
    }));

    const location = result.headers.Location;
    expect(location).not.toContain('resource=');
  });
});

describe('createTokenHandler', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('proxies token request to tokenEndpoint', async () => {
    const mockResponse = { access_token: 'tok_123', token_type: 'Bearer' };
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      text: () => Promise.resolve(JSON.stringify(mockResponse)),
    });

    const handler = createTokenHandler(baseConfig);
    const result = await handler(makeEvent({
      httpMethod: 'POST',
      body: 'grant_type=authorization_code&code=abc123&redirect_uri=https%3A%2F%2Fexample.com%2Fcallback',
    }));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body!)).toEqual(mockResponse);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://auth.example.com/oauth2/token',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }),
    );
  });

  test('strips resource parameter from body', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      text: () => Promise.resolve('{}'),
    });

    const handler = createTokenHandler(baseConfig);
    await handler(makeEvent({
      httpMethod: 'POST',
      body: 'grant_type=authorization_code&resource=https%3A%2F%2Fapi.example.com%2Fmcp&code=abc',
    }));

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
    const sentBody = fetchCall[1].body;
    expect(sentBody).not.toContain('resource=');
    expect(sentBody).toContain('grant_type=authorization_code');
    expect(sentBody).toContain('code=abc');
  });

  test('handles base64-encoded body', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      text: () => Promise.resolve('{"ok":true}'),
    });

    const handler = createTokenHandler(baseConfig);
    const bodyPlain = 'grant_type=authorization_code&code=test123';
    const bodyB64 = Buffer.from(bodyPlain).toString('base64');

    await handler(makeEvent({
      httpMethod: 'POST',
      body: bodyB64,
      isBase64Encoded: true,
    }));

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
    const sentBody = fetchCall[1].body;
    expect(sentBody).toContain('grant_type=authorization_code');
    expect(sentBody).toContain('code=test123');
  });

  test('returns 502 when upstream is unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const handler = createTokenHandler(baseConfig);
    const result = await handler(makeEvent({
      httpMethod: 'POST',
      body: 'grant_type=authorization_code&code=abc',
    }));

    expect(result.statusCode).toBe(502);
    const body = JSON.parse(result.body!);
    expect(body.error).toBe('upstream_error');
    expect(body.error_description).toBe('Token endpoint unreachable');
  });

  test('passes through upstream error status codes', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 400,
      text: () => Promise.resolve(JSON.stringify({ error: 'invalid_grant' })),
    });

    const handler = createTokenHandler(baseConfig);
    const result = await handler(makeEvent({
      httpMethod: 'POST',
      body: 'grant_type=authorization_code&code=expired',
    }));

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body!).error).toBe('invalid_grant');
  });
});

describe('createRegisterHandler', () => {
  test('returns client_id for valid redirect URIs', async () => {
    const handler = createRegisterHandler(baseConfig);
    const result = await handler(makeEvent({
      httpMethod: 'POST',
      body: JSON.stringify({
        redirect_uris: ['https://claude.ai/oauth/callback'],
        client_name: 'My MCP Client',
      }),
    }));

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body!);
    expect(body.client_id).toBe('test-client-id');
    expect(body.client_name).toBe('My MCP Client');
    expect(body.redirect_uris).toEqual(['https://claude.ai/oauth/callback']);
    expect(body.token_endpoint_auth_method).toBe('none');
  });

  test('uses default client_name when not provided', async () => {
    const handler = createRegisterHandler(baseConfig);
    const result = await handler(makeEvent({
      httpMethod: 'POST',
      body: JSON.stringify({
        redirect_uris: ['https://claude.ai/oauth/callback'],
      }),
    }));

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body!);
    expect(body.client_name).toBe('MCP Connector');
  });

  test('rejects when redirect_uris is not on the allowlist', async () => {
    const handler = createRegisterHandler(baseConfig);
    const result = await handler(makeEvent({
      httpMethod: 'POST',
      body: JSON.stringify({
        redirect_uris: ['https://evil.com/callback'],
      }),
    }));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body!);
    expect(body.error).toBe('invalid_redirect_uri');
  });

  test('rejects when redirect_uris is missing', async () => {
    const handler = createRegisterHandler(baseConfig);
    const result = await handler(makeEvent({
      httpMethod: 'POST',
      body: JSON.stringify({ client_name: 'Test' }),
    }));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body!);
    expect(body.error).toBe('invalid_request');
    expect(body.error_description).toBe('redirect_uris is required');
  });

  test('rejects when redirect_uris is empty array', async () => {
    const handler = createRegisterHandler(baseConfig);
    const result = await handler(makeEvent({
      httpMethod: 'POST',
      body: JSON.stringify({ redirect_uris: [] }),
    }));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body!);
    expect(body.error).toBe('invalid_request');
  });

  test('rejects malformed JSON body', async () => {
    const handler = createRegisterHandler(baseConfig);
    const result = await handler(makeEvent({
      httpMethod: 'POST',
      body: 'not-json',
    }));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body!);
    expect(body.error).toBe('invalid_request');
    expect(body.error_description).toBe('Malformed JSON body');
  });

  test('rejects non-object body (array)', async () => {
    const handler = createRegisterHandler(baseConfig);
    const result = await handler(makeEvent({
      httpMethod: 'POST',
      body: JSON.stringify([]),
    }));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body!);
    expect(body.error).toBe('invalid_request');
    expect(body.error_description).toBe('Request body must be a JSON object');
  });

  test('handles base64-encoded body', async () => {
    const handler = createRegisterHandler(baseConfig);
    const jsonBody = JSON.stringify({
      redirect_uris: ['https://claude.ai/oauth/callback'],
    });
    const result = await handler(makeEvent({
      httpMethod: 'POST',
      body: Buffer.from(jsonBody).toString('base64'),
      isBase64Encoded: true,
    }));

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body!);
    expect(body.client_id).toBe('test-client-id');
  });
});

describe('validateRedirectUris', () => {
  test('returns true when all URIs are on the allowlist', () => {
    expect(validateRedirectUris(
      ['https://claude.ai/oauth/callback'],
      ['https://claude.ai/oauth/callback', 'https://chatgpt.com/oauth/callback'],
    )).toBe(true);
  });

  test('returns false when any URI is not on the allowlist', () => {
    expect(validateRedirectUris(
      ['https://claude.ai/oauth/callback', 'https://evil.com/callback'],
      ['https://claude.ai/oauth/callback'],
    )).toBe(false);
  });

  test('returns false for completely unknown URIs', () => {
    expect(validateRedirectUris(
      ['https://unknown.com/callback'],
      ['https://claude.ai/oauth/callback'],
    )).toBe(false);
  });

  test('returns true for empty URI list', () => {
    expect(validateRedirectUris([], ['https://claude.ai/oauth/callback'])).toBe(true);
  });

  test('uses DEFAULT_ALLOWED_REDIRECT_URIS when no allowlist provided', () => {
    expect(validateRedirectUris(['https://claude.ai/oauth/callback'])).toBe(true);
    expect(validateRedirectUris(['https://claude.ai/api/mcp/auth_callback'])).toBe(true);
    expect(validateRedirectUris(['https://chatgpt.com/oauth/callback'])).toBe(true);
    expect(validateRedirectUris(['https://unknown.com/callback'])).toBe(false);
  });

  test('DEFAULT_ALLOWED_REDIRECT_URIS contains expected entries', () => {
    expect(DEFAULT_ALLOWED_REDIRECT_URIS).toContain('https://claude.ai/oauth/callback');
    expect(DEFAULT_ALLOWED_REDIRECT_URIS).toContain('https://claude.ai/api/mcp/auth_callback');
    expect(DEFAULT_ALLOWED_REDIRECT_URIS).toContain('https://chatgpt.com/oauth/callback');
  });
});
