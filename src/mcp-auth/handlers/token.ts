import type { McpAuthConfig } from '../config';
import type { McpOAuthHandler, McpOAuthResponse } from './types';

const ALLOWED_GRANT_TYPES = ['authorization_code', 'refresh_token'];

/**
 * Factory for the `/oauth/token` proxy endpoint.
 * Forwards token exchange to the upstream token endpoint,
 * stripping configured parameters from the request body.
 */
export function createTokenHandler(config: McpAuthConfig): McpOAuthHandler {
  return async (event): Promise<McpOAuthResponse> => {
    const tokenUrl = config.tokenEndpoint;

    // Decode body if base64-encoded
    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body ?? '', 'base64').toString('utf-8')
      : (event.body ?? '');

    // Parse form-encoded body and strip unsupported parameters
    const params = new URLSearchParams(rawBody);
    const stripParamsList = config.stripParameters ?? ['resource'];
    for (const param of stripParamsList) {
      params.delete(param);
    }

    // Validate grant_type
    const grantType = params.get('grant_type');
    if (!grantType || !ALLOWED_GRANT_TYPES.includes(grantType)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'unsupported_grant_type', error_description: `grant_type must be one of: ${ALLOWED_GRANT_TYPES.join(', ')}` }),
      };
    }

    const body = params.toString();

    console.log(JSON.stringify({
      event: 'oauth-token-proxy',
      tokenUrl,
      grantType,
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
