import * as fs from 'node:fs';
import * as path from 'node:path';
import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as aws_cognito from 'aws-cdk-lib/aws-cognito';
import * as yaml from 'js-yaml';
import { RestApi } from '../../src/constructs';
import { ICognitoAuthentication, IJwtAuthentication } from '../../src/constructs/authentication';

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
      });
    }
  }

  return {
    LambdaFunction: MockLambdaFunction,
  };
});

describe('RestApi', () => {
  let app: App;
  let stack: Stack;
  const specFilePath = path.join(__dirname, 'test-rest-api-spec.yaml');

  // Minimal OpenAPI spec with one operation
  const minimalSpec = {
    openapi: '3.0.1',
    info: {
      title: 'Test API',
      version: '1.0.0',
    },
    paths: {
      '/items': {
        get: {
          operationId: 'getItems',
          summary: 'Get all items',
          responses: {
            200: {
              description: 'Success',
            },
          },
        },
      },
    },
  };

  // OpenAPI spec with global security set
  const specWithGlobalSecurity = {
    openapi: '3.0.1',
    info: {
      title: 'Test API',
      version: '1.0.0',
    },
    security: [{ CognitoAuthorizer: [] }],
    paths: {
      '/items': {
        get: {
          operationId: 'getItems',
          summary: 'Get all items',
          responses: {
            200: {
              description: 'Success',
            },
          },
        },
      },
      '/items/{id}': {
        get: {
          operationId: 'getItem',
          summary: 'Get one item',
          responses: {
            200: {
              description: 'Success',
            },
          },
        },
      },
    },
  };

  // Create dummy Lambda entry files for the operations
  const lambdaDir = path.join(__dirname, '../../src/lambda');
  const lambdaFiles = [
    'rest.testapi.getItems.ts',
    'rest.testapi.getItem.ts',
  ];

  beforeAll(() => {
    fs.mkdirSync(lambdaDir, { recursive: true });
    const dummyLambdaContent = 'export const handler = async () => {};';
    for (const file of lambdaFiles) {
      const filePath = path.join(lambdaDir, file);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, dummyLambdaContent);
      }
    }
  });

  afterAll(() => {
    // Clean up temp files
    if (fs.existsSync(specFilePath)) {
      fs.unlinkSync(specFilePath);
    }
    for (const file of lambdaFiles) {
      const filePath = path.join(lambdaDir, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  });

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack');
  });

  function writeSpecFile(spec: object) {
    fs.writeFileSync(specFilePath, yaml.dump(spec));
  }

  describe('Cognito authentication', () => {
    test('adds CognitoAuthorizer to components.securitySchemes of the OpenAPI 3 spec', () => {
      writeSpecFile(minimalSpec);

      const userpool = new aws_cognito.UserPool(stack, 'UserPool', {
        userPoolName: 'TestPool',
      });

      const authentication: ICognitoAuthentication = {
        userpool,
      };

      new RestApi(stack, 'TestApi', {
        apiName: 'TestApi',
        stageName: 'test',
        definitionFileName: specFilePath,
        cors: false,
        authentication,
        autoGenerateRoutes: true,
      });

      const template = Template.fromStack(stack);

      // Get the SpecRestApi resource
      const apiResources = template.findResources('AWS::ApiGateway::RestApi');
      const apiResource = Object.values(apiResources)[0];
      const body = apiResource.Properties.Body;

      // A 3.x document must carry authorizers under components.securitySchemes,
      // never the Swagger-2.0 root securityDefinitions (API Gateway ignores the
      // latter for 3.x specs, silently deploying an unauthenticated API).
      expect(body.securityDefinitions).toBeUndefined();
      expect(body.components.securitySchemes).toBeDefined();
      expect(body.components.securitySchemes.CognitoAuthorizer).toBeDefined();

      const cognitoAuthorizer = body.components.securitySchemes.CognitoAuthorizer;
      expect(cognitoAuthorizer['x-amazon-apigateway-authtype']).toBe('cognito_user_pools');
      expect(cognitoAuthorizer['x-amazon-apigateway-authorizer']).toBeDefined();
      expect(cognitoAuthorizer['x-amazon-apigateway-authorizer'].type).toBe('cognito_user_pools');

      // Verify providerARNs contains the user pool ARN (will be a CloudFormation intrinsic)
      const providerARNs = cognitoAuthorizer['x-amazon-apigateway-authorizer'].providerARNs;
      expect(providerARNs).toBeDefined();
      expect(providerARNs.length).toBe(1);
      // The ARN is a Fn::GetAtt intrinsic since it's a CDK-managed resource
      expect(providerARNs[0]).toEqual(expect.objectContaining({ 'Fn::GetAtt': expect.any(Array) }));
    });
  });

  describe('Swagger 2.0 spec', () => {
    test('keeps the authorizer under the root securityDefinitions for a 2.0 document', () => {
      writeSpecFile({
        swagger: '2.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/items': {
            get: {
              operationId: 'getItems',
              responses: { 200: { description: 'Success' } },
            },
          },
        },
      });

      const userpool = new aws_cognito.UserPool(stack, 'UserPool', {
        userPoolName: 'TestPool',
      });
      const authentication: ICognitoAuthentication = { userpool };

      new RestApi(stack, 'TestApi', {
        apiName: 'TestApi',
        stageName: 'test',
        definitionFileName: specFilePath,
        cors: false,
        authentication,
        autoGenerateRoutes: true,
      });

      const template = Template.fromStack(stack);
      const apiResource = Object.values(template.findResources('AWS::ApiGateway::RestApi'))[0];
      const body = apiResource.Properties.Body;

      // Swagger 2.0 has no `components` — the authorizer belongs at the root.
      expect(body.securityDefinitions).toBeDefined();
      expect(body.securityDefinitions.CognitoAuthorizer).toBeDefined();
      expect(body.securityDefinitions.CognitoAuthorizer['x-amazon-apigateway-authtype']).toBe('cognito_user_pools');
      expect(body.components?.securitySchemes).toBeUndefined();
    });
  });

  describe('JWT authentication', () => {
    test('adds JwtAuthorizer to components.securitySchemes and creates Lambda authorizer function', () => {
      writeSpecFile(minimalSpec);

      const authentication: IJwtAuthentication = {
        issuerUrl: 'https://example.com',
        jwksUrl: 'https://example.com/.well-known/jwks.json',
      };

      new RestApi(stack, 'TestApi', {
        apiName: 'TestApi',
        stageName: 'test',
        definitionFileName: specFilePath,
        cors: false,
        authentication,
        autoGenerateRoutes: true,
      });

      const template = Template.fromStack(stack);

      // Get the SpecRestApi resource
      const apiResources = template.findResources('AWS::ApiGateway::RestApi');
      const apiResource = Object.values(apiResources)[0];
      const body = apiResource.Properties.Body;

      // JWT authorizer must also land in the 3.x location, not securityDefinitions.
      expect(body.securityDefinitions).toBeUndefined();
      expect(body.components.securitySchemes).toBeDefined();
      expect(body.components.securitySchemes.JwtAuthorizer).toBeDefined();

      const jwtAuthorizer = body.components.securitySchemes.JwtAuthorizer;
      expect(jwtAuthorizer['x-amazon-apigateway-authtype']).toBe('custom');
      expect(jwtAuthorizer['x-amazon-apigateway-authorizer']).toBeDefined();
      expect(jwtAuthorizer['x-amazon-apigateway-authorizer'].type).toBe('token');
      expect(jwtAuthorizer['x-amazon-apigateway-authorizer'].authorizerResultTtlInSeconds).toBe(300);
      expect(jwtAuthorizer['x-amazon-apigateway-authorizer'].identitySource).toBe('method.request.header.Authorization');

      // Verify the authorizerUri is present (will be a Fn::Join or Fn::Sub intrinsic)
      expect(jwtAuthorizer['x-amazon-apigateway-authorizer'].authorizerUri).toBeDefined();

      // Verify an additional Lambda function is created for the JWT authorizer
      // There should be at least 2 Lambda functions: one for the operation and one for the authorizer
      const lambdaFunctions = template.findResources('AWS::Lambda::Function');
      const lambdaCount = Object.keys(lambdaFunctions).length;
      expect(lambdaCount).toBeGreaterThanOrEqual(2);

      // Verify one of the Lambda functions has the JWT authorizer description
      const descriptions = Object.values(lambdaFunctions).map(
        (fn: any) => fn.Properties.Description,
      );
      expect(descriptions).toContainEqual(expect.stringContaining('JWT Authorizer'));
    });
  });

  describe('No authentication', () => {
    test('does not add securityDefinitions when no authentication is provided', () => {
      writeSpecFile(minimalSpec);

      new RestApi(stack, 'TestApi', {
        apiName: 'TestApi',
        stageName: 'test',
        definitionFileName: specFilePath,
        cors: false,
        autoGenerateRoutes: true,
      });

      const template = Template.fromStack(stack);

      // Get the SpecRestApi resource
      const apiResources = template.findResources('AWS::ApiGateway::RestApi');
      const apiResource = Object.values(apiResources)[0];
      const body = apiResource.Properties.Body;

      // Verify no securityDefinitions are present
      expect(body.securityDefinitions).toBeUndefined();
    });
  });

  describe('Security applied per-operation', () => {
    test('moves global security to per-operation and removes global security field', () => {
      writeSpecFile(specWithGlobalSecurity);

      const userpool = new aws_cognito.UserPool(stack, 'UserPool', {
        userPoolName: 'TestPool',
      });

      const authentication: ICognitoAuthentication = {
        userpool,
      };

      new RestApi(stack, 'TestApi', {
        apiName: 'TestApi',
        stageName: 'test',
        definitionFileName: specFilePath,
        cors: false,
        authentication,
        autoGenerateRoutes: true,
      });

      const template = Template.fromStack(stack);

      // Get the SpecRestApi resource
      const apiResources = template.findResources('AWS::ApiGateway::RestApi');
      const apiResource = Object.values(apiResources)[0];
      const body = apiResource.Properties.Body;

      // Global security should be removed
      expect(body.security).toBeUndefined();

      // Each operation should have security applied
      // Check /items get
      expect(body.paths['/items'].get.security).toBeDefined();
      expect(body.paths['/items'].get.security).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ CognitoAuthorizer: ['openid'] }),
        ]),
      );

      // Check /items/{id} get
      expect(body.paths['/items/{id}'].get.security).toBeDefined();
      expect(body.paths['/items/{id}'].get.security).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ CognitoAuthorizer: ['openid'] }),
        ]),
      );
    });
  });

  describe('Anonymous operations', () => {
    test('anonymousOperations prop results in security: [] on specified operations', () => {
      writeSpecFile(specWithGlobalSecurity);

      const userpool = new aws_cognito.UserPool(stack, 'UserPool', {
        userPoolName: 'TestPool',
      });

      const authentication: ICognitoAuthentication = {
        userpool,
      };

      new RestApi<any, { getItems: any; getItem: any }>(stack, 'TestApi', {
        apiName: 'TestApi',
        stageName: 'test',
        definitionFileName: specFilePath,
        cors: false,
        authentication,
        autoGenerateRoutes: true,
        anonymousOperations: ['getItems'],
      });

      const template = Template.fromStack(stack);

      const apiResources = template.findResources('AWS::ApiGateway::RestApi');
      const apiResource = Object.values(apiResources)[0];
      const body = apiResource.Properties.Body;

      // getItems should have empty security (anonymous)
      expect(body.paths['/items'].get.security).toEqual([]);

      // getItem should still have the authorizer security
      expect(body.paths['/items/{id}'].get.security).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ CognitoAuthorizer: ['openid'] }),
        ]),
      );
    });

    test('setAnonymousOperations replaces the anonymous set and restores security on removed operations', () => {
      writeSpecFile(specWithGlobalSecurity);

      const userpool = new aws_cognito.UserPool(stack, 'UserPool', {
        userPoolName: 'TestPool',
      });

      const authentication: ICognitoAuthentication = {
        userpool,
      };

      const api = new RestApi<any, { getItems: any; getItem: any }>(stack, 'TestApi', {
        apiName: 'TestApi',
        stageName: 'test',
        definitionFileName: specFilePath,
        cors: false,
        authentication,
        autoGenerateRoutes: true,
        anonymousOperations: ['getItems'],
      });

      // Now replace the anonymous set with only getItem
      api.setAnonymousOperations(['getItem']);

      const template = Template.fromStack(stack);

      const apiResources = template.findResources('AWS::ApiGateway::RestApi');
      const apiResource = Object.values(apiResources)[0];
      const body = apiResource.Properties.Body;

      // getItem should now be anonymous
      expect(body.paths['/items/{id}'].get.security).toEqual([]);

      // getItems should have its security RESTORED (no longer anonymous)
      expect(body.paths['/items'].get.security).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ CognitoAuthorizer: ['openid'] }),
        ]),
      );
    });

    test('addAnonymousOperations appends to the anonymous set', () => {
      writeSpecFile(specWithGlobalSecurity);

      const userpool = new aws_cognito.UserPool(stack, 'UserPool', {
        userPoolName: 'TestPool',
      });

      const authentication: ICognitoAuthentication = {
        userpool,
      };

      const api = new RestApi<any, { getItems: any; getItem: any }>(stack, 'TestApi', {
        apiName: 'TestApi',
        stageName: 'test',
        definitionFileName: specFilePath,
        cors: false,
        authentication,
        autoGenerateRoutes: true,
        anonymousOperations: ['getItems'],
      });

      // Add getItem to anonymous set
      api.addAnonymousOperations(['getItem']);

      const template = Template.fromStack(stack);

      const apiResources = template.findResources('AWS::ApiGateway::RestApi');
      const apiResource = Object.values(apiResources)[0];
      const body = apiResource.Properties.Body;

      // Both should be anonymous
      expect(body.paths['/items'].get.security).toEqual([]);
      expect(body.paths['/items/{id}'].get.security).toEqual([]);
    });
  });

  describe('JWT authorizer type', () => {
    test('jwtAuthorizerType request produces a request-type authorizer without identitySource', () => {
      writeSpecFile(minimalSpec);

      const authentication: IJwtAuthentication = {
        issuerUrl: 'https://example.com',
        jwksUrl: 'https://example.com/.well-known/jwks.json',
      };

      new RestApi(stack, 'TestApi', {
        apiName: 'TestApi',
        stageName: 'test',
        definitionFileName: specFilePath,
        cors: false,
        authentication,
        autoGenerateRoutes: true,
        jwtAuthorizerType: 'request',
      });

      const template = Template.fromStack(stack);

      const apiResources = template.findResources('AWS::ApiGateway::RestApi');
      const apiResource = Object.values(apiResources)[0];
      const body = apiResource.Properties.Body;

      expect(body.components.securitySchemes.JwtAuthorizer).toBeDefined();
      const authorizer = body.components.securitySchemes.JwtAuthorizer['x-amazon-apigateway-authorizer'];
      expect(authorizer.type).toBe('request');
      expect(authorizer.identitySource).toBeUndefined();
      expect(authorizer.authorizerResultTtlInSeconds).toBe(0);
      expect(authorizer.authorizerUri).toBeDefined();
    });

    test('jwtAuthorizerType token (default) produces a token-type authorizer with identitySource', () => {
      writeSpecFile(minimalSpec);

      const authentication: IJwtAuthentication = {
        issuerUrl: 'https://example.com',
        jwksUrl: 'https://example.com/.well-known/jwks.json',
      };

      new RestApi(stack, 'TestApi', {
        apiName: 'TestApi',
        stageName: 'test',
        definitionFileName: specFilePath,
        cors: false,
        authentication,
        autoGenerateRoutes: true,
      });

      const template = Template.fromStack(stack);

      const apiResources = template.findResources('AWS::ApiGateway::RestApi');
      const apiResource = Object.values(apiResources)[0];
      const body = apiResource.Properties.Body;

      expect(body.components.securitySchemes.JwtAuthorizer).toBeDefined();
      const authorizer = body.components.securitySchemes.JwtAuthorizer['x-amazon-apigateway-authorizer'];
      expect(authorizer.type).toBe('token');
      expect(authorizer.identitySource).toBe('method.request.header.Authorization');
    });
  });

  describe('authorizationScopes', () => {
    test('defaults to [openid] when authorizationScopes is not specified', () => {
      writeSpecFile(minimalSpec);

      const userpool = new aws_cognito.UserPool(stack, 'UserPool', {
        userPoolName: 'TestPool',
      });

      const authentication: ICognitoAuthentication = { userpool };

      new RestApi(stack, 'TestApi', {
        apiName: 'TestApi',
        stageName: 'test',
        definitionFileName: specFilePath,
        cors: false,
        authentication,
        autoGenerateRoutes: true,
      });

      const template = Template.fromStack(stack);

      const apiResources = template.findResources('AWS::ApiGateway::RestApi');
      const apiResource = Object.values(apiResources)[0];
      const body = apiResource.Properties.Body;

      // Default scopes should be ['openid']
      expect(body.paths['/items'].get.security).toEqual([
        { CognitoAuthorizer: ['openid'] },
      ]);
    });

    test('explicit global scopes array is applied to all secured operations', () => {
      writeSpecFile(minimalSpec);

      const userpool = new aws_cognito.UserPool(stack, 'UserPool', {
        userPoolName: 'TestPool',
      });

      const authentication: ICognitoAuthentication = { userpool };

      new RestApi(stack, 'TestApi', {
        apiName: 'TestApi',
        stageName: 'test',
        definitionFileName: specFilePath,
        cors: false,
        authentication,
        autoGenerateRoutes: true,
        authorizationScopes: ['openid', 'email'],
      });

      const template = Template.fromStack(stack);

      const apiResources = template.findResources('AWS::ApiGateway::RestApi');
      const apiResource = Object.values(apiResources)[0];
      const body = apiResource.Properties.Body;

      // Global security should be removed (distributed per-operation)
      expect(body.security).toBeUndefined();

      // The operation should have scopes applied
      expect(body.paths['/items'].get.security).toEqual([
        { CognitoAuthorizer: ['openid', 'email'] },
      ]);
    });

    test('multiple global scopes are applied correctly', () => {
      writeSpecFile(specWithGlobalSecurity);

      const userpool = new aws_cognito.UserPool(stack, 'UserPool', {
        userPoolName: 'TestPool',
      });

      const authentication: ICognitoAuthentication = { userpool };

      new RestApi<any, { getItems: any; getItem: any }>(stack, 'TestApi', {
        apiName: 'TestApi',
        stageName: 'test',
        definitionFileName: specFilePath,
        cors: false,
        authentication,
        autoGenerateRoutes: true,
        authorizationScopes: ['openid', 'profile'],
      });

      const template = Template.fromStack(stack);

      const apiResources = template.findResources('AWS::ApiGateway::RestApi');
      const apiResource = Object.values(apiResources)[0];
      const body = apiResource.Properties.Body;

      // Both operations should have the global scopes
      expect(body.paths['/items'].get.security).toEqual([
        { CognitoAuthorizer: ['openid', 'profile'] },
      ]);
      expect(body.paths['/items/{id}'].get.security).toEqual([
        { CognitoAuthorizer: ['openid', 'profile'] },
      ]);
    });

    test('per-operation scopes override the global default', () => {
      writeSpecFile(specWithGlobalSecurity);

      const userpool = new aws_cognito.UserPool(stack, 'UserPool', {
        userPoolName: 'TestPool',
      });

      const authentication: ICognitoAuthentication = { userpool };

      new RestApi<any, { getItems: any; getItem: any }>(stack, 'TestApi', {
        apiName: 'TestApi',
        stageName: 'test',
        definitionFileName: specFilePath,
        cors: false,
        authentication,
        autoGenerateRoutes: true,
        authorizationScopes: ['openid'],
        authorizationScopesByOperation: {
          getItem: ['openid', 'items:read'],
        },
      });

      const template = Template.fromStack(stack);

      const apiResources = template.findResources('AWS::ApiGateway::RestApi');
      const apiResource = Object.values(apiResources)[0];
      const body = apiResource.Properties.Body;

      // getItems uses the global default
      expect(body.paths['/items'].get.security).toEqual([
        { CognitoAuthorizer: ['openid'] },
      ]);
      // getItem uses the per-operation override
      expect(body.paths['/items/{id}'].get.security).toEqual([
        { CognitoAuthorizer: ['openid', 'items:read'] },
      ]);
    });

    test('operations without a per-operation override keep the global scopes', () => {
      writeSpecFile(specWithGlobalSecurity);

      const userpool = new aws_cognito.UserPool(stack, 'UserPool', {
        userPoolName: 'TestPool',
      });

      const authentication: ICognitoAuthentication = { userpool };

      new RestApi<any, { getItems: any; getItem: any }>(stack, 'TestApi', {
        apiName: 'TestApi',
        stageName: 'test',
        definitionFileName: specFilePath,
        cors: false,
        authentication,
        autoGenerateRoutes: true,
        authorizationScopes: ['openid', 'profile'],
        authorizationScopesByOperation: {
          getItems: ['openid', 'items:read'],
        },
      });

      const template = Template.fromStack(stack);

      const apiResources = template.findResources('AWS::ApiGateway::RestApi');
      const apiResource = Object.values(apiResources)[0];
      const body = apiResource.Properties.Body;

      // getItems has per-operation scopes
      expect(body.paths['/items'].get.security).toEqual([
        { CognitoAuthorizer: ['openid', 'items:read'] },
      ]);

      // getItem has no override — keeps the global default
      expect(body.paths['/items/{id}'].get.security).toEqual([
        { CognitoAuthorizer: ['openid', 'profile'] },
      ]);
    });

    test('empty authorizationScopes array preserves backward-compatible behavior (ID-token-only)', () => {
      writeSpecFile(minimalSpec);

      const userpool = new aws_cognito.UserPool(stack, 'UserPool', {
        userPoolName: 'TestPool',
      });

      const authentication: ICognitoAuthentication = { userpool };

      new RestApi(stack, 'TestApi', {
        apiName: 'TestApi',
        stageName: 'test',
        definitionFileName: specFilePath,
        cors: false,
        authentication,
        autoGenerateRoutes: true,
        authorizationScopes: [],
      });

      const template = Template.fromStack(stack);

      const apiResources = template.findResources('AWS::ApiGateway::RestApi');
      const apiResource = Object.values(apiResources)[0];
      const body = apiResource.Properties.Body;

      // Empty scopes = ID-token-only (backward compatible)
      expect(body.paths['/items'].get.security).toEqual([
        { CognitoAuthorizer: [] },
      ]);
    });

    test('authorizationScopes combined with anonymousOperations', () => {
      writeSpecFile(specWithGlobalSecurity);

      const userpool = new aws_cognito.UserPool(stack, 'UserPool', {
        userPoolName: 'TestPool',
      });

      const authentication: ICognitoAuthentication = { userpool };

      new RestApi<any, { getItems: any; getItem: any }>(stack, 'TestApi', {
        apiName: 'TestApi',
        stageName: 'test',
        definitionFileName: specFilePath,
        cors: false,
        authentication,
        autoGenerateRoutes: true,
        authorizationScopes: ['openid'],
        anonymousOperations: ['getItems'],
      });

      const template = Template.fromStack(stack);

      const apiResources = template.findResources('AWS::ApiGateway::RestApi');
      const apiResource = Object.values(apiResources)[0];
      const body = apiResource.Properties.Body;

      // Anonymous operation has no security
      expect(body.paths['/items'].get.security).toEqual([]);

      // Secured operation has the configured scopes
      expect(body.paths['/items/{id}'].get.security).toEqual([
        { CognitoAuthorizer: ['openid'] },
      ]);
    });
  });
});
