import * as fs from 'fs';
import { join } from 'path';
import * as yaml from 'js-yaml';
import { OpenAPI3, OperationObject, PathItemObject } from 'openapi-typescript';
import * as pj from 'projen';
import { PACKAGE_NAME } from './core';
import { LazySampleDir } from './lazy-sampledir';

export interface RestApiOptions {
  readonly apiName: string;
  readonly definitionFile: string;
}

export class RestApi extends pj.Component {

  constructor(app: pj.awscdk.AwsCdkTypeScriptApp, protected options: RestApiOptions) {
    super(app);

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

    new pj.SampleFile(this.project, options.definitionFile, {
      contents: yaml.dump({
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
          title: `${this.options.apiName} API definition`,
          version: '1.0',
        },
      }),
    });

    new LazySampleDir(this.project, 'src/lambda', {
      fileGenerator: this.generateSampleHandlerFiles.bind(this),
    });

    const apiFile = new pj.TextFile(this.project, `src/generated/rest.${this.options.apiName.toLowerCase()}-api.generated.ts`);
    apiFile.addLine(this.createConstructFile(apiFile));

  }

  protected createConstructFile(file: pj.FileBase): string {
    return `// ${file.marker}
/* eslint-disable */
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

}`;
  }

  protected validatePathRef(apiSpec: OpenAPI3, path: string, visited: string[] = []): boolean {
    if (!path.startsWith('#')) {
      throw new Error(`Unable to resolve ref '${path}' - Resolving references to paths from different files is currently not supported`);
    }

    const pathPrettySplit =
      path
        .split('/')
        .slice(1)
        .map(pathPart =>
          pathPart
            .replace('~1', '/')
            .replace('~0', '~'),
        );

    if (visited.includes(pathPrettySplit[1])) {
      throw new Error(`Cyclical reference exists between paths: ${visited.join(', ')}`);
    }


    const maybePath = pathPrettySplit.reduce((acc, pathPart) => {
      if (Object.keys(acc).includes(pathPart)) {
        return acc[pathPart];
      }
      return undefined;
    }, apiSpec as any);
    if (maybePath) {
      if (Object.prototype.hasOwnProperty.call(maybePath, '$ref')) {
        return this.validatePathRef(apiSpec, maybePath.$ref, [...visited, pathPrettySplit[1]]);
      }
      // Closest thing to making sure the ref actually is a path object
      return ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].some(method => Object.keys(maybePath).indexOf(method) >= 0);
    }
    return false;
  }

  protected addRestResourceHandlerSample(files: { [fileName: string]: () => string }, apiSpec: OpenAPI3, path: string, method: string) {
    const oaPath = apiSpec.paths![path] as PathItemObject;
    const operation = oaPath[method as keyof PathItemObject] as OperationObject;
    const operationId = operation.operationId!;
    // const description = `${method as string} ${path as string} - ${operation.summary}`;

    const entryFile = `rest.${this.options.apiName.toLowerCase()}.${operationId}.ts`;
    files[entryFile] = () => {
      return this.createEntryFile(method, operationId);
    };
  }

  protected createEntryFile(method: string, operationId: string): string {
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

    return `import { api, errors } from '${PACKAGE_NAME}/lib/lambda';
import { operations } from '../generated/rest.${this.options.apiName.toLowerCase()}-model.generated';

export const handler = ${factoryCall}
  ctx.logger.info(JSON.stringify(ctx.event));
  ${logs}
  throw new errors.HttpError(500, 'Not yet implemented');
});`;
  }

  private generateSampleHandlerFiles(): { [fileName: string]: (() => string) } {
    const files = {};
    const apiSpec = yaml.load(fs.readFileSync(join(this.project.outdir, this.options.definitionFile)).toString()) as OpenAPI3;
    for (const path in apiSpec.paths) {
      if (Object.prototype.hasOwnProperty.call(apiSpec.paths, path)) {
        const pathItem = apiSpec.paths[path];
        if (('$ref' in pathItem)) {
          if (!this.validatePathRef(apiSpec, pathItem.$ref)) {
            throw new Error(`Path '${path}' references '${pathItem.$ref}', which does not exist in this API specification`);
          }
        }
        for (const method in pathItem) {
          if (Object.prototype.hasOwnProperty.call(pathItem, method) &&
            ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].indexOf(method) >= 0) {
            // Add all operations
            this.addRestResourceHandlerSample(files, apiSpec, path, method);
          }
        }
      }
    }
    return files;
  }

}