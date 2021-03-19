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
    );

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