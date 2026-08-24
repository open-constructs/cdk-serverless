import { App, Stack } from 'aws-cdk-lib';

// Mock the LambdaFunction to avoid NodejsFunction bundling
jest.mock('../../src/constructs/func', () => {
  const awsLambda = jest.requireActual('aws-cdk-lib/aws-lambda');
  class MockLambdaFunction extends awsLambda.Function {
    constructor(scope: any, id: string, props: any) {
      super(scope, id, {
        runtime: awsLambda.Runtime.NODEJS_18_X,
        handler: 'index.handler',
        code: awsLambda.Code.fromInline('exports.handler = async () => {}'),
        description: props.description,
        environment: props.additionalEnv,
      });
    }
  }
  return { LambdaFunction: MockLambdaFunction };
});

// We need to test RestApi with mcpAuth but RestApi reads a YAML file,
// so we mock that too
jest.mock('node:fs', () => {
  const actual = jest.requireActual('node:fs');
  return {
    ...actual,
    readFileSync: (filePath: string, ...args: any[]) => {
      if (filePath === 'test-api.yaml' || filePath.endsWith('test-api.yaml')) {
        return `
openapi: '3.0.1'
info:
  title: TestApi
  version: '1.0'
paths:
  /items:
    get:
      operationId: getItems
      responses:
        '200':
          description: OK
`;
      }
      return actual.readFileSync(filePath, ...args);
    },
    existsSync: (filePath: string) => {
      if (filePath.includes('lambda/rest.')) return true;
      return actual.existsSync(filePath);
    },
    writeFileSync: jest.fn(),
  };
});

import { RestApi } from '../../src/constructs/rest-api';

describe('RestApi with mcpAuth', () => {
  describe('generic mode', () => {
    let stack: Stack;
    let apiSpec: any;

    beforeAll(() => {
      const app = new App();
      stack = new Stack(app, 'TestStack', { env: { account: '123456789012', region: 'us-east-1' } });

      const api = new RestApi(stack, 'Api', {
        apiName: 'TestApi',
        stageName: 'dev',
        definitionFileName: 'test-api.yaml',
        cors: false,
        domainName: 'example.com',
        apiHostname: 'api',
        mcpAuth: {
          generic: {
            authorizeEndpoint: 'https://auth.example.com/oauth2/authorize',
            tokenEndpoint: 'https://auth.example.com/oauth2/token',
            clientId: 'test-client-id',
          },
          serverInfo: { name: 'test-server', version: '1.0.0' },
        },
      });

      apiSpec = api.apiSpec;
    });

    it('injects /.well-known/oauth-protected-resource GET path', () => {
      const pathItem = apiSpec.paths['/.well-known/oauth-protected-resource'];
      expect(pathItem).toBeDefined();
      expect(pathItem.get).toBeDefined();
      expect(pathItem.get.operationId).toBe('mcpOAuthProtectedResource');
      expect(pathItem.get.security).toEqual([]);
    });

    it('injects /.well-known/oauth-authorization-server GET path', () => {
      const pathItem = apiSpec.paths['/.well-known/oauth-authorization-server'];
      expect(pathItem).toBeDefined();
      expect(pathItem.get).toBeDefined();
      expect(pathItem.get.operationId).toBe('mcpOAuthAuthorizationServer');
      expect(pathItem.get.security).toEqual([]);
    });

    it('injects /oauth/authorize GET path', () => {
      const pathItem = apiSpec.paths['/oauth/authorize'];
      expect(pathItem).toBeDefined();
      expect(pathItem.get).toBeDefined();
      expect(pathItem.get.operationId).toBe('mcpOAuthAuthorize');
      expect(pathItem.get.security).toEqual([]);
    });

    it('injects /oauth/token POST path', () => {
      const pathItem = apiSpec.paths['/oauth/token'];
      expect(pathItem).toBeDefined();
      expect(pathItem.post).toBeDefined();
      expect(pathItem.post.operationId).toBe('mcpOAuthToken');
      expect(pathItem.post.security).toEqual([]);
    });

    it('injects /oauth/register POST path', () => {
      const pathItem = apiSpec.paths['/oauth/register'];
      expect(pathItem).toBeDefined();
      expect(pathItem.post).toBeDefined();
      expect(pathItem.post.operationId).toBe('mcpOAuthRegister');
      expect(pathItem.post.security).toEqual([]);
    });

    it('all MCP paths have x-amazon-apigateway-integration', () => {
      const mcpPaths = [
        '/.well-known/oauth-protected-resource',
        '/.well-known/oauth-authorization-server',
        '/oauth/authorize',
        '/oauth/token',
        '/oauth/register',
      ];

      for (const p of mcpPaths) {
        const pathItem = apiSpec.paths[p];
        const method = p.startsWith('/oauth/token') || p.startsWith('/oauth/register') ? 'post' : 'get';
        const operation = pathItem[method];
        expect(operation['x-amazon-apigateway-integration']).toBeDefined();
        expect(operation['x-amazon-apigateway-integration'].type).toBe('aws_proxy');
        expect(operation['x-amazon-apigateway-integration'].httpMethod).toBe('POST');
      }
    });
  });
});
