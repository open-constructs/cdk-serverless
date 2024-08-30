const { TaimosTypescriptLibrary } = require('@taimos/projen');
const { NodePackageManager } = require('projen/lib/javascript');

const project = new TaimosTypescriptLibrary({
  name: 'cdk-serverless',
  deps: [
    'date-fns',
    'js-yaml',
    'projen',
    'jsonwebtoken',
    'jwk-to-pem',
    'axios',
    'uuid',
    'lambda-log',
    'constructs',
  ],
  defaultReleaseBranch: 'main',
  packageManager: NodePackageManager.NPM,
  minMajorVersion: '2',
  docgen: false,
  devDeps: [
    '@types/aws-lambda',
    '@types/js-yaml',
    '@taimos/projen',
    '@types/lambda-log',
    '@types/jsonwebtoken',
    '@types/jwk-to-pem',
    '@types/uuid',
    '@hapi/boom',
    'typedoc@0.25.0',
    '@aws-sdk/client-cognito-identity-provider',
    '@aws-sdk/client-s3',
    '@aws-sdk/client-dynamodb',
    '@aws-sdk/lib-dynamodb',
  ],
  peerDeps: [
    'openapi-typescript',
    'dynamodb-onetable',
    'aws-cdk-lib@^2.120.0',
    '@aws-cdk/aws-cognito-identitypool-alpha@^2.120.0-alpha.0',
    '@aws-sdk/client-cognito-identity-provider',
    '@aws-sdk/client-s3',
    '@aws-sdk/client-dynamodb',
    '@aws-sdk/lib-dynamodb',
  ],
  keywords: [
    'aws',
    'cdk',
    'serverless',
    'lambda',
    'dynamodb',
  ],
  repository: 'https://github.com/taimos/cdk-serverless',
  tsconfig: {
    compilerOptions: {
      lib: [
        'es2019',
        'dom',
      ],
    },
  },
});

const docgen = project.addTask('docgen', {
  description: 'Generate TypeScript API reference',
  exec: `typedoc ${project.srcdir}/constructs --disableSources --out ${project.docsDirectory}constructs/`,
});
docgen.exec(`typedoc ${project.srcdir}/projen --disableSources --out ${project.docsDirectory}projen/`);
docgen.exec(`typedoc ${project.srcdir}/lambda --disableSources --out ${project.docsDirectory}lambda/`);
project.postCompileTask.spawn(docgen);

project.synth();