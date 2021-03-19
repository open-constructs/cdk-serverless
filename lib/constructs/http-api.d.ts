import * as apiGW from '@aws-cdk/aws-apigatewayv2';
import * as lambda from '@aws-cdk/aws-lambda';
import * as cdk from '@aws-cdk/core';
import { OpenAPI3 } from 'openapi-typescript';
import { AssetCdn, AssetCdnProps } from './asset-cdn';
import { Authentication, AuthenticationProps } from './auth';
import { LambdaFunction } from './func';
import { Monitoring } from './monitoring';
import { SingleTableDatastore, SingleTableDatastoreProps } from './table';
export interface HttpApiProps {
    apiName: string;
    stageName: string;
    domainName: string;
    /**
     * Hostname of the API
     *
     * @default api
     */
    apiHostname?: string;
    autoGenerateRoutes?: boolean;
    monitoring?: boolean;
    singleTableDatastore?: SingleTableDatastoreProps;
    authentication?: AuthenticationProps;
    assetCdn?: AssetCdnProps;
    additionalEnv?: {
        [key: string]: string;
    };
}
export declare class HttpApi<PATHS, OPS> extends cdk.Construct {
    private props;
    readonly api: apiGW.HttpApi;
    readonly apiSpec: OpenAPI3;
    readonly singleTableDatastore?: SingleTableDatastore;
    readonly authentication?: Authentication;
    readonly assetCdn?: AssetCdn;
    readonly monitoring?: Monitoring;
    private _functions;
    constructor(scope: cdk.Construct, id: string, props: HttpApiProps);
    /**
     * getFunctionForOperation
     */
    getFunctionForOperation(operationId: keyof OPS): LambdaFunction;
    addRoute<P extends keyof PATHS>(path: P, method: keyof PATHS[P], handler: lambda.Function): void;
    addRestResource<P extends keyof PATHS>(path: P, method: keyof PATHS[P]): LambdaFunction;
    private createEntryFile;
    private tableWriteAccessForMethod;
    private methodTransform;
}
