import { APIGatewayProxyEventMultiValueQueryStringParameters, APIGatewayProxyEventPathParameters, APIGatewayProxyResult, APIGatewayProxyWithCognitoAuthorizerEvent, Context } from 'aws-lambda';
import { APIGatewayv1Handler } from '../lambda/handler';


export interface CognitoUser {
  email: string;
  username: string;
  groups: string[];
}

export interface LambdaRestTestOptionsBase {
  headers?: Record<string, string>;
  cognito?: CognitoUser;
}

export interface LambdaRestTestOptions extends LambdaRestTestOptionsBase {
  path?: string;
  method?: string;
  body?: string;
  pathParameters?: APIGatewayProxyEventPathParameters;
  queryStringParameters?: APIGatewayProxyEventMultiValueQueryStringParameters;
}

export function createContext(): Context {
  return {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'test',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test',
    memoryLimitInMB: '1024',
    awsRequestId: 'requestId',
    logGroupName: 'logGroupName',
    logStreamName: 'logStreamName',
    getRemainingTimeInMillis: () => 1000,
    done: jest.fn(),
    fail: jest.fn(),
    succeed: jest.fn(),
    identity: undefined,
    clientContext: undefined,
  };
}

export class LambdaRestUnitTest {

  constructor(
    private handler: APIGatewayv1Handler,
    private defaults?: LambdaRestTestOptionsBase,
  ) { }

  private createRestEvent(options: LambdaRestTestOptions = {}): APIGatewayProxyWithCognitoAuthorizerEvent {
    const {
      path = '/',
      method = 'GET',
      body = '',
    } = options;

    const headers = {
      ...this.defaults?.headers,
      ...options.headers,
    };
    const cognitoClaims = {
      username: 'DummyUser',
      email: 'dummy@example.com',
      groups: [],
      ...this.defaults?.cognito,
      ...options.cognito,
    };

    return {
      body,
      headers,
      multiValueHeaders: Object.fromEntries(Object.entries(headers).map(([key, value]) => [key, value ? [value] : []])),
      httpMethod: method,
      isBase64Encoded: false,
      path,
      pathParameters: options.pathParameters ?? null,
      queryStringParameters: options.queryStringParameters ? Object.fromEntries(Object.entries(options.queryStringParameters).map(([key, value]) => [key, value?.join(',')])) : null,
      multiValueQueryStringParameters: options.queryStringParameters ?? null,
      stageVariables: null,
      requestContext: {
        accountId: '123456789012',
        apiId: 'appId',
        authorizer: {
          claims: {
            'sub': cognitoClaims.username,
            'cognito:username': cognitoClaims.username,
            'cognito:groups': (cognitoClaims.groups) as unknown as string,
            'email': cognitoClaims.email,
          },
        },
        protocol: 'HTTP/1.1',
        httpMethod: method,
        identity: {
          accessKey: null,
          accountId: '123456789012',
          apiKey: null,
          apiKeyId: null,
          caller: null,
          clientCert: null,
          cognitoAuthenticationProvider: null,
          cognitoAuthenticationType: null,
          cognitoIdentityId: null,
          cognitoIdentityPoolId: null,
          principalOrgId: null,
          sourceIp: '',
          user: null,
          userAgent: null,
          userArn: null,
        },
        path,
        stage: 'prod',
        requestId: 'requestId',
        requestTimeEpoch: 0,
        resourceId: '',
        resourcePath: '',
      },
      resource: '',
    };
  }

  async call(options: LambdaRestTestOptions = {}): Promise<APIGatewayProxyResult> {
    const event = this.createRestEvent(options);
    const context = createContext();
    const result = await this.handler(event, context, () => { });
    if (!result) {
      throw new Error('No result returned from lambda');
    }
    return result;
  }
}


export interface LambdaGraphQLTestOptionsBase {
  cognito?: CognitoUser;
  stash?: Record<string, any>;
}

export interface LambdaGraphQLTestOptions extends LambdaGraphQLTestOptionsBase {
  fieldName?: string;
  arguments?: Record<string, any>;
  source?: any;
  parentTypeName?: string;
  prevResult?: Record<string, any>;
}

export class LambdaGraphQLTest {

  constructor(
    private handler: AWSLambda.AppSyncResolverHandler<any, any>,
    private defaults?: LambdaGraphQLTestOptionsBase,
  ) { }

  private createGraphQLEvent(options: LambdaGraphQLTestOptions): AWSLambda.AppSyncResolverEvent<Record<string, any>> {
    const {
      fieldName = 'testField',
      arguments: args = {},
      source = null,
      parentTypeName = 'Query',
      prevResult = {},
      stash = {},
    } = options;

    const cognitoClaims = {
      username: 'DummyUser',
      email: 'dummy@example.com',
      groups: [],
      ...this.defaults?.cognito,
      ...options.cognito,
    };

    return {
      arguments: args,
      source,
      info: {
        fieldName,
        parentTypeName,
        selectionSetGraphQL: '',
        selectionSetList: [],
        variables: {},
      },
      request: {
        domainName: null,
        headers: {},
      },
      identity: {
        claims: {
          'sub': cognitoClaims.username,
          'cognito:username': cognitoClaims.username,
          'cognito:groups': cognitoClaims.groups as unknown as string,
          'email': cognitoClaims.email,
        },
        groups: cognitoClaims.groups,
        sub: cognitoClaims.username,
        accountId: '123456789012',
        cognitoIdentityAuthProvider: null,
        cognitoIdentityAuthType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        resolverContext: null,
        userArn: null,
        defaultAuthStrategy: 'ALLOW',
        issuer: 'https://cognito-idp.region.amazonaws.com/userPoolId',
        sourceIp: ['127.0.0.1'],
        username: cognitoClaims.username,
      },
      prev: {
        result: prevResult,
      },
      stash: {
        ...this.defaults?.stash,
        ...stash,
      },
    } as AWSLambda.AppSyncResolverEvent<Record<string, any>>;
  }

  async call(options: LambdaGraphQLTestOptions): Promise<any> {
    const event = this.createGraphQLEvent(options);
    const context = createContext();
    const result = await this.handler(event, context, () => { });
    if (!result) {
      throw new Error('No result returned from lambda');
    }
    return result;
  }
}
