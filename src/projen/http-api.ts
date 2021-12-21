import * as pj from 'projen';
import { CoreAspect, CoreAspectOptions } from './core';

export interface HttpApiAspectOptions extends CoreAspectOptions {
  //
}

export class HttpApiAspect extends CoreAspect {

  constructor(app: pj.awscdk.AwsCdkTypeScriptApp, options: HttpApiAspectOptions = {}) {
    super(app, options);

    const generateTask = app.addTask('generate:api', {
      exec: 'openapi-typescript openapi.yaml --output src/lambda/types.generated.ts',
      description: 'Generate Types from the OpenAPI specification',
    });
    app.preCompileTask.prependSpawn(generateTask);

    new pj.SampleFile(app, 'openapi.yaml', {
      contents: '# add your OpenAPI Specification in this file',
    });
  }

}