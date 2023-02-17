const { TaimosTypescriptLibrary } = require('@taimos/projen');

const project = new TaimosTypescriptLibrary({
  name: '@taimos/cdk-serverless-v2',
  deps: [
    'date-fns',
    'js-yaml',
    'projen',
  ],
  defaultReleaseBranch: 'v2',
  docgen: false,
  devDeps: [
    '@types/aws-lambda',
    '@types/js-yaml',
    '@taimos/projen',
  ],
  peerDeps: [
    '@taimos/lambda-toolbox',
    'openapi-typescript',
    'dynamodb-onetable',
    'aws-cdk-lib@^2.60.0',
    'constructs@^10.0.5',
  ],
  keywords: [
    'aws',
    'cdk',
    'serverless',
    'lambda',
    'dynamodb',
  ],
  repository: 'https://github.com/taimos/cdk-serverless',
  minNodeVersion: 'v16.14.1',
  tsconfig: {
    compilerOptions: {
      lib: [
        'es2019',
        'dom',
      ],
    },
  },
});

project.addDevDeps('typedoc');

const docgen = project.addTask('docgen', {
  description: 'Generate TypeScript API reference',
  exec: `typedoc ${project.srcdir}/constructs --disableSources --out ${project.docsDirectory}constructs/`,
});
docgen.exec(`typedoc ${project.srcdir}/projen --disableSources --out ${project.docsDirectory}projen/`);
project.postCompileTask.spawn(docgen);

project.synth();