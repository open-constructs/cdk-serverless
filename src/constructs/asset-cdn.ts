import {
  CfnOutput,
  aws_certificatemanager as certificatemanager,
  aws_cloudfront as cloudfront,
  aws_route53 as route53,
  aws_route53_targets as route53Targets,
  aws_s3 as s3,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CFN_OUTPUT_SUFFIX_ASSETCDN_BUCKETNAME, CFN_OUTPUT_SUFFIX_ASSETCDN_DOMAINNAME, CFN_OUTPUT_SUFFIX_ASSETCDN_URL } from '../shared/outputs';

/**
 * Properties for AssetCdn L3 construct
 */
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

/**
 * The AssetCdn construct is responsible for setting up an S3 bucket for asset storage
 * and a CloudFront distribution to serve the assets securely with HTTPS. It also
 * configures a Route 53 DNS record to point to the CloudFront distribution.
 */
export class AssetCdn extends Construct {

  /**
   * The Route 53 hosted zone for the asset domain.
   */
  public readonly zone: route53.IHostedZone;

  /**
   * The S3 bucket used to store the assets.
   */
  public readonly assetBucket: s3.Bucket;

  /**
   * The domain name used for accessing the assets.
   */
  public readonly assetDomainName: string;

  /**
   * Creates an instance of AssetCdn.
   *
   * @param scope - The scope in which this construct is defined.
   * @param id - The scoped construct ID.
   * @param props - The properties of the AssetCdn construct.
   */
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


    new CfnOutput(this, CFN_OUTPUT_SUFFIX_ASSETCDN_BUCKETNAME, {
      value: this.assetBucket.bucketName,
    });
    new CfnOutput(this, CFN_OUTPUT_SUFFIX_ASSETCDN_DOMAINNAME, {
      value: this.assetDomainName,
    });
    new CfnOutput(this, CFN_OUTPUT_SUFFIX_ASSETCDN_URL, {
      value: 'https://' + this.assetDomainName,
    });

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
