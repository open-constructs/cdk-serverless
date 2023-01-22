import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { OpenAPI3, OperationObject, PathItemObject } from 'openapi-typescript';
import * as pj from 'projen';

export interface RestApiOptions {
  readonly apiName: string;
  readonly definitionFile: string;
}

export class RestApi extends pj.Component {

  constructor(app: pj.awscdk.AwsCdkTypeScriptApp, protected options: RestApiOptions) {
    super(app);

    const generateTask = app.addTask(`generate:api:${options.apiName.toLowerCase()}`, {
      exec: `openapi-typescript ${options.definitionFile} --output src/generated/rest.${options.apiName.toLowerCase()}-model.generated.ts`,
      description: 'Generate Types from the OpenAPI specification',
    });
    app.defaultTask!.spawn(generateTask);

    const apiSpec = yaml.load(fs.readFileSync(options.definitionFile).toString()) as OpenAPI3;
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
    this.createConstructFile(`./src/generated/rest.${options.apiName.toLowerCase()}-api.generated.ts`);
  }

  protected createConstructFile(fileName: string) {

    fs.writeFileSync(fileName, `import { Construct } from 'constructs';
import { RestApi, RestApiProps } from '../sls/constructs';
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

    const entryFile = `./src/lambda/rest.${this.options.apiName.toLowerCase()}.${operationId}.ts`;
    if (!fs.existsSync(entryFile)) {
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
        factoryCall = `http.createOpenApiHandlerWithRequestBody<operations['${operationId}']>(async (ctx, data) => {`;
        logs = 'ctx.logger.info(JSON.stringify(data));';
        break;
      case 'options':
      case 'delete':
      case 'get':
      case 'head':
      default:
        factoryCall = `http.createOpenApiHandler<operations['${operationId}']>(async (ctx) => {`;
        logs = '';
        break;
    }

    fs.writeFileSync(entryFile, `import { http, errors } from '@taimos/lambda-toolbox';
import { operations } from '../generated/rest.${this.options.apiName.toLowerCase()}-model.generated';

export const handler = ${factoryCall}
  ctx.logger.info(JSON.stringify(ctx.event));
  ${logs}
  throw new errors.HttpError(500, 'Not yet implemented');
});`, {
      encoding: 'utf-8',
    });
  }

}