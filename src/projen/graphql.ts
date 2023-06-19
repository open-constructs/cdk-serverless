import * as fs from 'fs';
import * as pj from 'projen';
import { PACKAGE_NAME } from './core';

export interface GraphQlApiOptions {
  readonly apiName: string;
  readonly definitionFile: string;
}

export class GraphQlApi extends pj.Component {

  constructor(app: pj.awscdk.AwsCdkTypeScriptApp, protected options: GraphQlApiOptions) {
    super(app);

    app.addDevDeps(
      '@graphql-codegen/cli',
      '@graphql-codegen/typescript',
      '@graphql-codegen/typescript-resolvers',
      '@types/aws-lambda',
      '@types/lambda-log',
    );
    app.addDeps(
      'graphql',
      '@aws-appsync/utils',
      'esbuild',
      '@aws-cdk/aws-cognito-identitypool-alpha',
    );

    const codegenConfigFileName = `graphql-codegen.${options.apiName.toLowerCase()}.yml`;
    const generateTask = app.addTask(`generate:api:${options.apiName.toLowerCase()}`, {
      exec: `graphql-codegen -c ${codegenConfigFileName}`,
      description: 'Generate Types from the GraphQL specification',
    });
    app.preCompileTask.prependSpawn(generateTask);

    const codegenConfig = {
      schema: options.definitionFile,
      config: {
        scalars: {
          AWSDate: 'string',
          AWSURL: 'string',
        },
      },
      generates: {
        [`./src/generated/graphql.${options.apiName.toLowerCase()}-model.generated.ts`]: {
          plugins: ['typescript', 'typescript-resolvers'],
        },
      },
    };

    new pj.YamlFile(app, codegenConfigFileName, {
      obj: codegenConfig,
    });

    if (!fs.existsSync('./src/generated')) {
      fs.mkdirSync('./src/generated');
    }
    this.createConstructFile(`./src/generated/graphql.${options.apiName.toLowerCase()}-api.generated.ts`);
  }

  protected createConstructFile(fileName: string) {

    fs.writeFileSync(fileName, `/* eslint-disable */
import { Construct } from 'constructs';
import { GraphQlApi, GraphQlApiProps } from '${PACKAGE_NAME}/lib/constructs';
import { Resolvers } from './graphql.${this.options.apiName.toLowerCase()}-model.generated';

export interface ${this.options.apiName}GraphQlApiProps extends Omit<GraphQlApiProps, 'definitionFileName' | 'apiName'> {
  //
}

export class ${this.options.apiName}GraphQlApi extends GraphQlApi<Resolvers> {

  constructor(scope: Construct, id: string, props: ${this.options.apiName}GraphQlApiProps) {
    super(scope, id, {
      ...props,
      apiName: '${this.options.apiName}',
      definitionFileName: '${this.options.definitionFile}',
    });
  }

}`, {
      encoding: 'utf-8',
    });
  }

}
