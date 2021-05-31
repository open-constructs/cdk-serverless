import * as fs from 'fs';
import * as cognito from '@aws-cdk/aws-cognito';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as events from '@aws-cdk/aws-events';
import * as eventsTargets from '@aws-cdk/aws-events-targets';
import * as s3 from '@aws-cdk/aws-s3';
import * as cdk from '@aws-cdk/core';
import { LambdaFunction, LambdaOptions } from './func';

export interface ScheduledFunctionProps {
  /**
   * Name of the scheduler
   */
  name: string;

  /**
   * Deployment stage (e.g. dev)
   */
  stageName: string;

  /**
   * DynamoDB that is used as datastore
   * The Lambda function will have read access to this table automatically
   * The name of the table is available as process.env.TABLE
   */
  table?: dynamodb.ITable;

  /**
   * Activate write permissions to the DynamoDB table
   */
  tableWrites?: boolean;

  /**
   * Cognito user pool
   * The name of the pool is available as process.env.USER_POOL_ID
   */
  userPool?: cognito.IUserPool;

  /**
   * Bucket that is used for assets and published using the asset CDN
   * The name of the bucket is available as process.env.ASSET_BUCKET
   */
  assetBucket?: s3.Bucket;

  /**
   * Fully qualified domain name of the asset CDN
   * It is available as process.env.ASSET_DOMAIN_NAME
   */
  assetDomainName?: string;

  /**
   * Should the AWS-SDK be packaged with the Lambda code or excluded
   *
   * @default false (exclude SDK and use runtime provided one)
   */
  includeSDK?: boolean;

  /**
   * additional environment variables of the Lambda function
   */
  additionalEnv?: {
    [key: string]: string;
  };

  /**
   * additional options for the underlying Lambda function construct
   */
  lambdaOptions?: LambdaOptions;

  /**
   * The schedule to run the function
   */
  schedule: events.Schedule;
}

export class ScheduledFunction extends cdk.Construct {

  public readonly lambdaFunction: LambdaFunction;
  public readonly rule: events.Rule;

  constructor(scope: cdk.Construct, id: string, props: ScheduledFunctionProps) {
    super(scope, id);

    const entryFile = `./src/lambda/schedule.${props.name.toLowerCase().replace(/[^\w-]/g, '-')}.ts`;
    if (!fs.existsSync(entryFile)) {
      fs.writeFileSync(entryFile, `export async function handler(_event: AWSLambda.ScheduledEvent): Promise<void> {
  throw new Error('Not yet implemented');
});`, {
        encoding: 'utf-8',
      });
    }

    this.lambdaFunction = new LambdaFunction(this, 'Resource', {
      entry: entryFile,
      description: `Scheduler for ${props.name}`,
      ...props,
    });
    this.rule = new events.Rule(this, 'RuleNotifyHosts', {
      schedule: props.schedule,
      targets: [new eventsTargets.LambdaFunction(this.lambdaFunction)],
    });
  }
}