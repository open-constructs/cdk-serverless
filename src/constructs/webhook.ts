import * as fs from 'fs';
import * as apiGW from '@aws-cdk/aws-apigatewayv2-alpha';
import * as apiGWInteg from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import {
  aws_certificatemanager as acm,
  aws_route53 as route53,
  aws_route53_targets as route53Target,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { LambdaFunction, LambdaOptions } from './func';

export interface HttpWebhookProps {

  /**
   * Name of the webhook
   */
  name: string;

  /**
   * Deployment stage (e.g. dev)
   */
  stageName: string;

  /**
   * Domain name of the Webhook API (e.g. example.com)
   */
  domainName: string;

  /**
   * Hostname of the Webhook API
   */
  hostname: string;

  /**
   * additional options for the underlying Lambda construct of all created functions
   */
  lambdaOptions?: LambdaOptions;
}

export class HttpWebhook extends Construct {

  public readonly api: apiGW.HttpApi;
  public readonly handler: LambdaFunction;
  private webhookDomainName: string;

  constructor(scope: Construct, id: string, private props: HttpWebhookProps) {
    super(scope, id);

    const hostedZone = route53.HostedZone.fromLookup(this, 'Zone', { domainName: props.domainName });
    this.webhookDomainName = `${props.hostname}.${props.domainName}`;

    const dn = new apiGW.DomainName(this, 'DomainName', {
      domainName: this.webhookDomainName,
      certificate: new acm.Certificate(this, 'Cert', {
        domainName: this.webhookDomainName,
        validation: acm.CertificateValidation.fromDns(hostedZone),
      }),
    });
    this.handler = this.createHandler();
    this.api = new apiGW.HttpApi(this, 'Resource', {
      apiName: `Webhook ${props.name} [${props.stageName}]`,
      defaultDomainMapping: {
        domainName: dn,
      },
      defaultIntegration: new apiGWInteg.HttpLambdaIntegration('Integration', this.handler),
    });
    new route53.ARecord(this, 'DnsRecord', {
      zone: hostedZone,
      recordName: this.webhookDomainName,
      target: route53.RecordTarget.fromAlias(new route53Target.ApiGatewayv2DomainProperties(dn.regionalDomainName, dn.regionalHostedZoneId)),
    });

  }

  private createHandler() {
    const description = `Webhook ${this.props.name}`;

    const entryFile = `./src/lambda/webhook.${this.props.name.toLowerCase().replace(/[^\w-]/g, '-')}.ts`;
    if (!fs.existsSync(entryFile)) {
      fs.mkdirSync('./src/lambda', { recursive: true });
      fs.writeFileSync(entryFile, `import { http, errors } from '@taimos/lambda-toolbox';

export const handler = http.createHttpHandler<any, any>(async (ctx) => {
  ctx.logger.info(JSON.stringify(ctx.event));
  throw new errors.HttpError(500, 'Not yet implemented');
});`, {
        encoding: 'utf-8',
      });
    }

    return new LambdaFunction(this, 'LambdaHandler', {
      stageName: this.props.stageName,
      additionalEnv: {
        DOMAIN_NAME: this.props.domainName,
      },
      entry: entryFile,
      description: `[${this.props.stageName}] ${description}`,
      lambdaOptions: this.props.lambdaOptions,
    });
  }

}