import * as cdk from '@aws-cdk/core';
import * as certificatemanager from '@aws-cdk/aws-certificatemanager';
import * as cloudfront from '@aws-cdk/aws-cloudfront';
import * as route53 from '@aws-cdk/aws-route53';
import * as route53Targets from '@aws-cdk/aws-route53-targets';
import * as s3 from '@aws-cdk/aws-s3';

export interface AssetCdnProps {
  domainName: string;
  hostName: string;
}

export class AssetCdn extends cdk.Construct {

  public readonly zone: route53.IHostedZone;
  public readonly assetBucket: s3.Bucket;
  public readonly assetDomainName: string;

  constructor(scope: cdk.Construct, id: string, props: AssetCdnProps) {
    super(scope, id);

    this.zone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: props.domainName,
    });

    this.assetBucket = new s3.Bucket(this, 'AssetBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });
    this.assetBucket.addCorsRule({
      allowedHeaders: ['*'],
      allowedMethods: [s3.HttpMethods.PUT],
      allowedOrigins: ['*'],
    });

    this.assetDomainName = `${props.hostName}.${props.domainName}`;

    const cert = new certificatemanager.DnsValidatedCertificate(this, 'Certificate', {
      hostedZone: this.zone,
      domainName: this.assetDomainName,
      region: 'us-east-1',
    });

    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI', { comment: `S3 Frontend ${this.assetDomainName}` });
    this.assetBucket.grantRead(originAccessIdentity);

    const distribution = new cloudfront.CloudFrontWebDistribution(this, 'Distribution', {
      originConfigs: [
        {
          behaviors: [{ isDefaultBehavior: true }],
          s3OriginSource: {
            s3BucketSource: this.assetBucket,
            originAccessIdentity,
          },
        },
      ],
      viewerCertificate: cloudfront.ViewerCertificate.fromAcmCertificate(cert, {
        aliases: [this.assetDomainName],
      }),
      comment: `Asset endpoint for ${this.assetDomainName}`,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    });

    new route53.ARecord(this, 'AliasRecord', {
      recordName: this.assetDomainName,
      zone: this.zone,
      target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(distribution)),
    });

  }
}