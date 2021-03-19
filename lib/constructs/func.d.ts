import * as cognito from '@aws-cdk/aws-cognito';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as s3 from '@aws-cdk/aws-s3';
import * as cdk from '@aws-cdk/core';
import { WatchableNodejsFunction } from 'cdk-watch';
export interface LambdaFunctionProps {
    /**
     * Deployment stage (e.g. dev)
     */
    stageName: string;
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
     * It is available as process.env.ASSET_DOAMIN_NAME
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
}
export declare class LambdaFunction extends WatchableNodejsFunction {
    private props;
    constructor(scope: cdk.Construct, id: string, props: LambdaFunctionProps);
    grantSendEmails(): LambdaFunction;
    grantUploadAssets(): LambdaFunction;
    grantDeleteAsset(): LambdaFunction;
    grantUserpoolRead(): LambdaFunction;
    grantUserpoolReadWrite(): LambdaFunction;
}
