import type { McpAuthConfig } from '../config';
import { validateRedirectUris } from './validate-redirect-uris';
import type { McpOAuthHandler, McpOAuthResponse } from './types';

/**
 * Factory for the `/oauth/register` endpoint (RFC 7591 simplified).
 * Validates redirect URIs against the allowlist and returns the pre-provisioned client_id.
 */
export function createRegisterHandler(config: McpAuthConfig): McpOAuthHandler {
  return async (event): Promise<McpOAuthResponse> => {
    console.log(JSON.stringify({
      event: 'register-oauth-client',
      method: event.httpMethod,
      path: event.path,
    }));

    // Parse body
    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body ?? '', 'base64').toString('utf-8')
      : (event.body ?? '');

    let data: Record<string, unknown>;
    try {
      data = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    } catch {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'invalid_request', error_description: 'Malformed JSON body' }),
      };
    }

    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'invalid_request', error_description: 'Request body must be a JSON object' }),
      };
    }

    const redirectUris = data.redirect_uris as string[] | undefined;
    const clientName = (data.client_name as string) ?? 'MCP Connector';

    if (!redirectUris || !Array.isArray(redirectUris) || redirectUris.length === 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'invalid_request', error_description: 'redirect_uris is required' }),
      };
    }

    if (!validateRedirectUris(redirectUris, config.allowedRedirectUris)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'invalid_redirect_uri', error_description: 'One or more redirect_uris are not allowed' }),
      };
    }

    const response = {
      client_id: config.clientId,
      client_name: clientName,
      redirect_uris: redirectUris,
      token_endpoint_auth_method: 'none',
    };

    console.log(JSON.stringify({ event: 'register-oauth-client-response', status: 201, body: response }));

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response),
    };
  };
}
