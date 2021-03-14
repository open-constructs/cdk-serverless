import * as cognito from '@aws-cdk/aws-cognito';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as iam from '@aws-cdk/aws-iam';
import * as s3 from '@aws-cdk/aws-s3';
import * as cdk from '@aws-cdk/core';
import { WatchableNodejsFunction } from 'cdk-watch';

export interface LambdaFunctionProps {
  stageName: string;
  entry: string;
  handler?: string;
  description?: string;
  table?: dynamodb.ITable;
  tableWrites?: boolean;
  userPool?: cognito.IUserPool;
  assetBucket?: s3.Bucket;
  assetDomainName?: string;
  includeSDK?: boolean;
  additionalEnv?: {
    [key: string]: string;
  };
}

export class LambdaFunction extends WatchableNodejsFunction {

  constructor(scope: cdk.Construct, id: string, private props: LambdaFunctionProps) {
    super(scope, id, {
      entry: props.entry,
      bundling: {
        externalModules: props.includeSDK ? [] : undefined,
        loader: {
          '.yaml': 'text',
        },
      },
      environment: {
        STAGE: props.stageName,
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
      timeout: cdk.Duration.seconds(5),
      // logRetention: 3,
      description: props.description,
    });

    if (props.table) {
      if (props.tableWrites ?? true) {
        props.table.grantReadWriteData(this);
      } else {
        props.table.grantReadData(this);
      }
    }
  }

  public grantSendEmails(): LambdaFunction {
    this.grantPrincipal.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: [
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
}