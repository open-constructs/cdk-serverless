import * as pj from 'projen';

export interface GraphQlApiAspectOptions {
  //
}

export class GraphQlApiAspect extends pj.Component {

  constructor(app: pj.AwsCdkTypeScriptApp, _options: GraphQlApiAspectOptions = {}) {
    super(app);

    app.addDevDeps(
      '@types/aws-lambda',
      '@graphql-codegen/cli',
      '@graphql-codegen/typescript',
      'graphql',
    );

    app.addCdkDependency(
      '@aws-cdk/core',
      '@aws-cdk/aws-lambda-nodejs',
      '@aws-cdk/aws-lambda',
      '@aws-cdk/aws-cloudwatch',
      '@aws-cdk/aws-dynamodb',
      '@aws-cdk/aws-cognito',
      '@aws-cdk/aws-route53',
      '@aws-cdk/aws-route53-targets',
      '@aws-cdk/aws-appsync',
      '@aws-cdk/aws-certificatemanager',
      '@aws-cdk/aws-cloudfront',
      '@aws-cdk/aws-s3',
      '@aws-cdk/aws-iam',
      '@aws-cdk/aws-kms',
    );

    app.addDeps('@taimos/lambda-toolbox@^0.0.72');

    const generateTask = app.addTask('generate:api', {
      exec: 'graphql-codegen',
      category: pj.tasks.TaskCategory.BUILD,
      description: 'Generate Types from GraphQL specification',
    });
    app.tasks.tryFind('build')?.prependSpawn(generateTask);

    const codegenConfig = {
      schema: 'schema.graphql',
      config: {
        scalars: {
          AWSDate: 'string',
          AWSURL: 'string',
        },
      },
      generates: {
        './src/lambda/types.generated.ts': {
          plugins: ['typescript'],
        },
      },
    };

    new pj.YamlFile(app, 'codegen.yml', {
      obj: codegenConfig,
    });
  }

}