import {
  aws_dynamodb as dynamodb,
  aws_s3 as s3,
  aws_iam as iam,
  aws_cognito as cognito,
  aws_lambda as lambda,
  aws_lambda_nodejs as lambdaNodejs,
} from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export type LambdaOptions = Omit<lambdaNodejs.NodejsFunctionProps, 'entry' | 'handler' | 'description'>

export interface LambdaTracingOptions {
  /**
   * Activate tracing with X-Ray
   *
   * @default lambda.Tracing.DISABLED
   */
  xRayTracing?: lambda.Tracing;
}

export interface LambdaFunctionProps {
  /**
   * Deployment stage (e.g. dev)
   */
  stageName?: string;

  /**
   * entry file name
   */
  entry: string;

  /**
   * name of the exported handler function
   *
   * @default handler
   */
  handler?: string;

  /**
   * description of the Lambda function
   */
  description?: string;

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
   * Tracing config
   */
  lambdaTracing?: LambdaTracingOptions;
}

export class LambdaFunction extends lambdaNodejs.NodejsFunction {

  constructor(scope: Construct, id: string, private props: LambdaFunctionProps) {
    super(scope, id, {
      ...props.lambdaOptions,
      entry: props.entry,
      bundling: {
        ...props.lambdaOptions?.bundling,
        externalModules: props.includeSDK ? [] : undefined,
        loader: {
          ...props.lambdaOptions?.bundling?.loader,
          '.yaml': 'text',
        },
      },
      environment: {
        ...props.lambdaOptions?.environment,
        ...props.stageName && {
          STAGE: props.stageName,
        },
        ...props.table && {
          TABLE: props.table.tableName,
        },
        ...props.userPool && {
          USER_POOL_ID: props.userPool.userPoolId,
        },
        ...props.assetBucket && {
          ASSET_BUCKET: props.assetBucket.bucketName,
        },
        ...props.assetDomainName && {
          ASSET_DOMAIN_NAME: props.assetDomainName,
        },
        ...props.additionalEnv,
      },
      handler: props.handler ?? 'handler',
      description: props.description,
      tracing: props.lambdaTracing?.xRayTracing,
    });

    if (props.table) {
      if (props.tableWrites ?? true) {
        props.table.grantReadWriteData(this);
      } else {
        props.table.grantReadData(this);
      }
    }
  }

  public setTable(table: dynamodb.ITable, tableWrites?: boolean): LambdaFunction {
    this.props.table = table;
    this.props.tableWrites = tableWrites;

    this.addEnvironment('TABLE', table.tableName);
    if (tableWrites ?? true) {
      table.grantReadWriteData(this);
    } else {
      table.grantReadData(this);
    }

    return this;
  }

  public setUserPool(userPool: cognito.IUserPool): LambdaFunction {
    this.props.userPool = userPool;
    this.addEnvironment('USER_POOL_ID', userPool.userPoolId);
    return this;
  }

  public grantTableWrite(): LambdaFunction {
    if (!this.props.table) {
      throw new Error('No table configured');
    }
    this.props.table.grantReadWriteData(this);
    return this;
  }

  public grantSendEmails(): LambdaFunction {
    this.grantPrincipal.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: [
        'ses:SendEmail',
        'ses:SendTemplatedEmail',
        'ses:SendBulkTemplatedEmail',
      ],
      resources: ['*'],
    }));
    return this;
  }

  public grantUploadAssets(): LambdaFunction {
    if (!this.props.assetBucket) {
      throw new Error('No asset bucket configured');
    }
    this.props.assetBucket.grantPut(this);
    return this;
  }

  public grantDeleteAsset(): LambdaFunction {
    if (!this.props.assetBucket) {
      throw new Error('No asset bucket configured');
    }
    this.props.assetBucket.grantDelete(this);
    return this;
  }

  public grantUserpoolRead(): LambdaFunction {
    if (!this.props.userPool) {
      throw new Error('No user pool configured');
    }
    this.grantPrincipal.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: [
        'cognito-idp:ListUsers',
        'cognito-idp:AdminGetUser',
        'cognito-idp:AdminListGroupsForUser',
      ],
      resources: [this.props.userPool.userPoolArn],
    }));
    return this;
  }

  public grantUserpoolReadWrite(): LambdaFunction {
    if (!this.props.userPool) {
      throw new Error('No user pool configured');
    }
    this.grantUserpoolRead();
    this.grantPrincipal.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: [
        'cognito-idp:AdminUpdateUserAttributes',
        'cognito-idp:AdminAddUserToGroup',
        'cognito-idp:AdminRemoveUserFromGroup',
        'cognito-idp:AdminCreateUser',
        'cognito-idp:AdminDeleteUser',
      ],
      resources: [this.props.userPool.userPoolArn],
    }));
    return this;
  }

  public setTimeout(timeout: cdk.Duration): LambdaFunction {
    (this.node.defaultChild as lambda.CfnFunction).addPropertyOverride('Timeout', timeout.toSeconds());
    return this;
  }

}