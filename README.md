# CDK Serverless

[![npm version](https://badge.fury.io/js/cdk-serverless.svg)](https://badge.fury.io/js/cdk-serverless)

CDK Serverless is a powerful toolkit designed to simplify serverless application development using the AWS Cloud Development Kit (CDK). It offers project management features, higher-level (L3) constructs, and utility libraries to streamline the creation and management of serverless architectures. Additionally, it leverages utility libraries to write Lambda functions and do live updates to Lambda function code during development.

Video introduction: https://www.youtube.com/watch?v=xhNJ0cXG3O8

### Features

* Projen helper classes for easy project configuration
* AWS CDK L3-constructs for RestApi, GraphQlApi, and more
* Zero-config Lambda function and VTL template generation
* Automatic DynamoDB single-table infrastructure setup
* Built-in monitoring for Lambda functions and APIs
* Full compatibility with CDK for custom implementations
* Type-safe auto-completion for routes, resolvers, etc.
* Support for Cognito authentication and authorization
* Automated generation of CloudFormation outputs for testing

## Quick Start

To begin a new project with CDK Serverless:

Create a new CDK TypeScript app using projen:

```bash
$ npx projen new awscdk-app-ts
```

Adding CDK Serverless is a two step process:

1. Add 'cdk-serverless' as a dependency to your project
2. Run `npx projen` to install it

Now you can use the project type `ServerlessProject` for your app.

### Adding projen constructs

First you need to add the desired construct to your projen configuration: (e.g. RestApi)

```typescript
import { RestApi } from 'cdk-serverless/projen';

new RestApi(project, {
  apiName: 'TestApi', // logical name of your API
  definitionFile: 'testapi.yaml', // path to your OpenAPI spec
});
```

Then run projen to generate construct files and models for the API.

### Using the CDK serverless L3 constructs

In your stack you can then reference the generated L3s to create the API:

```typescript
import { TestApiRestApi } from './generated/rest.testapi-api.generated';


const api = new TestApiRestApi(this, 'Api', {
  stageName: props.stageName,
  domainName: props.domainName,
  apiHostname: 'api',
  singleTableDatastore,
  cors: true,
  additionalEnv: {
    DOMAIN_NAME: props.domainName,
  },
});
```

This will also create Lambda functions for all operations defined in your spec and wire them accordingly.

## Testing Utilities

CDK Serverless provides two powerful test utilities to help you write comprehensive tests for your serverless applications.

### LambdaTestUtil

The `LambdaTestUtil` provides classes for testing both REST and GraphQL Lambda functions in isolation. It's perfect for unit testing your Lambda handlers.

#### REST API Testing

```typescript
import { LambdaRestUnitTest } from 'cdk-serverless/tests/lambda-test-utils';

const test = new LambdaRestUnitTest(handler, {
  // Optional default headers for all requests
  headers: {
    'Content-Type': 'application/json',
  },
  // Optional default Cognito user for all requests
  cognito: {
    username: 'test-user',
    email: 'test@example.com',
    groups: ['admin'],
  },
});

// Test a GET request
const result = await test.call({
  path: '/items',
  method: 'GET',
});

// Test a POST request with body
const result = await test.call({
  path: '/items',
  method: 'POST',
  body: JSON.stringify({ name: 'test' }),
});
```

#### GraphQL Testing

```typescript
import { LambdaGraphQLTest } from 'cdk-serverless/tests/lambda-test-utils';

const test = new LambdaGraphQLTest(handler, {
  // Optional default Cognito user for all requests
  cognito: {
    username: 'test-user',
    email: 'test@example.com',
    groups: ['admin'],
  },
});

// Test a GraphQL query
const result = await test.call({
  fieldName: 'getItem',
  arguments: { id: '123' },
});
```

### IntegTestUtil

The `IntegTestUtil` provides a comprehensive set of tools for integration testing your deployed serverless applications. It handles authentication, data cleanup, and API testing.

```typescript
import { IntegTestUtil } from 'cdk-serverless/tests/integ-test-util';

// Initialize with your stack outputs
const test = new IntegTestUtil({
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

// Create and authenticate a test user
await test.createUser('test@example.com', {
  'custom:attribute': 'value',
}, ['admin']);

// Get an authenticated API client
const client = await test.getAuthenticatedClient('test@example.com');

// Make API calls
const response = await client.get('/items');

// Clean up test data
await test.cleanupItems();
await test.removeUser('test@example.com');
```

## Contribute

### How to contribute to CDK Serverless

#### **Did you find a bug?**

* **Ensure the bug was not already reported** by searching on GitHub under [Issues](https://github.com/taimos/cdk-serverless/issues).

* If you're unable to find an open issue addressing the problem, [open a new one](https://github.com/taimos/cdk-serverless/issues/new). Be sure to include a **title and clear description**, as much relevant information as possible, and a **code sample** or an **executable test case** demonstrating the expected behavior that is not occurring.

#### **Did you write a patch that fixes a bug?**

* Open a new GitHub pull request with the patch.

* Ensure the PR description clearly describes the problem and solution. Include the relevant issue number if applicable.

#### **Did you fix whitespace, format code, or make a purely cosmetic patch?**

Changes that are cosmetic in nature and do not add anything substantial to the stability, functionality, or testability will normally not be accepted.

#### **Do you intend to add a new feature or change an existing one?**

* Suggest your change under [Issues](https://github.com/taimos/cdk-serverless/issues).

* Do not open a pull request on GitHub until you have collected positive feedback about the change.

#### **Do you want to contribute to the CDK Serverless documentation?**

* Just file a PR with your recommended changes

## Authors

Brought to you by [Taimos](https://taimos.de)