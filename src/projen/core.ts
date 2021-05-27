import * as pj from 'projen';

export interface CoreAspectOptions {
  /**
   * Configure yarn scripts to run CDK-Watch.
   * The key is the name of the script and the value is the glob pattern of cdk-watch
   *
   * Created scripts will be live:{key} and live:{key}:nologs
   *
   * @default no live scripts
   */
  cdkWatch?: {
    [script: string]: string;
  };

  /**
   * Configure yarn scripts to run 'cdk diff' and 'cdk deploy'.
   * The key is the name of the script and the value is the glob pattern of cdk deploy
   *
   * Created scripts will be diff:{key} and deploy:{key}
   *
   * @default no deploy scripts
   */
  deployScripts?: {
    [script: string]: string;
  };
}

export class CoreAspect extends pj.Component {

  constructor(app: pj.AwsCdkTypeScriptApp, options: CoreAspectOptions = {}) {
    super(app);

    app.cdkConfig.context = {
      ...app.cdkConfig.context,
      'aws-cdk:enableDiffNoFail': 'true',
      '@aws-cdk/core:enableStackNameDuplicates': 'true',
      '@aws-cdk/core:newStyleStackSynthesis': 'true',
      '@aws-cdk/core:stackRelativeExports': 'true',
      '@aws-cdk/aws-ecr-assets:dockerIgnoreSupport': 'true',
      '@aws-cdk/aws-secretsmanager:parseOwnedSecretName': 'true',
      '@aws-cdk/aws-kms:defaultKeyPolicies': 'true',
    };

    app.addCdkDependency(
      '@aws-cdk/core',
      '@aws-cdk/aws-apigatewayv2',
      '@aws-cdk/aws-apigatewayv2-integrations',
      '@aws-cdk/aws-lambda-nodejs',
      '@aws-cdk/aws-lambda',
      '@aws-cdk/aws-cloudwatch',
      '@aws-cdk/aws-dynamodb',
      '@aws-cdk/aws-cognito',
      '@aws-cdk/aws-route53',
      '@aws-cdk/aws-route53-targets',
      '@aws-cdk/aws-appsync',
      '@aws-cdk/aws-certificatemanager',
      '@aws-cdk/aws-cloudfront',
      '@aws-cdk/aws-cloudfront-origins',
      '@aws-cdk/aws-s3',
      '@aws-cdk/aws-iam',
      '@aws-cdk/aws-kms',
      '@aws-cdk/pipelines',
      '@aws-cdk/aws-codepipeline',
      '@aws-cdk/aws-codepipeline-actions',
      '@aws-cdk/aws-codebuild',
    );

    app.addDevDeps('@types/aws-lambda', '@types/uuid', '@types/lambda-log');
    app.addDeps('@taimos/lambda-toolbox', 'uuid');

    app.tasks.tryFind('synth')?.prependExec('rm -rf cdk.out/');

    if (options.cdkWatch) {
      for (const key in options.cdkWatch) {
        if (Object.prototype.hasOwnProperty.call(options.cdkWatch, key)) {
          const glob = options.cdkWatch[key];
          app.addTask(`live:${key}`, {
            category: pj.tasks.TaskCategory.RELEASE,
            description: 'Run cdk-watch for the given selection',
            exec: `npx cdkw '${glob}'`,
          });
          app.addTask(`live:${key}:nologs`, {
            category: pj.tasks.TaskCategory.RELEASE,
            description: 'Run cdk-watch for the given selection without logs',
            exec: `npx cdkw '${glob}' --no-logs`,
          });
        }
      }
    }

    if (options.deployScripts) {
      for (const key in options.deployScripts) {
        if (Object.prototype.hasOwnProperty.call(options.deployScripts, key)) {
          const glob = options.deployScripts[key];
          app.addTask(`diff:${key}`, {
            category: pj.tasks.TaskCategory.RELEASE,
            description: 'Run cdk diff for the given selection',
            exec: `npx cdk diff '${glob}'`,
          });
          app.addTask(`deploy:${key}`, {
            category: pj.tasks.TaskCategory.RELEASE,
            description: 'Run cdk deploy for the given selection',
            exec: `npx cdk deploy '${glob}'`,
          });
        }
      }
    }
  }

}