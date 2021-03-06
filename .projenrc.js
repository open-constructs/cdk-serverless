const { TaimosTypescriptLibrary } = require('@taimos/projen');

const cdkVersion = '^1.91.0';

const project = new TaimosTypescriptLibrary({
  name: 'cdk-serverless',
  deps: [
    'aws-sdk',
    '@taimos/lambda-toolbox',
    'date-fns',
    'cdk-watch',
  ],
  docgen: false,
  devDeps: [
    '@types/aws-lambda',
    '@types/js-yaml',
    'openapi-typescript',
    '@taimos/projen',
  ],
  peerDeps: [
    `@aws-cdk/aws-lambda-nodejs@${cdkVersion}`,
    `@aws-cdk/aws-lambda@${cdkVersion}`,
    `@aws-cdk/aws-dynamodb@${cdkVersion}`,
    `@aws-cdk/aws-cognito@${cdkVersion}`,
    `@aws-cdk/aws-route53@${cdkVersion}`,
    `@aws-cdk/aws-route53-targets@${cdkVersion}`,
    `@aws-cdk/aws-apigatewayv2@${cdkVersion}`,
    `@aws-cdk/aws-apigatewayv2-integrations@${cdkVersion}`,
  ],
  keywords: [
    'aws',
    'lambda',
    'dynamodb',
  ],
  repository: 'https://github.com/taimos/cdk-serverless',
  jestOptions: {
    typescriptConfig: {
      compilerOptions: {
        esModuleInterop: true,
      },
    },
  },
});

project.synth();
