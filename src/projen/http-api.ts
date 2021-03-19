import * as pj from 'projen';

export interface HttpApiAspectOptions {
  //
}

export class HttpApiAspect extends pj.Component {

  constructor(app: pj.AwsCdkTypeScriptApp, _options: HttpApiAspectOptions = {}) {
    super(app);

    app.cdkConfig.context = {
      ...app.cdkConfig.context,
      'aws-cdk:enableDiffNoFail': 'true',
      '@aws-cdk/core:enableStackNameDuplicates': 'true',
      '@aws-cdk/core:newStyleStackSynthesis': 'true',
      '@aws-cdk/core:stackRelativeExports': 'true',
      '@aws-cdk/aws-ecr-assets:dockerIgnoreSupport': 'true',
      '@aws-cdk/aws-secretsmanager:parseOwnedSecretName': 'true',
      '@aws-cdk/aws-kms:defaultKeyPolicies': 'true',
    };

    const generateTask = app.addTask('generate:api', {
      exec: 'openapi-typescript openapi.yaml --output src/lambda/types.generated.ts',
      category: pj.tasks.TaskCategory.BUILD,
      description: 'Generate Types from OpenAPI specification',
    });
    app.tasks.tryFind('build')?.prependSpawn(generateTask);

    app.addDevDeps('@types/aws-lambda');

    new pj.SampleFile(app, 'openapi.yaml', {
      contents: '',
    });
  }

}