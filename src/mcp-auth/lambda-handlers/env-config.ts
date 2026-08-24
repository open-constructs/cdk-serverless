import type { McpAuthConfig } from '../config';

/**
 * Read MCP auth configuration from environment variables.
 * Used by all Lambda handler entry points.
 */
export function getConfigFromEnv(): McpAuthConfig {
  return {
    apiDomain: process.env.MCP_API_DOMAIN!,
    authorizeEndpoint: process.env.MCP_AUTHORIZE_ENDPOINT!,
    tokenEndpoint: process.env.MCP_TOKEN_ENDPOINT!,
    clientId: process.env.MCP_CLIENT_ID!,
    allowedRedirectUris: (process.env.MCP_ALLOWED_REDIRECT_URIS ?? '').split(',').filter(Boolean),
    serverInfo: {
      name: process.env.MCP_SERVER_NAME!,
      version: process.env.MCP_SERVER_VERSION!,
    },
    protocolVersions: (process.env.MCP_PROTOCOL_VERSIONS ?? '').split(',').filter(Boolean),
    scopes: (process.env.MCP_SCOPES ?? '').split(',').filter(Boolean),
    stripParameters: (process.env.MCP_STRIP_PARAMETERS ?? 'resource').split(',').filter(Boolean),
  };
}
