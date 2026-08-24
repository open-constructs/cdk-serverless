# CDK Serverless - LLM Context Guide

This document serves as a comprehensive guide for AI assistants working with the CDK Serverless library. It provides an overview of the library's purpose, architecture, key components, and usage patterns to help generate accurate and contextually appropriate code.

## Library Overview

CDK Serverless is a toolkit for building serverless applications on AWS using the AWS Cloud Development Kit (CDK). It provides higher-level (L3) constructs, utility libraries, and project management features designed to simplify serverless development.

### Core Concepts

1. **Higher-level CDK Constructs**: Pre-configured L3 constructs for common serverless patterns like REST APIs, GraphQL APIs, DynamoDB tables, and authentication.

2. **Lambda Function Utilities**: Helper functions and classes for creating Lambda handlers with standardized error handling, authentication, and typing.

3. **Projen Integration**: Project setup tools for quickly scaffolding serverless applications with best practices.

4. **Testing Utilities**: Tools for unit testing Lambda functions and integration testing deployed applications.

## Key Components

### CDK Constructs (`src/constructs/`)

#### `AssetCdn`

Creates an S3 bucket for asset storage with CloudFront distribution for secure HTTPS asset serving.

```typescript
const cdn = new AssetCdn(this, 'MyCdn', {
  domainName: 'example.com',
  hostName: 'cdn',
  cors: true,
});
```

#### `CognitoAuthentication`

Sets up Cognito User Pools and optional Identity Pools for authentication.

```typescript
const auth = new CognitoAuthentication(this, 'Auth', {
  userPoolName: 'my-users',
  selfSignUp: true,
  emailVerification: true,
  userGroups: ['admin', 'user'],
  identityPool: true,
});
```

#### `GraphQlApi`

Creates an AWS AppSync GraphQL API with resolvers and authentication.

```typescript
const api = new GraphQlApi(this, 'Api', {
  apiName: 'MyGraphQLApi',
  stageName: 'dev',
  definitionFileName: 'schema.graphql',
  authentication: auth,
  datastore: table,
  domainName: 'example.com',
  apiHostname: 'api',
});

// Add resolvers
api.addLambdaResolver('Query', 'getItems', handler);
api.addVtlResolver('Mutation', 'createItem', {
  operation: 'PutItem',
  key: util.dynamodb.toMapValues({ PK: 'ITEM#${context.arguments.id}' }),
  attributeValues: util.dynamodb.toMapValues({ ...context.arguments }),
});
```

#### `RestApi`

Creates an AWS API Gateway REST API using OpenAPI/Swagger specification.

```typescript
const api = new RestApi(this, 'Api', {
  apiName: 'MyRestApi',
  stageName: 'dev',
  definitionFileName: 'openapi.yaml',
  authentication: auth,
  datastore: table,
  domainName: 'example.com',
  apiHostname: 'api',
  cors: true,
});
```

#### `SingleTableDatastore`

Sets up a DynamoDB table following the single-table design pattern.

```typescript
const table = new SingleTableDatastore(this, 'Table', {
  tableName: 'MyTable',
  design: {
    primaryKey: {
      partitionKey: 'PK',
      sortKey: 'SK',
    },
    indexes: {
      GSI1: {
        partitionKey: 'GSI1PK',
        sortKey: 'GSI1SK',
      },
    },
  },
  ttlAttribute: 'expires',
});
```

#### `LambdaFunction`

Extended NodejsFunction with additional configurations and permissions.

```typescript
const lambda = new LambdaFunction(this, 'MyFunction', {
  entry: 'path/to/handler.ts',
  timeout: Duration.seconds(30),
  environment: {
    TABLE_NAME: table.tableName,
  },
});

// Grant permissions
lambda.grantDatastoreReadWrite(table);
lambda.grantUserpool(auth.userPool);
```

#### `Workflow`

Creates AWS Step Functions state machine.

```typescript
const workflow = new Workflow(this, 'MyWorkflow', {
  definitionFileName: 'workflow/definition.asl.json',
});
```

### Lambda Utilities (`src/lambda/`)

#### HTTP Handler

```typescript
import { createHttpHandler } from 'cdk-serverless/lambda';

export const handler = createHttpHandler(async (ctx) => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Hello World' }),
  };
});
```

#### OpenAPI Handler

```typescript
import { createOpenApiHandler } from 'cdk-serverless/lambda';

export const handler = createOpenApiHandler<paths['/items']['get']>(async (ctx) => {
  // Type-safe access to parameters
  const limit = ctx.queryParams.limit;
  
  return {
    items: [/* items */],
  };
});
```

