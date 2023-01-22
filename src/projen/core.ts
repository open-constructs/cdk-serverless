import * as pj from 'projen';

export interface ServerlessProjectOptions extends pj.awscdk.AwsCdkTypeScriptAppOptions {
  //
}

export class ServerlessProject extends pj.awscdk.AwsCdkTypeScriptApp {

  constructor(options: ServerlessProjectOptions) {
    super({
      ...options,
      projenrcTs: true,
      deps: [
        ...options.deps ?? [],
        '@taimos/lambda-toolbox',
        'uuid',
        'esbuild',
        'js-yaml',
        'openapi-typescript',
      ],
      devDeps: [
        ...options.devDeps ?? [],
        '@types/aws-lambda',
        '@types/uuid',
        '@types/lambda-log',
        '@types/js-yaml',
      ],
    });

  }

}