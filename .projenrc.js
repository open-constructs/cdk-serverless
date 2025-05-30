const { typescript, javascript, github, ReleasableCommits } = require('projen');

const project = new typescript.TypeScriptProject({
  authorName: 'Taimos GmbH',
  authorEmail: 'info@taimos.de',
  authorOrganization: true,
  authorUrl: 'https://taimos.de',
  copyrightOwner: 'Taimos GmbH',
  copyrightPeriod: '2024',
  license: 'Apache-2.0',
  licensed: true,
  stability: 'experimental',
  name: 'cdk-serverless',
  deps: [
    '@types/aws-lambda',
    'date-fns',
    'js-yaml',
    'jsonwebtoken',
    'jwk-to-pem',
    'axios',
    'uuid',
    'lambda-log',
    'constructs',
  ],
  defaultReleaseBranch: 'main',
  packageManager: javascript.NodePackageManager.NPM,
  minMajorVersion: '2',
  docgen: false,
  devDeps: [
    'ts-node',
    '@types/js-yaml',
    '@types/lambda-log',
    '@types/jsonwebtoken',
    '@types/jwk-to-pem',
    '@types/uuid',
    '@hapi/boom',
    'typedoc@0.27.6',
    '@aws-sdk/client-cognito-identity-provider',
    '@aws-sdk/client-s3',
    '@aws-sdk/client-dynamodb',
    '@aws-sdk/lib-dynamodb',
  ],
  peerDeps: [
    'openapi-typescript',
    'dynamodb-onetable@2.7.5',
    'projen@>=0.91.6 <1.0.0',
    'aws-cdk-lib@>=2.187.0 <3.0.0',
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
  repository: 'https://github.com/open-constructs/cdk-serverless',
  tsconfig: {
    compilerOptions: {
      lib: [
        'es2019',
        'dom',
      ],
      skipLibCheck: true,
    },
  },
  releaseToNpm: true,
  npmAccess: javascript.NpmAccess.PUBLIC,
  gitpod: true,
  autoApproveUpgrades: true,
  autoApproveOptions: { allowedUsernames: ['hoegertn', 'open-constructs-projen[bot]'], secret: 'GITHUB_TOKEN' },
  depsUpgradeOptions: { workflowOptions: { schedule: javascript.UpgradeDependenciesSchedule.WEEKLY } },
  releasableCommits: ReleasableCommits.ofType(['feat', 'fix', 'revert', 'Revert']),
  githubOptions: {
    projenCredentials: github.GithubCredentials.fromApp(),
    pullRequestLintOptions: {
      semanticTitleOptions: {
        types: ['feat', 'fix', 'chore', 'ci', 'docs', 'style', 'refactor', 'test', 'revert', 'Revert'],
      },
    },
  },
  pullRequestTemplateContents: [`* **Please check if the PR fulfills these requirements**
- [ ] The commit message describes your change
- [ ] Tests for the changes have been added if possible (for bug fixes / features)
- [ ] Docs have been added / updated (for bug fixes / features)


* **What kind of change does this PR introduce?** (Bug fix, feature, docs update, ...)



* **What is the current behavior?** (You can also link to an open issue here)



* **What is the new behavior (if this is a feature change)?**



* **Does this PR introduce a breaking change?** (What changes might users need to make in their setup due to this PR?)



* **Other information**:`],

});

const docgen = project.addTask('docgen', {
  description: 'Generate TypeScript API reference',
  exec: `typedoc ${project.srcdir}/constructs --disableSources --out ${project.docsDirectory}constructs/`,
});
docgen.exec(`typedoc ${project.srcdir}/projen --disableSources --out ${project.docsDirectory}projen/`);
docgen.exec(`typedoc ${project.srcdir}/lambda --disableSources --out ${project.docsDirectory}lambda/`);
project.postCompileTask.spawn(docgen);

project.synth();