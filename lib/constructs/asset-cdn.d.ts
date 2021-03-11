import * as route53 from '@aws-cdk/aws-route53';
import * as s3 from '@aws-cdk/aws-s3';
import * as cdk from '@aws-cdk/core';
export interface AssetCdnProps {
    domainName: string;
    hostName: string;
}
export declare class AssetCdn extends cdk.Construct {
    readonly zone: route53.IHostedZone;
    readonly assetBucket: s3.Bucket;
    readonly assetDomainName: string;
    constructor(scope: cdk.Construct, id: string, props: AssetCdnProps);
}
