import * as pj from 'projen';

export interface CoreAspectOptions {
  /**
   * Configure yarn scripts to run 'cdk diff' and 'cdk deploy'.
   * The key is the name of the script and the value is the glob pattern of cdk deploy
   *
   * Created scripts will be `diff:{key}`, `deploy:{key}`, and `deploy:{key} --watch`
   *
   * @default no deploy scripts
   */
  deployScripts?: {
    [script: string]: string;
  };
}

export class CoreAspect extends pj.Component {

  constructor(app: pj.awscdk.AwsCdkTypeScriptApp, options: CoreAspectOptions = {}) {
    super(app);

    app.addCdkDependency(
      '@aws-cdk/aws-apigatewayv2',
      '@aws-cdk/aws-apigatewayv2-integrations',
      '@aws-cdk/aws-appsync',
    );

    app.addDevDeps('@types/aws-lambda', '@types/uuid', '@types/lambda-log');
    app.addDeps('@taimos/lambda-toolbox', 'uuid');

    app.tasks.tryFind('synth')?.prependExec('rm -rf cdk.out/');

    if (options.deployScripts) {
      for (const key in options.deployScripts) {
        if (Object.prototype.hasOwnProperty.call(options.deployScripts, key)) {
          const glob = options.deployScripts[key];
          app.addTask(`diff:${key}`, {
            description: 'Run cdk diff for the given selection',
            exec: `npx cdk diff '${glob}'`,
          });
          app.addTask(`deploy:${key}`, {
            description: 'Run cdk deploy for the given selection',
            exec: `npx cdk deploy '${glob}'`,
          });
          app.addTask(`watch:${key}`, {
            description: 'Run cdk deploy for the given selection in watch mode',
            exec: `npx cdk deploy '${glob}' --watch`,
          });
        }
      }
    }
  }

}