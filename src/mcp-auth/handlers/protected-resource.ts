import type { McpAuthConfig } from '../config';
import type { McpOAuthHandler, McpOAuthResponse } from './types';

/**
 * Factory for the `/.well-known/oauth-protected-resource` endpoint (RFC 9728).
 * Returns the resource identifier and authorization servers.
 */
export function createProtectedResourceHandler(config: McpAuthConfig): McpOAuthHandler {
  return async (event): Promise<McpOAuthResponse> => {
    console.log(JSON.stringify({
      event: 'oauth-protected-resource',
      method: event.httpMethod,
      path: event.path,
    }));

    const body = {
      resource: `https://${config.apiDomain}/mcp`,
      authorization_servers: [`https://${config.apiDomain}`],
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    };
  };
}
