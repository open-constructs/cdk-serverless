const { TaimosTypescriptLibrary } = require('@taimos/projen');

const cdkVersion = '^1.91.0';

const project = new TaimosTypescriptLibrary({
  name: 'cdk-serverless',
  deps: [
    'aws-sdk',
    '@taimos/lambda-toolbox',
    'date-fns',
    'cdk-watch',
    'esbuild',
    'js-yaml',
    'openapi-typescript',
  ],
  docgen: false,
  devDeps: [
    '@types/aws-lambda',
    '@types/js-yaml',
    '@taimos/projen',
  ],
  peerDeps: [
    `@aws-cdk/aws-lambda-nodejs@${cdkVersion}`,
    `@aws-cdk/aws-lambda@${cdkVersion}`,
    `@aws-cdk/aws-cloudwatch@${cdkVersion}`,
    `@aws-cdk/aws-dynamodb@${cdkVersion}`,
    `@aws-cdk/aws-cognito@${cdkVersion}`,
    `@aws-cdk/aws-route53@${cdkVersion}`,
    `@aws-cdk/aws-route53-targets@${cdkVersion}`,
    `@aws-cdk/aws-apigatewayv2@${cdkVersion}`,
    `@aws-cdk/aws-apigatewayv2-integrations@${cdkVersion}`,
    `@aws-cdk/aws-appsync@${cdkVersion}`,
    `@aws-cdk/aws-certificatemanager@${cdkVersion}`,
    `@aws-cdk/aws-cloudfront@${cdkVersion}`,
    `@aws-cdk/aws-s3@${cdkVersion}`,
    `@aws-cdk/core@${cdkVersion}`,
    `@aws-cdk/aws-iam@${cdkVersion}`,
    `@aws-cdk/aws-kms@${cdkVersion}`,
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

project.gitignore.include('/lib');

project.synth();
