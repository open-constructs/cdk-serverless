import * as cognito from '@aws-cdk/aws-cognito';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as s3 from '@aws-cdk/aws-s3';
import * as cdk from '@aws-cdk/core';
import { WatchableNodejsFunction } from 'cdk-watch';
export interface LambdaFunctionProps {
    stageName: string;
    file: string;
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
export declare class LambdaFunction extends WatchableNodejsFunction {
    private props;
    constructor(scope: cdk.Construct, id: string, props: LambdaFunctionProps);
    grantSendEmails(): LambdaFunction;
    grantUploadAssets(): LambdaFunction;
    grantDeleteAsset(): LambdaFunction;
    grantUserpoolRead(): LambdaFunction;
    grantUserpoolReadWrite(): LambdaFunction;
}
