import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { OpenAPI3, OperationObject, PathItemObject } from 'openapi-typescript';
import * as pj from 'projen';
import { PACKAGE_NAME } from './core';

export interface RestApiOptions {
  readonly apiName: string;
  readonly definitionFile: string;
}

export class RestApi extends pj.Component {

  protected readonly definitionFile: string;
  protected readonly apiName: string;

  constructor(app: pj.awscdk.AwsCdkTypeScriptApp, protected options: RestApiOptions) {
    super(app);

    this.definitionFile = options.definitionFile;
    this.apiName = options.apiName;

    app.addDevDeps(
      '@types/aws-lambda',
      '@types/lambda-log',
    );
    app.addDeps(
      'esbuild',
      'js-yaml',
      'openapi-typescript',
    );

    const generateTask = app.addTask(`generate:api:${options.apiName.toLowerCase()}`, {
      exec: `openapi-typescript ${options.definitionFile} --output src/generated/rest.${options.apiName.toLowerCase()}-model.generated.ts`,
      description: 'Generate Types from the OpenAPI specification',
    });
    app.defaultTask!.spawn(generateTask);
  }

  protected createConstructFile(fileName: string) {

    fs.writeFileSync(fileName, `/* eslint-disable */
import { Construct } from 'constructs';
import { RestApi, RestApiProps } from '${PACKAGE_NAME}/lib/constructs';
import { operations, paths } from './rest.${this.options.apiName.toLowerCase()}-model.generated';

export interface ${this.options.apiName}RestApiProps extends Omit<RestApiProps<operations>, 'definitionFileName' | 'apiName'> {
  //
}

export class ${this.options.apiName}RestApi extends RestApi<paths, operations> {

  constructor(scope: Construct, id: string, props: ${this.options.apiName}RestApiProps) {
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

  protected addRestResource(apiSpec: OpenAPI3, path: string, method: string) {
    const oaPath = apiSpec.paths![path];
    const operation = oaPath[method as keyof PathItemObject] as OperationObject;
    const operationId = operation.operationId!;
    // const description = `${method as string} ${path as string} - ${operation.summary}`;

    const entryFile = `${this.project.outdir}/src/lambda/rest.${this.options.apiName.toLowerCase()}.${operationId}.ts`;
    if (!fs.existsSync(entryFile)) {
      if (!fs.existsSync(`${this.project.outdir}/src/lambda`)) {
        fs.mkdirSync(`${this.project.outdir}/src/lambda`);
      }
      this.createEntryFile(entryFile, method, operationId);
    }
  }

  protected createEntryFile(entryFile: string, method: string, operationId: string) {
    let factoryCall;
    let logs;
    switch (method.toLowerCase()) {
      case 'post':
      case 'put':
      case 'patch':
        factoryCall = `api.createOpenApiHandlerWithRequestBody<operations['${operationId}']>(async (ctx, data) => {`;
        logs = 'ctx.logger.info(JSON.stringify(data));';
        break;
      case 'options':
      case 'delete':
      case 'get':
      case 'head':
      default:
        factoryCall = `api.createOpenApiHandler<operations['${operationId}']>(async (ctx) => {`;
        logs = '';
        break;
    }

    fs.writeFileSync(entryFile, `import { api, errors } from '${PACKAGE_NAME}/lib/lambda';
import { operations } from '../generated/rest.${this.options.apiName.toLowerCase()}-model.generated';

export const handler = ${factoryCall}
  ctx.logger.info(JSON.stringify(ctx.event));
  ${logs}
  throw new errors.HttpError(500, 'Not yet implemented');
});`, {
      encoding: 'utf-8',
    });
  }

  public synthesize() {
    super.synthesize();
    if (!fs.existsSync(this.definitionFile)) {
      fs.writeFileSync(this.definitionFile, yaml.dump({
        openapi: '3.0.1',
        paths: {
          '/hello': {
            get: {
              operationId: 'helloWorld',
              responses: {
                200: {
                  content: {
                    'application/json': {
                      schema: {
                        type: 'string',
                      },
                    },
                  },
                },
              },
            },
          },
        },
        info: {
          title: `${this.apiName} API definition`,
          version: '1.0',
        },
      }));
    }
    const apiSpec = yaml.load(fs.readFileSync(this.definitionFile).toString()) as OpenAPI3;
    for (const path in apiSpec.paths) {
      if (Object.prototype.hasOwnProperty.call(apiSpec.paths, path)) {
        const pathItem = apiSpec.paths[path];
        for (const method in pathItem) {
          if (Object.prototype.hasOwnProperty.call(pathItem, method) &&
            ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].indexOf(method) >= 0) {
            // Add all operations
            this.addRestResource(apiSpec, path, method);
          }
        }
      }
    }
    if (!fs.existsSync(`${this.project.outdir}/src/generated`)) {
      fs.mkdirSync(`${this.project.outdir}/src/generated`);
    }
    this.createConstructFile(`${this.project.outdir}/src/generated/rest.${this.apiName.toLowerCase()}-api.generated.ts`);
  }

}