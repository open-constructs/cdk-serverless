/**
 * Configuration for the MCP OAuth façade.
 * Service-agnostic: works with any OAuth2/OIDC provider that exposes
 * a standard authorize + token endpoint.
 */
export interface McpAuthConfig {
  /** The API domain serving as the OAuth issuer (e.g. 'api.example.com') */
  readonly apiDomain: string;

  /**
   * The upstream OAuth authorize endpoint URL.
   * The authorize handler proxies requests here (302 redirect).
   * Example: 'https://auth.example.com/oauth2/authorize'
   */
  readonly authorizeEndpoint: string;

  /**
   * The upstream OAuth token endpoint URL.
   * The token handler proxies requests here.
   * Example: 'https://auth.example.com/oauth2/token'
   */
  readonly tokenEndpoint: string;

  /** Allowed redirect URIs for dynamic client registration */
  readonly allowedRedirectUris: string[];

  /** The pre-provisioned OAuth client ID returned by registration */
  readonly clientId: string;

  /** MCP server info for the initialize response */
  readonly serverInfo: { readonly name: string; readonly version: string };

  /** Supported MCP protocol versions */
  readonly protocolVersions: string[];

  /** OAuth scopes to advertise in discovery metadata */
  readonly scopes?: string[];

  /**
   * Parameters to strip from authorize/token requests before proxying.
   * Defaults to ['resource'] (RFC 8707 not supported by most providers).
   */
  readonly stripParameters?: string[];
}
