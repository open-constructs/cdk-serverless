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
  gitpod: true,
  autoApproveUpgrades: true,
  autoApproveOptions: { allowedUsernames: ['hoegertn'], secret: 'GITHUB_TOKEN' },
  depsUpgradeOptions: {
    workflowOptions: {
      secret: 'GH_TOKEN',
    },
  },
  pullRequestTemplateContents: [`* **Please check if the PR fulfills these requirements**
- [ ] The commit message describes your change and conform to conventional commits
- [ ] Tests for the changes have been added if possible (for bug fixes / features)
- [ ] Docs have been added / updated (for bug fixes / features)

* **What kind of change does this PR introduce?** (Bug fix, feature, docs update, ...)



* **What is the current behavior?** (You can also link to an open issue here)



* **What is the new behavior (if this is a feature change)?**



* **Does this PR introduce a breaking change?** (What changes might users need to make in their setup due to this PR?)



* **Other information**:`],
});

project.synth();
