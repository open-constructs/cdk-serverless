import * as fs from 'fs';
import * as pj from 'projen';
import { PACKAGE_NAME } from './core';

export interface GraphQlApiOptions {
  readonly apiName: string;
  readonly definitionFile: string;
}

export class GraphQlApi extends pj.Component {

  protected readonly codegenConfigFileName: string;

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

    this.codegenConfigFileName = `graphql-codegen.${options.apiName.toLowerCase()}.yml`;
    const generateTask = app.addTask(`generate:api:${options.apiName.toLowerCase()}`, {
      exec: `graphql-codegen -c ${this.codegenConfigFileName}`,
      description: 'Generate Types from the GraphQL specification',
    });
    app.preCompileTask.prependSpawn(generateTask);
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

  public synthesize() {
    super.synthesize();

    if (!fs.existsSync(this.options.definitionFile)) {
      fs.writeFileSync(this.options.definitionFile, `type Query {
   users: [User]
}

type User {
   id: ID!
   name: String
}`);
    }

    const codegenConfig = {
      schema: this.options.definitionFile,
      config: {
        scalars: {
          AWSDate: 'string',
          AWSURL: 'string',
        },
      },
      generates: {
        [`./src/generated/graphql.${this.options.apiName.toLowerCase()}-model.generated.ts`]: {
          plugins: ['typescript', 'typescript-resolvers'],
        },
      },
    };

    new pj.YamlFile(this.project, this.codegenConfigFileName, {
      obj: codegenConfig,
    });

    if (!fs.existsSync(`${this.project.outdir}/src/generated`)) {
      fs.mkdirSync(`${this.project.outdir}/src/generated`);
    }
    this.createConstructFile(`${this.project.outdir}/src/generated/graphql.${this.options.apiName.toLowerCase()}-api.generated.ts`);
  }

}
