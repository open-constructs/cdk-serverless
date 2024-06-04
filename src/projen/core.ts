import * as pj from 'projen';

export const PACKAGE_NAME = 'cdk-serverless';

export interface ServerlessProjectOptions extends pj.awscdk.AwsCdkTypeScriptAppOptions {
  // Additional options can be specified here
}

/**
 * The ServerlessProject construct sets up an AWS CDK TypeScript project with serverless application dependencies and configurations.
 * This construct extends the projen AwsCdkTypeScriptApp to include additional dependencies and development dependencies required
 * for serverless applications. It also enables TypeScript projen configuration (projenrcTs).
 *
 * @example
 * const project = new ServerlessProject({
 *   name: 'MyServerlessApp',
 *   defaultReleaseBranch: 'main',
 *   cdkVersion: '2.140.0',
 *   deps: ['additional-dependency'],
 *   devDeps: ['additional-dev-dependency'],
 * });
 */
export class ServerlessProject extends pj.awscdk.AwsCdkTypeScriptApp {

  /**
   * Creates an instance of ServerlessProject.
   *
   * @param {ServerlessProjectOptions} options - The options for configuring the ServerlessProject.
   */
  constructor(options: ServerlessProjectOptions) {
    super({
      ...options,
      projenrcTs: true,
      deps: [
        ...options.deps ?? [],
        'uuid',
        'esbuild',
        'js-yaml',
        `@aws-cdk/aws-cognito-identitypool-alpha@${options.cdkVersion}-alpha.0`,
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
