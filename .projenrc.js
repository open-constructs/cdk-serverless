const { TaimosTypescriptLibrary } = require('@taimos/projen');

const project = new TaimosTypescriptLibrary({
  name: 'cdk-serverless',
  deps: [
    'aws-sdk',
    '@taimos/lambda-toolbox',
    'date-fns',
    'esbuild',
    'js-yaml',
    'openapi-typescript',
    'projen',
  ],
  defaultReleaseBranch: 'main',
  majorVersion: 1,
  docgen: false,
  devDeps: [
    '@types/aws-lambda',
    '@types/js-yaml',
    '@taimos/projen',
  ],
  peerDeps: [
    'aws-cdk-lib@^2.2.0',
    '@aws-cdk/aws-appsync-alpha@^2.2.0-alpha.0',
    '@aws-cdk/aws-apigatewayv2-alpha@^2.2.0-alpha.0',
    '@aws-cdk/aws-apigatewayv2-integrations-alpha@^2.2.0-alpha.0',
    'constructs@^10.0.0',
  ],
  keywords: [
    'aws',
    'lambda',
    'dynamodb',
  ],
  repository: 'https://github.com/taimos/cdk-serverless',
});

project.synth();
