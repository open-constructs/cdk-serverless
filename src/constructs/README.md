
## CDK L3

This project provides several CDK constructs to facilitate the use of serverless building blocks.

### HttpApi

This construct is the base element for HTTP APIs based on AWS API Gateway.

It creates an AWS HTTP Api with the given custom domain and configures DNS and certificates.

It also adds a best practice CloudWatch dashboard that contains all relevant metrics of the API and all Lambda functions. You can disable this by setting `monitoring: false`.

By default the construct inspects your `openapi.yaml` file and generates Lambda functions for all operations using best practice settings and permissions. You can access all generated functions by their operation ID and modify all settings.

On synth all the missing handler files will be scaffolded using the Lambda toolbox wrappers.

This construct also supports creating a single table design DynamoDB table, a Cognito user pool and an S3 backed asset CDN.

Example usage:

```ts
import { HttpApi } from 'cdk-serverless/lib/constructs';
// Import the generated Path and Operation information
import { paths, operations } from './lambda/types.generated';

// Create a new HTTP API
const api = new HttpApi<paths, operations>(this, 'Api', {
  // Name of the API in the AWS console
  apiName: 'testapi',
  // This will be prefixed with 'api.' by default and will lead to https://api.taimos.de
  domainName: 'taimos.de',
  // Name of the stage in a multi-stage deployment
  stageName: 'dev',
  // Automatically create a DynamoDB table and configure a global secondary index
  // HashKey will be 'PK' and SortKey will be 'SK'
  singleTableDatastore: {
    design: {
      // Create an inverted GSI with 'SK' as HashKey and 'PK' as SortKey
      reverseGSI: true,
    },
  },
  // Add a Cognito user pool with two groups and a trigger to customize welcome e-mails
  authentication: {
    groups: {
      admin: 'Admins',
      moderators: 'Mods',
    },
    triggers: {
      customMessages: true,
    },
  },
  // automatically generate lambda functions for all routes in openapi.yaml (true by default)
  autoGenerateRoutes: true,
  // Create a CloudWatch Dashboard to monitor the API and all Lambda functions (true by default)
  monitoring: true,
});
```

### GraphQlApi

This construct is the base element for GraphQL APIs based on AWS AppSync.

It also adds a best practice CloudWatch dashboard that contains all relevant metrics of the API and all Lambda functions. You can disable this by setting `monitoring: false`.

The construct provide methods to attach resolvers to your API and supports auto-complete based on your `schema.graphql`.

You can access all generated functions by their type and field name and modify all settings.

On synth all the missing resolver files will be scaffolded using the Lambda toolbox wrappers.

This construct also supports creating a single table design DynamoDB table, a Cognito user pool and an S3 backed asset CDN.

Example usage:

```ts
import { GraphQlApi } from 'cdk-serverless/lib/constructs';
// Import the generated type information
import { Query, Mutation } from './lambda/types.generated';

// Create a new AppSync API
const api = new GraphQlApi(this, 'Api', {
  // Name of the API in the AWS console
  apiName: 'testapi',
  // Name of the stage in a multi-stage deployment
  stageName: 'dev',
  // Automatically create a DynamoDB table and configure a global secondary index
  // HashKey will be 'PK' and SortKey will be 'SK'
  singleTableDatastore: {
    design: {
      // Create an inverted GSI with 'SK' as HashKey and 'PK' as SortKey
      reverseGSI: true,
    },
  },
  // Add a Cognito user pool with two groups and a trigger to customize welcome e-mails
  authentication: {
    groups: {
      admin: 'Admins',
      moderators: 'Mods',
    },
    triggers: {
      customMessages: true,
    },
  },
  // Create a CloudWatch Dashboard to monitor the API and all Lambda functions (true by default)
  monitoring: true,
});

// Create Lambda direct resolvers for queries and mutations
api.addLambdaResolver<Query>('Query', 'listAllTasks');
api.addLambdaResolver<Mutation>('Mutation', 'addTask');
// Read `./src/vtl/Query.getTaskById.{req|res}.vtl` and use as VTL resolver backed by the DynamoDB table
api.addDynamoDbVtlResolver<Query>('Query', 'getTaskById');

```

### SingleTableDatastore

### Monitoring

### AssetCdn

### Authentication

### LambdaFunction
