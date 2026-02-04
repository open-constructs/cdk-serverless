import * as fs from 'node:fs';
import * as path from 'node:path';
import { App, Stack, aws_kms, aws_logs } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { RestApi } from '../../src/constructs';

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

// Define test types
interface TestPaths {
  '/items': {
    get: unknown;
    post: unknown;
  };
}

interface TestOperations {
  getItems: unknown;
  createItem: unknown;
}

describe('RestApi', () => {
  let app: App;
  let stack: Stack;
  const specPath = path.join(__dirname, 'test-openapi.yaml');
  const lambdaDir = path.join(__dirname, '../../src/lambda');

  const lambdaFiles = [
    'rest.testapi.getItems.ts',
    'rest.testapi.createItem.ts',
  ];

  beforeAll(() => {
    // Create a minimal OpenAPI spec file for the tests
    fs.writeFileSync(specPath, `
openapi: '3.0.0'
info:
  title: Test API
  version: '1.0.0'
paths:
  /items:
    get:
      operationId: getItems
      summary: Get items
      responses:
        '200':
          description: Success
    post:
      operationId: createItem
      summary: Create item
      responses:
        '201':
          description: Created
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
    // Clean up the test spec file
    if (fs.existsSync(specPath)) {
      fs.unlinkSync(specPath);
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

  describe('basic functionality', () => {
    test('creates REST API with required properties', () => {
      new RestApi<TestPaths, TestOperations>(stack, 'TestApi', {
        apiName: 'TestApi',
        stageName: 'test',
        definitionFileName: specPath,
        cors: true,
      });

      const template = Template.fromStack(stack);

      // Verify REST API is created
      template.hasResourceProperties('AWS::ApiGateway::RestApi', {
        Name: 'TestApi [test]',
      });
    });

    test('matches snapshot with gateway logging enabled', () => {
      new RestApi<TestPaths, TestOperations>(stack, 'TestApi', {
        apiName: 'TestApi',
        stageName: 'test',
        definitionFileName: specPath,
        cors: true,
        gatewayLogging: {},
      });

      const template = Template.fromStack(stack);
      expect(template.toJSON()).toMatchSnapshot();
    });

    test('creates Lambda functions for operations', () => {
      new RestApi<TestPaths, TestOperations>(stack, 'TestApi', {
        apiName: 'TestApi',
        stageName: 'test',
        definitionFileName: specPath,
        cors: true,
      });

      const template = Template.fromStack(stack);

      // Verify Lambda functions are created
      template.resourceCountIs('AWS::Lambda::Function', 2);
    });
  });

  describe('gateway logging', () => {
    test('does not create log group when gatewayLogging is not specified', () => {
      new RestApi<TestPaths, TestOperations>(stack, 'TestApi', {
        apiName: 'TestApi',
        stageName: 'test',
        definitionFileName: specPath,
        cors: true,
      });

      const template = Template.fromStack(stack);

      // Verify no log group is created for access logs
      template.resourceCountIs('AWS::Logs::LogGroup', 0);
    });

    test('creates log group with default settings when gatewayLogging is enabled', () => {
      new RestApi<TestPaths, TestOperations>(stack, 'TestApi', {
        apiName: 'TestApi',
        stageName: 'test',
        definitionFileName: specPath,
        cors: true,
        gatewayLogging: {},
      });

      const template = Template.fromStack(stack);

      // Verify log group is created
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: 'TestApi/access-log',
        RetentionInDays: 30, // ONE_MONTH
      });

      // Verify stage has access log settings
      template.hasResourceProperties('AWS::ApiGateway::Stage', {
        AccessLogSetting: {
          DestinationArn: Match.anyValue(),
          Format: Match.anyValue(),
        },
        MethodSettings: Match.arrayWith([
          Match.objectLike({
            LoggingLevel: 'INFO',
          }),
        ]),
      });
    });

    test('uses custom log group when provided', () => {
      const customLogGroup = new aws_logs.LogGroup(stack, 'CustomLogGroup', {
        logGroupName: '/custom/api-logs',
      });

      new RestApi<TestPaths, TestOperations>(stack, 'TestApi', {
        apiName: 'TestApi',
        stageName: 'test',
        definitionFileName: specPath,
        cors: true,
        gatewayLogging: {
          accessLogGroup: customLogGroup,
        },
      });

      const template = Template.fromStack(stack);

      // Verify custom log group is used (exists with the custom name)
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: '/custom/api-logs',
      });

      // Verify only one log group exists (the custom one, not an auto-created one)
      template.resourceCountIs('AWS::Logs::LogGroup', 1);
    });

    test('configures log encryption when KMS key is provided', () => {
      const kmsKey = new aws_kms.Key(stack, 'LogKey');

      new RestApi<TestPaths, TestOperations>(stack, 'TestApi', {
        apiName: 'TestApi',
        stageName: 'test',
        definitionFileName: specPath,
        cors: true,
        gatewayLogging: {
          logEncryptionKey: kmsKey,
        },
      });

      const template = Template.fromStack(stack);

      // Verify log group has KMS key configured
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        KmsKeyId: Match.anyValue(),
      });
    });

    test('configures custom retention when provided', () => {
      new RestApi<TestPaths, TestOperations>(stack, 'TestApi', {
        apiName: 'TestApi',
        stageName: 'test',
        definitionFileName: specPath,
        cors: true,
        gatewayLogging: {
          accessLogRetention: aws_logs.RetentionDays.THREE_MONTHS,
        },
      });

      const template = Template.fromStack(stack);

      // Verify log group has custom retention
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        RetentionInDays: 90, // THREE_MONTHS
      });
    });

    test('configures log format in stage deploy options', () => {
      new RestApi<TestPaths, TestOperations>(stack, 'TestApi', {
        apiName: 'TestApi',
        stageName: 'test',
        definitionFileName: specPath,
        cors: true,
        gatewayLogging: {},
      });

      const template = Template.fromStack(stack);

      // Verify stage has access log format configured
      template.hasResourceProperties('AWS::ApiGateway::Stage', {
        AccessLogSetting: {
          Format: Match.stringLikeRegexp('requestId'),
        },
      });
    });
  });
});
