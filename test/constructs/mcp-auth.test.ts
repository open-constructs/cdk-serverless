import { App, Stack } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { McpAuth } from '../../src/constructs/mcp-auth';

// Mock the LambdaFunction to avoid NodejsFunction bundling issues
jest.mock('../../src/constructs/func', () => {
  const awsLambda = jest.requireActual('aws-cdk-lib/aws-lambda');
  const { Construct } = jest.requireActual('constructs');

  class MockLambdaFunction extends awsLambda.Function {
    constructor(scope: typeof Construct, id: string, props: any) {
      super(scope, id, {
        runtime: awsLambda.Runtime.NODEJS_18_X,
        handler: 'index.handler',
        code: awsLambda.Code.fromInline('exports.handler = async () => {}'),
        description: props.description,
        environment: props.additionalEnv,
      });
    }
  }

  return {
    LambdaFunction: MockLambdaFunction,
  };
});

describe('McpAuth', () => {
  let app: App;
  let stack: Stack;

  const defaultProps = {
    apiDomain: 'api.example.com',
    authorizeEndpoint: 'https://auth.example.com/oauth2/authorize',
    tokenEndpoint: 'https://auth.example.com/oauth2/token',
    allowedRedirectUris: ['https://claude.ai/oauth/callback'],
    clientId: 'test-client-id',
    serverInfo: { name: 'test-server', version: '1.0.0' },
    stageName: 'dev',
  };

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack');
  });

  test('creates 5 Lambda functions', () => {
    new McpAuth(stack, 'McpAuth', defaultProps);

    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::Lambda::Function', 5);
  });

  test('Lambda functions have correct descriptions', () => {
    new McpAuth(stack, 'McpAuth', defaultProps);

    const template = Template.fromStack(stack);
    const lambdas = template.findResources('AWS::Lambda::Function');
    const descriptions = Object.values(lambdas).map((fn: any) => fn.Properties.Description);

    expect(descriptions).toContain('[dev] MCP OAuth Protected Resource');
    expect(descriptions).toContain('[dev] MCP OAuth Authorization Server');
    expect(descriptions).toContain('[dev] MCP OAuth Authorize Proxy');
    expect(descriptions).toContain('[dev] MCP OAuth Token Proxy');
    expect(descriptions).toContain('[dev] MCP OAuth Register');
  });

  test('Lambda functions have MCP_API_DOMAIN environment variable', () => {
    new McpAuth(stack, 'McpAuth', defaultProps);

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          MCP_API_DOMAIN: 'api.example.com',
        }),
      },
    });
  });

  test('Lambda functions have MCP_AUTHORIZE_ENDPOINT environment variable', () => {
    new McpAuth(stack, 'McpAuth', defaultProps);

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          MCP_AUTHORIZE_ENDPOINT: 'https://auth.example.com/oauth2/authorize',
        }),
      },
    });
  });

  test('Lambda functions have MCP_TOKEN_ENDPOINT environment variable', () => {
    new McpAuth(stack, 'McpAuth', defaultProps);

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          MCP_TOKEN_ENDPOINT: 'https://auth.example.com/oauth2/token',
        }),
      },
    });
  });

  test('Lambda functions have MCP_CLIENT_ID environment variable', () => {
    new McpAuth(stack, 'McpAuth', defaultProps);

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          MCP_CLIENT_ID: 'test-client-id',
        }),
      },
    });
  });

  test('Lambda functions have all required MCP environment variables', () => {
    new McpAuth(stack, 'McpAuth', defaultProps);

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          MCP_API_DOMAIN: 'api.example.com',
          MCP_AUTHORIZE_ENDPOINT: 'https://auth.example.com/oauth2/authorize',
          MCP_TOKEN_ENDPOINT: 'https://auth.example.com/oauth2/token',
          MCP_CLIENT_ID: 'test-client-id',
          MCP_SERVER_NAME: 'test-server',
          MCP_SERVER_VERSION: '1.0.0',
          MCP_PROTOCOL_VERSIONS: '2025-11-25,2025-03-26,2024-11-05',
          MCP_SCOPES: 'openid,email,profile',
          MCP_ALLOWED_REDIRECT_URIS: 'https://claude.ai/oauth/callback',
          MCP_STRIP_PARAMETERS: 'resource',
        }),
      },
    });
  });

  test('uses custom protocol versions when provided', () => {
    new McpAuth(stack, 'McpAuth', {
      ...defaultProps,
      protocolVersions: ['2025-11-25'],
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          MCP_PROTOCOL_VERSIONS: '2025-11-25',
        }),
      },
    });
  });

  test('uses custom scopes when provided', () => {
    new McpAuth(stack, 'McpAuth', {
      ...defaultProps,
      scopes: ['openid', 'custom:read'],
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          MCP_SCOPES: 'openid,custom:read',
        }),
      },
    });
  });

  test('uses custom strip parameters when provided', () => {
    new McpAuth(stack, 'McpAuth', {
      ...defaultProps,
      stripParameters: ['resource', 'audience'],
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          MCP_STRIP_PARAMETERS: 'resource,audience',
        }),
      },
    });
  });

  test('includes additional env variables when provided', () => {
    new McpAuth(stack, 'McpAuth', {
      ...defaultProps,
      additionalEnv: { CUSTOM_VAR: 'custom-value' },
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          CUSTOM_VAR: 'custom-value',
        }),
      },
    });
  });

  test('exposes mcpEnvVars with all config values', () => {
    const mcpAuth = new McpAuth(stack, 'McpAuth', defaultProps);

    expect(mcpAuth.mcpEnvVars).toEqual(expect.objectContaining({
      MCP_API_DOMAIN: 'api.example.com',
      MCP_AUTHORIZE_ENDPOINT: 'https://auth.example.com/oauth2/authorize',
      MCP_TOKEN_ENDPOINT: 'https://auth.example.com/oauth2/token',
      MCP_CLIENT_ID: 'test-client-id',
      MCP_SERVER_NAME: 'test-server',
      MCP_SERVER_VERSION: '1.0.0',
    }));
  });

  test('exposes functions property with all 5 function references', () => {
    const mcpAuth = new McpAuth(stack, 'McpAuth', defaultProps);

    expect(mcpAuth.functions.protectedResource).toBeDefined();
    expect(mcpAuth.functions.authorizationServer).toBeDefined();
    expect(mcpAuth.functions.authorize).toBeDefined();
    expect(mcpAuth.functions.token).toBeDefined();
    expect(mcpAuth.functions.register).toBeDefined();
  });

  test('multiple allowed redirect URIs are comma-separated', () => {
    new McpAuth(stack, 'McpAuth', {
      ...defaultProps,
      allowedRedirectUris: [
        'https://claude.ai/oauth/callback',
        'https://chatgpt.com/oauth/callback',
      ],
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          MCP_ALLOWED_REDIRECT_URIS: 'https://claude.ai/oauth/callback,https://chatgpt.com/oauth/callback',
        }),
      },
    });
  });
});
