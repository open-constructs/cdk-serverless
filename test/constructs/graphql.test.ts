import * as fs from 'node:fs';
import * as path from 'node:path';
import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { CognitoAuthentication, GraphQlApi } from '../../src/constructs';

// Define a resolver type for testing
interface TestResolvers {
  Query: {
    getUser: unknown;
    listUsers: unknown;
  };
  Mutation: {
    createUser: unknown;
    updateUser: unknown;
  };
  Subscription: {
    onUserCreated: unknown;
  };
  User: {
    posts: unknown;
  };
  Post: {
    comments: unknown;
  };
}

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

// Define the lambda files that should be created for the test resolvers
const lambdaFiles = [
  'Query.getUser.ts',
  'Query.listUsers.ts',
  'Mutation.createUser.ts',
  'Mutation.updateUser.ts',
  'Subscription.onUserCreated.ts',
  'User.posts.ts',
  'Post.comments.ts',
];

describe('GraphQlApi', () => {
  let app: App;
  let stack: Stack;
  let authentication: CognitoAuthentication;
  const schemaPath = path.join(__dirname, 'test-schema.graphql');
  const lambdaDir = path.join(__dirname, '../../src/lambda');

  beforeAll(() => {
    // Create a minimal test schema file for the tests
    fs.writeFileSync(schemaPath, `
type Query {
  getUser(id: ID!): User
  listUsers: [User]
}

type Mutation {
  createUser(name: String!): User
  updateUser(id: ID!, name: String!): User
}

type Subscription {
  onUserCreated: User
}

type User {
  id: ID!
  name: String
  posts: [Post]
}

type Post {
  id: ID!
  title: String
  comments: [String]
}
`);

    // Ensure lambda directory exists and create dummy entry files
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
    // Clean up the test schema file
    if (fs.existsSync(schemaPath)) {
      fs.unlinkSync(schemaPath);
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
    authentication = new CognitoAuthentication(stack, 'Auth', {
      userPoolName: 'TestUserPool',
      identityPool: {},
    });
  });

  describe('without useNestedStacks', () => {
    test('creates GraphQL API in the main stack', () => {
      new GraphQlApi<TestResolvers>(stack, 'TestApi', {
        apiName: 'TestAPI',
        stageName: 'test',
        definitionFileName: schemaPath,
        authentication,
      });

      const template = Template.fromStack(stack);

      // Verify GraphQL API is created
      template.hasResourceProperties('AWS::AppSync::GraphQLApi', {
        Name: 'TestAPI [test]',
      });

      // Verify no nested stacks are created
      template.resourceCountIs('AWS::CloudFormation::Stack', 0);
    });

    test('creates Lambda resolver in the main stack', () => {
      const api = new GraphQlApi<TestResolvers>(stack, 'TestApi', {
        apiName: 'TestAPI',
        stageName: 'test',
        definitionFileName: schemaPath,
        authentication,
      });

      api.addLambdaResolver('Query', 'getUser');

      const template = Template.fromStack(stack);

      // Without typedErrors (the default), the resolver is a plain UNIT
      // direct-Lambda resolver (the pre-#385 shape): no APPSYNC_JS pipeline, no
      // inline Code and no PipelineConfig.
      template.hasResourceProperties('AWS::AppSync::Resolver', {
        TypeName: 'Query',
        FieldName: 'getUser',
        Code: Match.absent(),
        PipelineConfig: Match.absent(),
      });

      // The default path creates no APPSYNC_JS pipeline function.
      template.resourceCountIs('AWS::AppSync::FunctionConfiguration', 0);

      // Verify Lambda function is created
      template.hasResourceProperties('AWS::Lambda::Function', {
        Description: '[test] Type Query Field getUser Resolver',
      });

      // On the default UNIT path the resolver Lambda carries no
      // APPSYNC_TYPED_ERRORS env var, so createAppSyncHandler rethrows typed
      // errors instead of returning the envelope as field data.
      template.hasResourceProperties('AWS::Lambda::Function', {
        Description: '[test] Type Query Field getUser Resolver',
        Environment: Match.absent(),
      });

      // Verify no nested stacks
      template.resourceCountIs('AWS::CloudFormation::Stack', 0);
    });

    test('creates APPSYNC_JS pipeline Lambda resolver when typedErrors is enabled', () => {
      const api = new GraphQlApi<TestResolvers>(stack, 'TestApi', {
        apiName: 'TestAPI',
        stageName: 'test',
        definitionFileName: schemaPath,
        authentication,
        typedErrors: true,
      });

      api.addLambdaResolver('Query', 'getUser');

      const template = Template.fromStack(stack);

      // With typedErrors enabled, the resolver is an APPSYNC_JS pipeline resolver
      // whose response handler converts the error envelope into a GraphQL error
      // via util.error / util.appendError.
      template.hasResourceProperties('AWS::AppSync::Resolver', {
        TypeName: 'Query',
        FieldName: 'getUser',
        Kind: 'PIPELINE',
        Runtime: {
          Name: 'APPSYNC_JS',
          RuntimeVersion: '1.0.0',
        },
        Code: Match.stringLikeRegexp('if \\(result && result\\.__appSyncError\\)'),
      });

      // The error branch keys on the __appSyncError sentinel and raises the
      // typed error via util.error, so a legitimate result that merely has an
      // errorMessage field is not misclassified.
      template.hasResourceProperties('AWS::AppSync::Resolver', {
        TypeName: 'Query',
        FieldName: 'getUser',
        Code: Match.stringLikeRegexp('util\\.error\\(result\\.errorMessage, result\\.errorType, null, result\\.errorInfo\\)'),
      });

      // The success path returns the resolver result unchanged. A result without
      // the sentinel falls through the error branch and is passed through as-is.
      template.hasResourceProperties('AWS::AppSync::Resolver', {
        TypeName: 'Query',
        FieldName: 'getUser',
        Code: Match.stringLikeRegexp('return result;'),
      });

      // The response handler also appends invoke-level errors.
      template.hasResourceProperties('AWS::AppSync::Resolver', {
        TypeName: 'Query',
        FieldName: 'getUser',
        Code: Match.stringLikeRegexp('util\\.appendError\\(ctx\\.error\\.message, ctx\\.error\\.type, ctx\\.result\\)'),
      });

      // The Lambda invoke runs as an APPSYNC_JS pipeline function.
      template.hasResourceProperties('AWS::AppSync::FunctionConfiguration', {
        Runtime: {
          Name: 'APPSYNC_JS',
          RuntimeVersion: '1.0.0',
        },
      });

      // Verify Lambda function is created
      template.hasResourceProperties('AWS::Lambda::Function', {
        Description: '[test] Type Query Field getUser Resolver',
      });

      // On the typedErrors path addLambdaResolver injects APPSYNC_TYPED_ERRORS=true
      // so createAppSyncHandler returns the envelope the response handler expects.
      template.hasResourceProperties('AWS::Lambda::Function', {
        Description: '[test] Type Query Field getUser Resolver',
        Environment: {
          Variables: {
            APPSYNC_TYPED_ERRORS: 'true',
          },
        },
      });

      // Verify no nested stacks
      template.resourceCountIs('AWS::CloudFormation::Stack', 0);
    });

    test('creates multiple resolvers in the main stack', () => {
      const api = new GraphQlApi<TestResolvers>(stack, 'TestApi', {
        apiName: 'TestAPI',
        stageName: 'test',
        definitionFileName: schemaPath,
        authentication,
      });

      api.addLambdaResolver('Query', 'getUser');
      api.addLambdaResolver('Query', 'listUsers');
      api.addLambdaResolver('Mutation', 'createUser');

      const template = Template.fromStack(stack);

      // Count resolvers in main stack
      template.resourceCountIs('AWS::AppSync::Resolver', 3);

      // Verify no nested stacks
      template.resourceCountIs('AWS::CloudFormation::Stack', 0);
    });
  });

  describe('with useNestedStacks enabled', () => {
    test('creates nested stacks for resolvers', () => {
      const api = new GraphQlApi<TestResolvers>(stack, 'TestApi', {
        apiName: 'TestAPI',
        stageName: 'test',
        definitionFileName: schemaPath,
        authentication,
        useNestedStacks: true,
      });

      api.addLambdaResolver('Query', 'getUser');
      api.addLambdaResolver('Mutation', 'createUser');

      const template = Template.fromStack(stack);

      // Verify nested stacks are created (one for Query, one for Mutation)
      template.resourceCountIs('AWS::CloudFormation::Stack', 2);
    });

    test('groups Query resolvers in QueryResolvers nested stack', () => {
      const api = new GraphQlApi<TestResolvers>(stack, 'TestApi', {
        apiName: 'TestAPI',
        stageName: 'test',
        definitionFileName: schemaPath,
        authentication,
        useNestedStacks: true,
      });

      api.addLambdaResolver('Query', 'getUser');
      api.addLambdaResolver('Query', 'listUsers');

      const template = Template.fromStack(stack);

      // Only one nested stack for Query resolvers
      template.resourceCountIs('AWS::CloudFormation::Stack', 1);

      // Main stack should not have resolvers directly
      template.resourceCountIs('AWS::AppSync::Resolver', 0);
    });

    test('groups Mutation resolvers in MutationResolvers nested stack', () => {
      const api = new GraphQlApi<TestResolvers>(stack, 'TestApi', {
        apiName: 'TestAPI',
        stageName: 'test',
        definitionFileName: schemaPath,
        authentication,
        useNestedStacks: true,
      });

      api.addLambdaResolver('Mutation', 'createUser');
      api.addLambdaResolver('Mutation', 'updateUser');

      const template = Template.fromStack(stack);

      // Only one nested stack for Mutation resolvers
      template.resourceCountIs('AWS::CloudFormation::Stack', 1);
    });

    test('groups field resolvers in FieldResolvers nested stack', () => {
      const api = new GraphQlApi<TestResolvers>(stack, 'TestApi', {
        apiName: 'TestAPI',
        stageName: 'test',
        definitionFileName: schemaPath,
        authentication,
        useNestedStacks: true,
      });

      // Field resolvers on custom types should go to Field nested stack
      api.addLambdaResolver('User', 'posts');

      const template = Template.fromStack(stack);

      // One nested stack for Field resolvers
      template.resourceCountIs('AWS::CloudFormation::Stack', 1);
    });

    test('creates separate nested stacks for Query, Mutation, Subscription, and Field', () => {
      const api = new GraphQlApi<TestResolvers>(stack, 'TestApi', {
        apiName: 'TestAPI',
        stageName: 'test',
        definitionFileName: schemaPath,
        authentication,
        useNestedStacks: true,
      });

      api.addLambdaResolver('Query', 'getUser');
      api.addLambdaResolver('Mutation', 'createUser');
      api.addLambdaResolver('Subscription', 'onUserCreated');
      api.addLambdaResolver('User', 'posts');

      const template = Template.fromStack(stack);

      // Four nested stacks: Query, Mutation, Subscription, Field
      template.resourceCountIs('AWS::CloudFormation::Stack', 4);
    });

    test('multiple custom types share the same Field nested stack', () => {
      const api = new GraphQlApi<TestResolvers>(stack, 'TestApi', {
        apiName: 'TestAPI',
        stageName: 'test',
        definitionFileName: schemaPath,
        authentication,
        useNestedStacks: true,
      });

      // Both should go to the same Field nested stack
      api.addLambdaResolver('User', 'posts');
      api.addLambdaResolver('Post', 'comments');

      const template = Template.fromStack(stack);

      // Only one Field nested stack for all custom type resolvers
      template.resourceCountIs('AWS::CloudFormation::Stack', 1);
    });

    test('GraphQL API remains in the main stack', () => {
      const api = new GraphQlApi<TestResolvers>(stack, 'TestApi', {
        apiName: 'TestAPI',
        stageName: 'test',
        definitionFileName: schemaPath,
        authentication,
        useNestedStacks: true,
      });

      api.addLambdaResolver('Query', 'getUser');

      const template = Template.fromStack(stack);

      // GraphQL API should be in the main stack, not nested
      template.hasResourceProperties('AWS::AppSync::GraphQLApi', {
        Name: 'TestAPI [test]',
      });
    });
  });

  describe('useNestedStacks defaults to false', () => {
    test('does not create nested stacks when useNestedStacks is not specified', () => {
      const api = new GraphQlApi<TestResolvers>(stack, 'TestApi', {
        apiName: 'TestAPI',
        stageName: 'test',
        definitionFileName: schemaPath,
        authentication,
        // useNestedStacks not specified - should default to false
      });

      api.addLambdaResolver('Query', 'getUser');
      api.addLambdaResolver('Mutation', 'createUser');

      const template = Template.fromStack(stack);

      // No nested stacks
      template.resourceCountIs('AWS::CloudFormation::Stack', 0);

      // Resolvers in main stack
      template.resourceCountIs('AWS::AppSync::Resolver', 2);
    });
  });
});
