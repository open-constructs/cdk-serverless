/**
 * Default allowlisted redirect URIs for MCP connector registration.
 * These cover the most common MCP-compatible clients.
 */
export const DEFAULT_ALLOWED_REDIRECT_URIS: readonly string[] = [
  'https://claude.ai/oauth/callback',
  'https://claude.ai/api/mcp/auth_callback',
  'https://chatgpt.com/oauth/callback',
];

/**
 * Returns true if every URI in the list is on the allowlist.
 * Uses the provided allowlist or falls back to the default.
 */
export function validateRedirectUris(uris: string[], allowlist?: readonly string[]): boolean {
  const list = allowlist ?? DEFAULT_ALLOWED_REDIRECT_URIS;
  return uris.every(uri => list.includes(uri));
}