#### AppSync (GraphQL) Handler

```typescript
import { createAppSyncHandler } from 'cdk-serverless/lambda';

export const handler = createAppSyncHandler<GetItemsQuery, GetItemsResult>(async (ctx) => {
  const { limit } = ctx.arguments;
  
  return {
    items: [/* items */],
  };
});
```

#### Error Handling

```typescript
import { BadRequestError, NotFoundError } from 'cdk-serverless/lambda';

export const handler = createHttpHandler(async (ctx) => {
  if (!ctx.queryParams.id) {
    throw new BadRequestError('Missing ID parameter');
  }
  
  const item = await getItem(ctx.queryParams.id);
  
  if (!item) {
    throw new NotFoundError('Item not found');
  }
  
  return item;
});
```

### Projen Integration (`src/projen/`)

#### ServerlessProject

```typescript
import { ServerlessProject } from 'cdk-serverless/projen';

const project = new ServerlessProject({
  name: 'my-serverless-app',
  defaultReleaseBranch: 'main',
});
```

#### RestApi Project

```typescript
import { RestApi } from 'cdk-serverless/projen';

const project = new ServerlessProject({
  name: 'my-api',
  defaultReleaseBranch: 'main',
});

new RestApi(project, {
  apiName: 'MyApi',
  definitionFile: 'api.yaml',
});
```

#### GraphQL API Project

```typescript
import { GraphQlApi } from 'cdk-serverless/projen';

const project = new ServerlessProject({
  name: 'my-graphql',
  defaultReleaseBranch: 'main',
});

new GraphQlApi(project, {
  apiName: 'MyGraphQLApi',
  definitionFile: 'schema.graphql',
});
```

### Testing Utilities (`src/tests/`)

#### Lambda REST API Testing

```typescript
import { LambdaRestUnitTest } from 'cdk-serverless/tests/lambda-test-utils';

describe('API Handler', () => {
  const test = new LambdaRestUnitTest(handler, {
    headers: {
      'Content-Type': 'application/json',
    },
    cognito: {
      username: 'test-user',
      email: 'test@example.com',
      groups: ['admin'],
    },
  });
  
  it('gets items successfully', async () => {
    const result = await test.call({
      path: '/items',
      method: 'GET',
      queryParams: { limit: '10' },
    });
    
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toHaveProperty('items');
  });
});
```

#### Lambda GraphQL Testing

```typescript
import { LambdaGraphQLTest } from 'cdk-serverless/tests/lambda-test-utils';

describe('GraphQL Resolver', () => {
  const test = new LambdaGraphQLTest(handler, {
    cognito: {
      username: 'test-user',
      email: 'test@example.com',
      groups: ['admin'],
    },
  });
  
  it('resolves getItems query', async () => {
    const result = await test.call({
      fieldName: 'getItems',
      arguments: { limit: 10 },
    });
    
    expect(result).toHaveProperty('items');
  });
});
```

#### Integration Testing

```typescript
import { IntegTestUtil } from 'cdk-serverless/tests/integ-test-util';

describe('Integration Tests', () => {
  const util = new IntegTestUtil({
    region: 'us-east-1',
    apiOptions: {
      baseURL: 'https://api.example.com',
    },
    authOptions: {
      userPoolId: 'us-east-1_xxxxx',
      userPoolClientId: 'xxxxxxxx',
      identityPoolId: 'us-east-1:xxxxxxxx',
    },
    datastoreOptions: {
      tableName: 'MyTable',
    },
  });
  
  beforeAll(async () => {
    await util.createUser('test@example.com', {}, ['admin']);
  });
  
  afterAll(async () => {
    await util.cleanupItems();
    await util.removeUser('test@example.com');
  });
  
  it('tests API with authenticated user', async () => {
    const client = await util.getAuthenticatedClient('test@example.com');
    
    const response = await client.get('/items');
    expect(response.status).toBe(200);
  });
});
```

## MCP Auth

