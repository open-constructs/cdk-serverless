import {
  aws_certificatemanager as certificatemanager,
  aws_cloudfront as cloudfront,
  aws_route53 as route53,
  aws_route53_targets as route53Targets,
  aws_s3 as s3,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface AssetCdnProps {
  /**
   * Domain name of the asset content delivery network (e.g. example.com)
   */
  domainName: string;

  /**
   * Hostname of the asset content delivery network (e.g. cdn)
   */
  hostName: string;
}

export class AssetCdn extends Construct {

  public readonly zone: route53.IHostedZone;
  public readonly assetBucket: s3.Bucket;
  public readonly assetDomainName: string;

  constructor(scope: Construct, id: string, props: AssetCdnProps) {
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

    // TODO this will be deprecated soon; find other solution
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