import type { McpAuthConfig } from '../config';
import type { McpOAuthHandler, McpOAuthResponse } from './types';

/**
 * Factory for the `/.well-known/oauth-authorization-server` endpoint (RFC 8414).
 * Returns OAuth server metadata with all endpoint URLs pointing to the API domain.
 */
export function createAuthorizationServerHandler(config: McpAuthConfig): McpOAuthHandler {
  return async (event): Promise<McpOAuthResponse> => {
    console.log(JSON.stringify({
      event: 'oauth-authorization-server',
      method: event.httpMethod,
      path: event.path,
    }));

    const scopes = config.scopes ?? ['openid', 'email', 'profile'];
    const body = {
      issuer: `https://${config.apiDomain}`,
      authorization_endpoint: `https://${config.apiDomain}/oauth/authorize`,
      token_endpoint: `https://${config.apiDomain}/oauth/token`,
      registration_endpoint: `https://${config.apiDomain}/oauth/register`,
      scopes_supported: scopes,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    };
  };
}
