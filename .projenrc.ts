import { typescript, javascript, github, ReleasableCommits } from 'projen';

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
    'lambda-log',
    'constructs',
  ],
  defaultReleaseBranch: 'main',
  packageManager: javascript.NodePackageManager.NPM,
  projenrcTs: true,
  jestOptions: { jestVersion: '^30' },
  minMajorVersion: 2,
  docgen: false,
  devDeps: [
    'ts-node',
    '@types/js-yaml',
    '@types/lambda-log',
    '@types/jsonwebtoken',
    '@types/jwk-to-pem',
    '@hapi/boom',
    'typedoc',
    '@aws-sdk/client-cognito-identity-provider',
    '@aws-sdk/client-s3',
    '@aws-sdk/client-dynamodb',
    '@aws-sdk/lib-dynamodb',
  ],
  peerDeps: [
    'openapi-typescript',
    'dynamodb-onetable@2.7.7',
    'projen@>=0.104.5 <1.0.0',
    'aws-cdk-lib@>=2.273.0 <3.0.0',
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
  npmTrustedPublishing: true,
  gitpod: true,
  autoApproveUpgrades: true,
  autoApproveOptions: { allowedUsernames: ['hoegertn', 'open-constructs-projen[bot]'], secret: 'GITHUB_TOKEN' },
  depsUpgradeOptions: { workflowOptions: { schedule: javascript.UpgradeDependenciesSchedule.WEEKLY } },
  releasableCommits: ReleasableCommits.ofType(['feat', 'fix', 'revert', 'Revert', 'chore']),
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

// Force patched versions of transitive dependencies flagged by npm audit.
// These are pulled in by devDeps/peerDeps and have no direct version lever,
// so we pin them via npm overrides. Each entry clears a specific advisory.
project.package.addPackageResolutions(
  'handlebars@^4.7.10', // CRITICAL: JS injection via unsafe inline embedding (via ts-jest)
  'browserslist@^4.29.3', // HIGH: unbounded memory growth (via @babel/core)
  'fast-uri@^3.1.8', // HIGH: host confusion via literal backslash (via ajv)
  'fast-xml-parser@^5.7.0', // MODERATE: XML comment/CDATA injection (via @aws-sdk)
  'baseline-browser-mapping@^2.11.0', // MODERATE: DoS on invalid input (via browserslist)
  '@babel/core@^7.29.7', // LOW: arbitrary file read via sourceMappingURL
  '@humanfs/node@^0.16.8', // MODERATE: recursive copy follows symlinks (via eslint)
);

// brace-expansion ReDoS (HIGH, GHSA-v6h2-p8h4-qcjw) spans the 1.x, 2.x and 5.x
// lines, so every minimatch instance in the tree needs a patched release. A
// single global override is NOT safe: brace-expansion 5.x dropped the callable
// default export that 1.x/2.x shipped as `module.exports = expand`, and
// minimatch 3.1.5 (eslint, eslint-plugin-import, commit-and-tag-version's
// dotgitignore) still does `require('brace-expansion')(pattern)`. Forcing 5.x
// there throws "expand is not a function" on any brace pattern. So we scope the
// override by minimatch major: the modern minimatch lines (5.x/9.x/10.x, which
// declare ^5) get the patched 5.0.12, and minimatch 3.x keeps a patched 1.x
// (1.1.21 > the 1.1.12 fix) that preserves the callable export. Both ends clear
// the advisory. addPackageResolutions renders only flat string overrides, so
// the nested minimatch@3 override is written through the package.json file API.
project.package.addPackageResolutions('brace-expansion@^5.0.12');
project.package.file.addOverride('overrides.minimatch@3', { 'brace-expansion': '^1.1.21' });

const docgen = project.addTask('docgen', {
  description: 'Generate TypeScript API reference',
  exec: `typedoc ${project.srcdir}/constructs --disableSources --out ${project.docsDirectory}constructs/`,
});
docgen.exec(`typedoc ${project.srcdir}/projen --disableSources --out ${project.docsDirectory}projen/`);
docgen.exec(`typedoc ${project.srcdir}/lambda --disableSources --out ${project.docsDirectory}lambda/`);
project.postCompileTask.spawn(docgen);

project.synth();