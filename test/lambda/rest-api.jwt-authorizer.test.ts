// Set env vars before module load so the top-level constants are captured
process.env.JWT_ISSUER_URL = 'https://example.com';
process.env.JWT_JWKS_URL = 'https://example.com/.well-known/jwks.json';
process.env.JWT_AUDIENCE_URL = '';

// Mock global fetch before importing the handler
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

// Mock jwk-to-pem
jest.mock('jwk-to-pem', () => ({
  __esModule: true,
  default: () => 'test-pem',
}));

// Mock jsonwebtoken - the verify function receives a signing key callback
// that internally calls getPublicKeys (which uses fetch). We mock verify to
// invoke that key-fetching callback, then decide Allow/Deny based on token value.
jest.mock('jsonwebtoken', () => ({
  verify: (token: string, getKey: Function, _options: any, callback: Function) => {
    // Call the source's key retrieval function which will fetch JWKS
    getKey({ kid: 'test-kid' }, (err: any, _pem: any) => {
      if (err) {
        callback(err);
        return;
      }
      if (token === 'valid-token') {
        callback(null, {
          sub: 'user-123',
          email: 'test@example.com',
          iss: 'https://example.com',
        });
      } else {
        callback(new Error('invalid token'));
      }
    });
  },
}));

import { handler } from '../../src/lambda/rest-api.jwt-authorizer';

describe('JWT Authorizer Handler', () => {
  const methodArn = 'arn:aws:execute-api:us-east-1:123456789012:api-id/stage/GET/resource';

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock fetch to return JWKS
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        keys: [{
          alg: 'RS256',
          e: 'AQAB',
          kid: 'test-kid',
          kty: 'RSA',
          n: 'test-n',
          use: 'sig',
        }],
      }),
    });
  });

  describe('TOKEN event type', () => {
    test('valid Bearer token returns Allow with claims context', async () => {
      const event: AWSLambda.APIGatewayTokenAuthorizerEvent = {
        type: 'TOKEN',
        authorizationToken: 'Bearer valid-token',
        methodArn,
      };

      const result = await handler(event);

      expect(result.principalId).toBe('user-123');
      expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
      expect(result.context).toBeDefined();
      expect(result.context!.email).toBe('test@example.com');
    });

    test('missing Bearer token throws Unauthorized', async () => {
      const event: AWSLambda.APIGatewayTokenAuthorizerEvent = {
        type: 'TOKEN',
        authorizationToken: '',
        methodArn,
      };

      await expect(handler(event)).rejects.toThrow('Unauthorized');
    });

    test('invalid token throws Unauthorized', async () => {
      const event: AWSLambda.APIGatewayTokenAuthorizerEvent = {
        type: 'TOKEN',
        authorizationToken: 'Bearer invalid-token',
        methodArn,
      };

      await expect(handler(event)).rejects.toThrow('Unauthorized');
    });
  });

  describe('REQUEST event type', () => {
    test('Authorization header with valid Bearer token returns Allow with claims context', async () => {
      const event: AWSLambda.APIGatewayRequestAuthorizerEvent = {
        type: 'REQUEST',
        methodArn,
        headers: {
          Authorization: 'Bearer valid-token',
        },
        multiValueHeaders: null,
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '/resource',
        path: '/resource',
        httpMethod: 'GET',
      };

      const result = await handler(event);

      expect(result.principalId).toBe('user-123');
      expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
      expect(result.context).toBeDefined();
      expect(result.context!.email).toBe('test@example.com');
    });

    test('no Authorization header returns Allow with anonymous principal and empty context', async () => {
      const event: AWSLambda.APIGatewayRequestAuthorizerEvent = {
        type: 'REQUEST',
        methodArn,
        headers: {},
        multiValueHeaders: null,
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '/resource',
        path: '/resource',
        httpMethod: 'GET',
      };

      const result = await handler(event);

      expect(result.principalId).toBe('anonymous');
      expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
      expect(result.context).toEqual({});
    });

    test('null headers returns Allow with anonymous principal', async () => {
      const event: AWSLambda.APIGatewayRequestAuthorizerEvent = {
        type: 'REQUEST',
        methodArn,
        headers: null,
        multiValueHeaders: null,
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '/resource',
        path: '/resource',
        httpMethod: 'GET',
      };

      const result = await handler(event);

      expect(result.principalId).toBe('anonymous');
      expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
      expect(result.context).toEqual({});
    });

    test('invalid token throws Unauthorized', async () => {
      const event: AWSLambda.APIGatewayRequestAuthorizerEvent = {
        type: 'REQUEST',
        methodArn,
        headers: {
          Authorization: 'Bearer invalid-token',
        },
        multiValueHeaders: null,
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '/resource',
        path: '/resource',
        httpMethod: 'GET',
      };

      await expect(handler(event)).rejects.toThrow('Unauthorized');
    });
  });
});
