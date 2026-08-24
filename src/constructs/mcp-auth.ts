import * as path from 'node:path';
import { Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { LambdaFunction, LambdaOptions } from './func';

/**
 * Configuration for the MCP Auth CDK construct.
 * Service-agnostic: works with any OAuth2/OIDC provider.
 */
export interface McpAuthProps {
  /**
   * The API domain that acts as the MCP OAuth issuer.
   * All OAuth discovery endpoints will reference this domain.
   * Example: 'api.example.com'
   */
  readonly apiDomain: string;

  /**
   * The upstream OAuth authorize endpoint URL.
   * The authorize Lambda proxies (302 redirects) to this URL.
   * Example: 'https://auth.example.com/oauth2/authorize'
   */
  readonly authorizeEndpoint: string;

  /**
   * The upstream OAuth token endpoint URL.
   * The token Lambda proxies POST requests to this URL.
   * Example: 'https://auth.example.com/oauth2/token'
   */
  readonly tokenEndpoint: string;

  /**
   * Allowed redirect URIs for dynamic client registration.
   * Clients registering with URIs not in this list are rejected.
   */
  readonly allowedRedirectUris: string[];

  /**
   * The pre-provisioned OAuth client ID returned by the register endpoint.
   */
  readonly clientId: string;

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
   * @default ['openid', 'email', 'profile']
   */
  readonly scopes?: string[];

  /**
   * Parameters to strip from authorize/token proxy requests.
   * @default ['resource']
   */
  readonly stripParameters?: string[];

  /**
   * Additional environment variables to inject into all MCP auth Lambda functions.
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
}

/**
 * Provides the Lambda function references for MCP OAuth endpoints.
 * These can be wired into API Gateway (via RestApi integration)
 * or used standalone.
 */
export interface McpAuthFunctions {
  /** GET /.well-known/oauth-protected-resource */
  readonly protectedResource: LambdaFunction;
  /** GET /.well-known/oauth-authorization-server */
  readonly authorizationServer: LambdaFunction;
  /** GET /oauth/authorize */
  readonly authorize: LambdaFunction;
  /** POST /oauth/token */
  readonly token: LambdaFunction;
  /** POST /oauth/register */
  readonly register: LambdaFunction;
}

/**
 * CDK construct that creates Lambda functions for the MCP OAuth façade.
 * Service-agnostic — proxies authorize/token requests to any upstream
 * OAuth2/OIDC provider.
 *
 * Use with `RestApi` by passing `mcpAuth` prop, which auto-injects the
 * required paths into the OpenAPI spec and wires Lambda integrations.
 *
 * @example
 * const mcpAuth = new McpAuth(this, 'McpAuth', {
 *   apiDomain: 'api.example.com',
 *   authorizeEndpoint: 'https://auth.example.com/oauth2/authorize',
 *   tokenEndpoint: 'https://auth.example.com/oauth2/token',
 *   allowedRedirectUris: ['https://claude.ai/oauth/callback'],
 *   clientId: 'my-client-id',
 *   serverInfo: { name: 'my-mcp-server', version: '1.0.0' },
 *   stageName: 'dev',
 * });
 */
export class McpAuth extends Construct {

  /**
   * The Lambda functions created for the OAuth endpoints.
   */
  public readonly functions: McpAuthFunctions;

  /**
   * The environment variables map that should be injected into the MCP RPC
   * handler Lambda (if you have one) so it can read MCP config at runtime.
   */
  public readonly mcpEnvVars: Record<string, string>;

  constructor(scope: Construct, id: string, props: McpAuthProps) {
    super(scope, id);

    const env: Record<string, string> = {
      MCP_API_DOMAIN: props.apiDomain,
      MCP_AUTHORIZE_ENDPOINT: props.authorizeEndpoint,
      MCP_TOKEN_ENDPOINT: props.tokenEndpoint,
      MCP_CLIENT_ID: props.clientId,
      MCP_SERVER_NAME: props.serverInfo.name,
      MCP_SERVER_VERSION: props.serverInfo.version,
      MCP_PROTOCOL_VERSIONS: (props.protocolVersions ?? ['2025-11-25', '2025-03-26', '2024-11-05']).join(','),
      MCP_SCOPES: (props.scopes ?? ['openid', 'email', 'profile']).join(','),
      MCP_ALLOWED_REDIRECT_URIS: props.allowedRedirectUris.join(','),
      MCP_STRIP_PARAMETERS: (props.stripParameters ?? ['resource']).join(','),
      ...props.additionalEnv,
    };

    this.mcpEnvVars = env;

    const handlersDir = path.join(__dirname, '..', 'mcp-auth', 'lambda-handlers');

    const baseLambdaOptions: LambdaOptions = {
      timeout: Duration.seconds(15),
      ...props.lambdaOptions,
    };

    const protectedResource = new LambdaFunction(this, 'ProtectedResourceFn', {
      stageName: props.stageName,
      entry: path.join(handlersDir, 'protected-resource.handler.js'),
      description: `[${props.stageName}] MCP OAuth Protected Resource`,
      additionalEnv: env,
      lambdaOptions: baseLambdaOptions,
    });

    const authorizationServer = new LambdaFunction(this, 'AuthorizationServerFn', {
      stageName: props.stageName,
      entry: path.join(handlersDir, 'authorization-server.handler.js'),
      description: `[${props.stageName}] MCP OAuth Authorization Server`,
      additionalEnv: env,
      lambdaOptions: baseLambdaOptions,
    });

    const authorize = new LambdaFunction(this, 'AuthorizeFn', {
      stageName: props.stageName,
      entry: path.join(handlersDir, 'authorize.handler.js'),
      description: `[${props.stageName}] MCP OAuth Authorize Proxy`,
      additionalEnv: env,
      lambdaOptions: baseLambdaOptions,
    });

    const token = new LambdaFunction(this, 'TokenFn', {
      stageName: props.stageName,
      entry: path.join(handlersDir, 'token.handler.js'),
      description: `[${props.stageName}] MCP OAuth Token Proxy`,
      additionalEnv: env,
      lambdaOptions: baseLambdaOptions,
    });

    const register = new LambdaFunction(this, 'RegisterFn', {
      stageName: props.stageName,
      entry: path.join(handlersDir, 'register.handler.js'),
      description: `[${props.stageName}] MCP OAuth Register`,
      additionalEnv: env,
      lambdaOptions: baseLambdaOptions,
    });

    this.functions = {
      protectedResource,
      authorizationServer,
      authorize,
      token,
      register,
    };
  }
}
