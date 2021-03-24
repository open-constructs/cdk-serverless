import * as pj from 'projen';

export interface CoreAspectOptions {
  cdkWatch?: {
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
      '@aws-cdk/aws-s3',
      '@aws-cdk/aws-iam',
      '@aws-cdk/aws-kms',
    );

    app.addDevDeps('@types/aws-lambda', '@types/uuid');
    app.addDeps('@taimos/lambda-toolbox@^0.0.72', 'uuid');

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
            description: 'Run cdk-watch for the given selection',
            exec: `npx cdkw '${glob}' --no-logs`,
          });
        }
      }
    }
  }

}