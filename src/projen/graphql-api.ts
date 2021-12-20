import * as pj from 'projen';
import { CoreAspect, CoreAspectOptions } from './core';

export interface GraphQlApiAspectOptions extends CoreAspectOptions {
  //
}

export class GraphQlApiAspect extends CoreAspect {

  constructor(app: pj.awscdk.AwsCdkTypeScriptApp, options: GraphQlApiAspectOptions = {}) {
    super(app, options);

    app.addDevDeps(
      '@graphql-codegen/cli',
      '@graphql-codegen/typescript',
      'graphql',
    );

    const generateTask = app.addTask('generate:api', {
      exec: 'graphql-codegen',
      description: 'Generate Types from the GraphQL specification',
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