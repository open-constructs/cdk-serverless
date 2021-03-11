import * as appsync from '@aws-cdk/aws-appsync';
import * as lambdaNodejs from '@aws-cdk/aws-lambda-nodejs';
import * as cdk from '@aws-cdk/core';
import { AssetCdn, AssetCdnProps } from './asset-cdn';
import { Authentication, AuthenticationProps } from './auth';
import { LambdaFunction } from './func';
import { Monitoring } from './monitoring';
import { SingleTableDatastore, SingleTableDatastoreProps } from './table';
export interface GraphApiProps {
    apiName: string;
    stageName: string;
    monitoring?: boolean;
    singleTableDatastore?: SingleTableDatastoreProps;
    authentication?: AuthenticationProps;
    assetCdn?: AssetCdnProps;
    additionalEnv?: {
        [key: string]: string;
    };
}
export declare class GraphApi extends cdk.Construct {
    private props;
    readonly api: appsync.GraphqlApi;
    readonly integrationStack: cdk.Stack;
    readonly singleTableDatastore?: SingleTableDatastore;
    readonly authentication?: Authentication;
    readonly assetCdn?: AssetCdn;
    readonly tableDataSource?: appsync.DynamoDbDataSource;
    readonly monitoring?: Monitoring;
    private _functions;
    constructor(scope: cdk.Construct, id: string, props: GraphApiProps);
    /**
     * getFunctionForOperation
     */
    getFunctionForOperation<TYPE extends {
        __typename?: any;
    }>(typeName: TYPE['__typename'], fieldName: keyof Omit<TYPE, '__typename'>): LambdaFunction;
    protected addLambdaResolver<TYPE extends {
        __typename?: any;
    }>(typeName: TYPE['__typename'], fieldName: keyof Omit<TYPE, '__typename'>): lambdaNodejs.NodejsFunction;
    protected addDynamoDbVtlResolver<TYPE extends {
        __typename?: any;
    }>(typeName: TYPE['__typename'], fieldName: keyof Omit<TYPE, '__typename'>): void;
}
