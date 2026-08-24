import type { McpAuthConfig } from '../config';
import type { McpOAuthHandler, McpOAuthResponse } from './types';

/**
 * Factory for the `/oauth/token` proxy endpoint.
 * Forwards token exchange to the upstream token endpoint,
 * stripping configured parameters from the request body.
 */
export function createTokenHandler(config: McpAuthConfig): McpOAuthHandler {
  return async (event): Promise<McpOAuthResponse> => {
    const tokenUrl = config.tokenEndpoint;

    // Decode body if base64-encoded
    let body = event.isBase64Encoded
      ? Buffer.from(event.body ?? '', 'base64').toString('utf-8')
      : (event.body ?? '');

    // Strip unsupported parameters from form-encoded body
    const stripParams = config.stripParameters ?? ['resource'];
    for (const param of stripParams) {
      body = body.replace(new RegExp(`&${param}=[^&]*`, 'g'), '');
      body = body.replace(new RegExp(`^${param}=[^&]*&?`), '');
    }

    console.log(JSON.stringify({
      event: 'oauth-token-proxy',
      tokenUrl,
      grantType: body.match(/grant_type=([^&]*)/)?.[1],
    }));

    let responseBody: string;
    let statusCode: number;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: controller.signal,
      });
      responseBody = await response.text();
      statusCode = response.status;
    } catch (err) {
      console.log(JSON.stringify({ event: 'oauth-token-proxy-error', error: (err as Error).message }));
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'upstream_error', error_description: 'Token endpoint unreachable' }),
      };
    } finally {
      clearTimeout(timeout);
    }

    console.log(JSON.stringify({
      event: 'oauth-token-proxy-response',
      status: statusCode,
    }));

    return {
      statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: responseBody,
    };
  };
}
