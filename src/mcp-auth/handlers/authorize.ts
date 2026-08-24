import type { McpAuthConfig } from '../config';
import type { McpOAuthHandler, McpOAuthResponse } from './types';

/**
 * Factory for the `/oauth/authorize` proxy endpoint.
 * Strips configured parameters (default: 'resource') before redirecting
 * to the upstream authorization endpoint.
 */
export function createAuthorizeHandler(config: McpAuthConfig): McpOAuthHandler {
  return async (event): Promise<McpOAuthResponse> => {
    const params = new URLSearchParams(event.queryStringParameters as Record<string, string>);

    // Strip unsupported parameters (e.g. RFC 8707 'resource')
    const stripParams = config.stripParameters ?? ['resource'];
    for (const param of stripParams) {
      params.delete(param);
    }

    const upstreamUrl = `${config.authorizeEndpoint}?${params.toString()}`;

    console.log(JSON.stringify({
      event: 'oauth-authorize-proxy',
      upstreamUrl,
      strippedParams: stripParams.filter(p => event.queryStringParameters?.[p]),
    }));

    return {
      statusCode: 302,
      headers: {
        Location: upstreamUrl,
        'Cache-Control': 'no-cache, no-store',
      },
    };
  };
}