MCP Auth is a service-agnostic OAuth façade for the [Model Context Protocol](https://spec.modelcontextprotocol.io). It adds OAuth 2.0 discovery, authorization, token exchange, and dynamic client registration endpoints to your API so MCP clients (Claude, ChatGPT, etc.) can authenticate via standard OAuth flows.

### Using with RestApi

The easiest way is via the `mcpAuth` prop on `RestApiProps`. It supports two mutually exclusive modes:

#### Cognito Mode

```typescript
const api = new RestApi(this, 'Api', {
  apiName: 'MyApi',
  stageName: 'dev',
  definitionFileName: 'openapi.yaml',
  authentication: auth,
  domainName: 'example.com',
  apiHostname: 'api',
  cors: true,
  mcpAuth: {
    cognito: {
      auth: cognitoAuthentication, // CognitoAuthentication construct
      authDomain: 'auth.example.com', // Cognito hosted/custom domain
    },
    serverInfo: { name: 'my-mcp-server', version: '1.0.0' },
  },
});
```

A dedicated user pool client (auth code + PKCE) is created automatically with callback URLs for known MCP clients.

#### Generic Mode

```typescript
const api = new RestApi(this, 'Api', {
  // ...
  mcpAuth: {
    generic: {
      authorizeEndpoint: 'https://auth.example.com/oauth2/authorize',
      tokenEndpoint: 'https://auth.example.com/oauth2/token',
      clientId: 'my-pre-provisioned-client-id',
    },
    serverInfo: { name: 'my-mcp-server', version: '1.0.0' },
  },
});
```

#### McpAuthOptions

| Property | Default | Description |
|----------|---------|-------------|
| `cognito` | — | Cognito-specific config (mutually exclusive with `generic`) |
| `generic` | — | Any OAuth2 provider config (mutually exclusive with `cognito`) |
| `serverInfo` | *required* | `{ name, version }` returned in MCP `initialize` response |
| `allowedRedirectUris` | Claude + ChatGPT callbacks | URIs allowed for dynamic client registration |
| `protocolVersions` | `['2025-11-25', '2025-03-26', '2024-11-05']` | Supported MCP protocol versions |
| `scopes` | `['openid', 'email', 'profile']` | OAuth scopes advertised in discovery |
| `stripParameters` | `['resource']` | Params stripped before proxying to upstream |
| `lambdaOptions` | — | Lambda config for MCP auth handlers |

### Auto-Injected Endpoints

When `mcpAuth` is configured, 5 anonymous paths are added to the OpenAPI spec:

| Method | Path | RFC | Purpose |
|--------|------|-----|---------|
| GET | `/.well-known/oauth-protected-resource` | RFC 9728 | Resource metadata discovery |
| GET | `/.well-known/oauth-authorization-server` | RFC 8414 | Authorization server metadata |
| GET | `/oauth/authorize` | — | Proxies to upstream authorize endpoint |
| POST | `/oauth/token` | — | Proxies to upstream token endpoint |
| POST | `/oauth/register` | RFC 7591 | Dynamic client registration |

All endpoints bypass the API authorizer (`security: []`). The API domain is derived from the RestApi's own domain configuration.

### Standalone Constructs

For use outside `RestApi` (e.g., with HTTP API or custom integration):

#### McpCognitoAuth

Convenience wrapper that creates a Cognito client + the generic `McpAuth`:

```typescript
import { McpCognitoAuth } from 'cdk-serverless/constructs';

const mcpAuth = new McpCognitoAuth(this, 'McpAuth', {
  auth: cognitoAuthentication,
  apiDomain: 'api.example.com',
  authDomain: 'auth.example.com',
  serverInfo: { name: 'my-mcp-server', version: '1.0.0' },
  stageName: 'dev',
});

// Access the underlying McpAuth and user pool client
mcpAuth.mcpAuth.functions;      // Lambda functions for each endpoint
mcpAuth.mcpAuth.mcpEnvVars;     // Env vars to inject into your MCP handler
mcpAuth.userPoolClient;          // The created Cognito client
```

#### McpAuth

Service-agnostic construct for any OAuth2 provider:

```typescript
import { McpAuth } from 'cdk-serverless/constructs';

const mcpAuth = new McpAuth(this, 'McpAuth', {
  apiDomain: 'api.example.com',
  authorizeEndpoint: 'https://auth.example.com/oauth2/authorize',
  tokenEndpoint: 'https://auth.example.com/oauth2/token',
  allowedRedirectUris: ['https://claude.ai/oauth/callback'],
  clientId: 'my-client-id',
  serverInfo: { name: 'my-mcp-server', version: '1.0.0' },
  stageName: 'dev',
});

// Wire functions into your own API Gateway
mcpAuth.functions.protectedResource; // GET /.well-known/oauth-protected-resource
mcpAuth.functions.authorizationServer; // GET /.well-known/oauth-authorization-server
mcpAuth.functions.authorize;          // GET /oauth/authorize
mcpAuth.functions.token;              // POST /oauth/token
mcpAuth.functions.register;           // POST /oauth/register

// Inject env vars into your MCP RPC handler Lambda
mcpAuth.mcpEnvVars; // { MCP_API_DOMAIN, MCP_AUTHORIZE_ENDPOINT, ... }
```

### Runtime Module (`src/mcp-auth/`)

The `mcp-auth` package provides runtime utilities for building MCP tool servers:

#### MCP JSON-RPC Server

```typescript
import { createMcpServer } from 'cdk-serverless/mcp-auth';

interface MyPrincipal {
  userId: string;
  email: string;
}

const server = createMcpServer<MyPrincipal>({
  serverInfo: { name: 'my-server', version: '1.0.0' },
  protocolVersions: ['2025-11-25', '2025-03-26', '2024-11-05'],
  resolver: {
    async resolve(headers) {
      // Validate Bearer token, return principal or throw McpUnauthorizedError
      const token = headers.authorization?.replace('Bearer ', '');
      if (!token) throw new McpUnauthorizedError('Missing token', 'Bearer');
      return verifyToken(token);
    },
  },
  tools: [
    {
      name: 'get_items',
      description: 'List items for the authenticated user',
      inputSchema: { type: 'object', properties: { limit: { type: 'number' } } },
      async invoke(principal, args) {
        const items = await getItemsForUser(principal.userId);
        return { content: [{ type: 'text', text: JSON.stringify(items) }] };
      },
    },
  ],
});

// In your Lambda handler:
export const handler = async (event: APIGatewayProxyEvent) => {
  const body = JSON.parse(event.body ?? '{}');
  const headers = event.headers as Record<string, string | undefined>;
  const response = await server.handle(body, headers);
  return response;
};
```

#### Key Types

```typescript
// Tool definition — register tools with the server
interface McpToolDefinition<TPrincipal> {
  name: string;
  description: string | ((principal: TPrincipal) => Promise<string>);
  inputSchema: object; // JSON Schema
  invoke(principal: TPrincipal, args: unknown): Promise<McpToolResult>;
}

// Credential resolver — authenticate incoming requests
interface McpCredentialResolver<TPrincipal> {
  resolve(headers: Record<string, string | undefined>): Promise<TPrincipal>;
}

// Server options
interface McpServerOptions<TPrincipal> {
  serverInfo: { name: string; version: string };
  protocolVersions: string[];
  resolver: McpCredentialResolver<TPrincipal>;
  tools: Array<McpToolDefinition<TPrincipal>>;
}

// Runtime config (read from Lambda env vars)
interface McpAuthConfig {
  apiDomain: string;
  authorizeEndpoint: string;
  tokenEndpoint: string;
  allowedRedirectUris: string[];
  clientId: string;
  serverInfo: { name: string; version: string };
  protocolVersions: string[];
  scopes?: string[];
  stripParameters?: string[];
}
```

The server handles the JSON-RPC protocol (`initialize`, `notifications/initialized`, `tools/list`, `tools/call`), credential resolution via the `McpCredentialResolver`, and per-tool dispatch with typed principals.

## Common Workflows

### Creating a New Serverless Project

1. Initialize a new ServerlessProject
2. Add required constructs (RestApi, GraphQlApi, etc.)
3. Run `npx projen` to generate files
4. Implement Lambda handlers for API operations
5. Deploy with `cdk deploy`

### Adding a New API Endpoint

1. Update OpenAPI/GraphQL schema
2. Run `npx projen` to regenerate models
3. Create Lambda handler for the new operation
4. Update API construct with new handler

### Implementing Authentication

1. Add CognitoAuthentication construct
2. Configure API to use the authentication
3. Use authentication helpers in Lambda handlers

### Working with DynamoDB

1. Create SingleTableDatastore with desired schema
2. Grant Lambda functions access to the table
3. Use DynamoDB client in Lambda handlers

## Best Practices

1. **Single-table Design**: Use one DynamoDB table with carefully designed keys for all entities.
2. **Type Safety**: Leverage TypeScript and generated types for API operations.
3. **Error Handling**: Use the provided error classes for consistent error responses.
4. **Testing**: Write unit tests with the provided testing utilities.
5. **Authentication**: Properly secure all API endpoints using the authentication helpers.

## Common Pitfalls

1. **Incorrect Permissions**: Ensure Lambda functions have the necessary permissions to access resources.
2. **Missing Environment Variables**: Set required environment variables for Lambda functions.
3. **Improper Error Handling**: Use the provided error classes instead of throwing generic errors.
4. **CDK Version Mismatches**: Ensure AWS CDK version is compatible with cdk-serverless.

## Conclusion

CDK Serverless provides a rich set of tools for building serverless applications on AWS. By understanding its components and usage patterns, you can efficiently generate code that follows best practices and integrates well with the library's features.