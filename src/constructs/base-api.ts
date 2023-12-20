import { aws_route53 } from 'aws-cdk-lib';
import { IFunction } from 'aws-cdk-lib/aws-lambda';
import { DefaultDashboardFactory, MonitoringFacade } from 'cdk-monitoring-constructs';
import { Construct } from 'constructs';
import { AssetCdn } from './asset-cdn';
import { ICognitoAuthentication, IJwtAuthentication } from './authentication';
import { LambdaOptions, LambdaTracingOptions } from './func';
import { AggregatedFunctionMonitoring } from './monitoring/aggregated-function-monitoring';
import { SingleTableDatastore } from './table';

export interface BaseApiProps {

  /**
   * Name of the API
   */
  apiName: string;

  /**
   * Deployment stage (e.g. dev)
   */
  stageName: string;

  /**
   * Configure CloudWatch Dashboard for the API and the Lambda functions
   *
   * @default true
   */
  monitoring?: boolean;

  /**
   * @default none
   */
  singleTableDatastore?: SingleTableDatastore;

  /**
   * Use a Cognito user pool for authorization.
   * Alternatively supply a JWT issuer and audience
   * to use any other JWT-based authorization service.
   *
   * @default none
   */
  authentication?: IJwtAuthentication | ICognitoAuthentication;

  /**
   * Configure a content delivery network for static assets
   *
   * @default none
   */
  assetCdn?: AssetCdn;

  /**
   * Additional environment variables of all Lambda functions
   */
  additionalEnv?: {
    [key: string]: string;
  };

  /**
   * additional options for the underlying Lambda function construct
   */
  lambdaOptions?: LambdaOptions;

  /**
   * Tracing config for the generated Lambda functions
   */
  lambdaTracing?: LambdaTracingOptions;

  /**
   * Domain name of the API (e.g. example.com)
   *
   * only one of hostedZone and domainName can be specified
   *
   * @default - No custom domain is configured
   */
  domainName?: string;
  /**
   * Hosted Zone of the API (e.g. example.com)
   *
   * only one of hostedZone and domainName can be specified
   *
   * @default - No custom domain is configured
   */
  hostedZone?: aws_route53.IHostedZone;

  /**
   * Hostname of the API if a domain name is specified
   *
   * @default api
   */
  apiHostname?: string;
}

/**
 * Base class for different types of APIs
 */
export abstract class BaseApi extends Construct {

  protected readonly hostedZone?: aws_route53.IHostedZone;
  protected readonly apiHostName?: string;
  protected readonly apiDomainName?: string;
  protected readonly apiFQDN?: string;
  public readonly monitoring?: MonitoringFacade;

  constructor(scope: Construct, id: string, props: BaseApiProps) {
    super(scope, id);

    if (props.hostedZone && props.domainName) {
      throw new Error('Cannot specify hostedZone and domainName at the same time');
    }

    this.hostedZone = props.hostedZone;
    if (props.domainName) {
      this.hostedZone = aws_route53.HostedZone.fromLookup(this, 'Zone', { domainName: props.domainName });
    }
    this.apiDomainName = this.hostedZone?.zoneName;
    this.apiHostName = props.apiHostname ?? 'api';
    if (this.apiDomainName && this.apiHostName) {
      this.apiFQDN = `${this.apiHostName}.${this.apiDomainName}`;
    }

    if (props.monitoring ?? true) {
      this.monitoring = new MonitoringFacade(this, 'Monitoring', {
        dashboardFactory: new DefaultDashboardFactory(this, 'DashboardFactory', {
          dashboardNamePrefix: props.apiName,
        }),
      });
    }

  }

  protected addSingleTableMonitoring(dataStore: SingleTableDatastore) {
    if (this.monitoring) {
      this.monitoring.monitorDynamoTable({ table: dataStore.table });
    }
  }

  protected addOperationFunctionMonitoring(apiName: string, functions: Record<string, IFunction>) {
    if (this.monitoring && Object.keys(functions).length > 0) {
      const functionMonitoring = new AggregatedFunctionMonitoring(this.monitoring, {
        title: 'Lambda metrics',
        apiName: apiName,
        functions: functions,
      });
      this.monitoring.addSegment(functionMonitoring);
    }
  }

}
