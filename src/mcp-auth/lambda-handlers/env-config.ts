import type { McpAuthConfig } from '../config';

const REQUIRED_ENV_VARS = [
  'MCP_API_DOMAIN',
  'MCP_AUTHORIZE_ENDPOINT',
  'MCP_TOKEN_ENDPOINT',
  'MCP_CLIENT_ID',
  'MCP_SERVER_NAME',
  'MCP_SERVER_VERSION',
] as const;

/**
 * Read MCP auth configuration from environment variables.
 * Used by all Lambda handler entry points.
 * Throws a descriptive error if any required env var is missing or empty.
 */
export function getConfigFromEnv(): McpAuthConfig {
  const missing = REQUIRED_ENV_VARS.filter(name => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`MCP Auth: missing required environment variables: ${missing.join(', ')}`);
  }

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
