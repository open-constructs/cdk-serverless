import { aws_cognito } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CognitoAuthentication } from './authentication';
import { LambdaOptions } from './func';
import { McpAuth } from './mcp-auth';

/**
 * Props for creating an McpAuth backed by a Cognito User Pool.
 * This is a convenience wrapper — use McpAuth directly for non-Cognito providers.
 */
export interface McpCognitoAuthProps {
  /**
   * The CognitoAuthentication construct that manages the user pool.
   * A dedicated user pool client will be created for MCP connectors.
   */
  readonly auth: CognitoAuthentication;

  /**
   * The API domain that acts as the MCP OAuth issuer.
   * All discovery endpoints will reference this domain.
   * Example: 'api.example.com'
   */
  readonly apiDomain: string;

  /**
   * The Cognito auth domain (custom domain or Cognito-hosted domain).
   * Authorize and token requests are proxied here.
   * Example: 'auth.example.com' or 'myapp.auth.eu-central-1.amazoncognito.com'
   */
  readonly authDomain: string;

  /**
   * Allowed redirect URIs for dynamic client registration.
   * @default ['https://claude.ai/oauth/callback', 'https://claude.ai/api/mcp/auth_callback', 'https://chatgpt.com/oauth/callback']
   */
  readonly allowedRedirectUris?: string[];

  /**
   * MCP server info returned in the 'initialize' response.
   */
  readonly serverInfo: { readonly name: string; readonly version: string };

  /**
   * Supported MCP protocol versions (newest first).
   * @default ['2025-11-25', '2025-03-26', '2024-11-05']
   */
  readonly protocolVersions?: string[];

  /**
   * OAuth scopes to advertise in discovery metadata.
   * Note: Do NOT include custom resource server scopes here —
   * Cognito Managed Login v2 requires RFC 8707 resource parameter
   * for custom scopes which MCP clients cannot supply.
   * @default ['openid', 'email', 'profile']
   */
  readonly scopes?: string[];

  /**
   * Additional environment variables for MCP auth Lambda functions.
   */
  readonly additionalEnv?: Record<string, string>;

  /**
   * Lambda function options for MCP auth handlers.
   */
  readonly lambdaOptions?: LambdaOptions;

  /**
   * Stage name for function naming and tagging.
   */
  readonly stageName: string;

  /**
   * Construct ID for the user pool client (affects CloudFormation logical ID).
   * @default 'mcpConnector'
   */
  readonly clientConstructId?: string;

  /**
   * Additional OAuth callback URLs to configure on the Cognito client
   * beyond the allowedRedirectUris. Useful if the Cognito client needs
   * URLs that aren't in the MCP registration allowlist.
   */
  readonly additionalCallbackUrls?: string[];
}

/**
 * Convenience construct that creates an McpAuth backed by Amazon Cognito.
 *
 * It creates a dedicated Cognito user pool client configured for the
 * authorization code + PKCE flow and wires it into the generic McpAuth
 * construct. Use this when your authentication is managed by Cognito;
 * use McpAuth directly for other OAuth2/OIDC providers.
 *
 * @example
 * const mcpAuth = new McpCognitoAuth(this, 'McpAuth', {
 *   auth: cognitoAuthentication,
 *   apiDomain: 'api.example.com',
 *   authDomain: 'auth.example.com',
 *   serverInfo: { name: 'my-mcp-server', version: '1.0.0' },
 *   stageName: 'dev',
 * });
 *
 * const api = new MyApiRestApi(this, 'Api', {
 *   mcpAuth: mcpAuth.mcpAuth,
 *   // ...
 * });
 */
export class McpCognitoAuth extends Construct {

  /**
   * The underlying service-agnostic McpAuth construct.
   * Pass this to RestApi's `mcpAuth` prop.
   */
  public readonly mcpAuth: McpAuth;

  /**
   * The Cognito user pool client created for MCP connectors.
   */
  public readonly userPoolClient: aws_cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: McpCognitoAuthProps) {
    super(scope, id);

    const clientId = props.clientConstructId ?? 'mcpConnector';

    const allowedRedirectUris = props.allowedRedirectUris ?? [
      'https://claude.ai/oauth/callback',
      'https://claude.ai/api/mcp/auth_callback',
      'https://chatgpt.com/oauth/callback',
    ];

    // Create a Cognito user pool client with auth code grant + PKCE
    this.userPoolClient = props.auth.addUserPoolClient(clientId, {
      generateSecret: false,
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [
          aws_cognito.OAuthScope.OPENID,
          aws_cognito.OAuthScope.EMAIL,
          aws_cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [
          ...allowedRedirectUris,
          ...(props.additionalCallbackUrls ?? []),
        ],
      },
      authFlows: {
        userSrp: true,
      },
    });

    // Create the generic McpAuth, deriving endpoints from authDomain
    this.mcpAuth = new McpAuth(this, 'McpAuth', {
      apiDomain: props.apiDomain,
      authorizeEndpoint: `https://${props.authDomain}/oauth2/authorize`,
      tokenEndpoint: `https://${props.authDomain}/oauth2/token`,
      allowedRedirectUris,
      clientId: this.userPoolClient.userPoolClientId,
      serverInfo: props.serverInfo,
      protocolVersions: props.protocolVersions,
      scopes: props.scopes,
      additionalEnv: props.additionalEnv,
      lambdaOptions: props.lambdaOptions,
      stageName: props.stageName,
    });
  }
}
