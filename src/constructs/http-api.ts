import * as fs from 'fs';
import * as apiGW from '@aws-cdk/aws-apigatewayv2';
import * as apiGWInteg from '@aws-cdk/aws-apigatewayv2-integrations';
import * as acm from '@aws-cdk/aws-certificatemanager';
import * as lambda from '@aws-cdk/aws-lambda';
import * as route53 from '@aws-cdk/aws-route53';
import * as route53Target from '@aws-cdk/aws-route53-targets';
import * as cdk from '@aws-cdk/core';
import * as yaml from 'js-yaml';
import { OpenAPI3, OperationObject, PathItemObject } from 'openapi-typescript';
import { BaseApi, BaseApiProps } from './base-api';
import { LambdaFunction } from './func';

export interface HttpApiProps extends BaseApiProps {

  /**
   * Domain name of the API (e.g. example.com)
   *
   * @default - No custom domain is configured
   */
  domainName?: string;

  /**
   * Hostname of the API if a domain name is specified
   *
   * @default api
   */
  apiHostname?: string;

  /**
   * Generate routes for all endpoints configured in the openapi.yaml file
   *
   * @default true
   */
  autoGenerateRoutes?: boolean;

  /**
   * custom options for the created HttpApi
   *
   * @default -
   */
  httpApiProps?: apiGW.HttpApiProps;

}

export class HttpApi<PATHS, OPS> extends BaseApi {

  public readonly api: apiGW.HttpApi;
  public readonly apiSpec: OpenAPI3;

  private _functions: { [operationId: string]: LambdaFunction } = {};

  constructor(scope: cdk.Construct, id: string, private props: HttpApiProps) {
    super(scope, id, props);

    this.apiSpec = yaml.load(fs.readFileSync('openapi.yaml').toString()) as OpenAPI3;

    let customDomainName;
    if (props.domainName) {
      const hostedZone = route53.HostedZone.fromLookup(this, 'Zone', { domainName: props.domainName });
      const apiDomainName = `${props.apiHostname ?? 'api'}.${props.domainName}`;
      customDomainName = new apiGW.DomainName(this, 'DomainName', {
        domainName: apiDomainName,
        certificate: new acm.Certificate(this, 'Cert', {
          domainName: apiDomainName,
          validation: acm.CertificateValidation.fromDns(hostedZone),
        }),
      });
      new route53.ARecord(this, 'DnsRecord', {
        zone: hostedZone,
        recordName: apiDomainName,
        target: route53.RecordTarget.fromAlias(
          new route53Target.ApiGatewayv2DomainProperties(customDomainName.regionalDomainName, customDomainName.regionalHostedZoneId),
        ),
      });
    }

    this.api = new apiGW.HttpApi(this, 'Resource', {
      apiName: `${props.apiName} [${props.stageName}]`,
      ...customDomainName && {
        defaultDomainMapping: {
          domainName: customDomainName,
        },
      },
      ...props.httpApiProps,
    });

    if ((props.monitoring ?? true) && this.monitoring) {
      this.monitoring.apiErrorsWidget.addLeftMetric(this.api.metricServerError({
        statistic: 'sum',
      }));
      this.monitoring.apiErrorsWidget.addLeftMetric(this.api.metricClientError({
        statistic: 'sum',
      }));

      this.monitoring.apiLatencyWidget.addLeftMetric(this.api.metricLatency({
        statistic: 'Average',
      }));
      this.monitoring.apiLatencyWidget.addLeftMetric(this.api.metricLatency({
        statistic: 'p90',
      }));
      this.monitoring.apiLatencyTailWidget.addLeftMetric(this.api.metricLatency({
        statistic: 'p95',
      }));
      this.monitoring.apiLatencyTailWidget.addLeftMetric(this.api.metricLatency({
        statistic: 'p99',
      }));
    }

    if (props.autoGenerateRoutes ?? true) {
      for (const path in this.apiSpec.paths) {
        if (Object.prototype.hasOwnProperty.call(this.apiSpec.paths, path)) {
          const pathItem = this.apiSpec.paths[path];
          for (const method in pathItem) {
            if (Object.prototype.hasOwnProperty.call(pathItem, method) &&
              ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].indexOf(method) >= 0) {
              // Add all operations
              this.addRestResource(path as any, method as any);
            }
          }
        }
      }
    }

  }

  /**
   * getFunctionForOperation
   */
  public getFunctionForOperation(operationId: keyof OPS): LambdaFunction {
    return this._functions[operationId as string];
  }

  public addRoute<P extends keyof PATHS>(path: P, method: keyof PATHS[P], handler: lambda.Function) {
    const apiMethod = this.methodTransform(method as string);
    new apiGW.HttpRoute(this, `${apiMethod}${path}`, {
      httpApi: this.api,
      routeKey: apiGW.HttpRouteKey.with(path as string, apiMethod),
      integration: new apiGWInteg.LambdaProxyIntegration({ handler }),
    });
  }

  public addRestResource<P extends keyof PATHS>(path: P, method: keyof PATHS[P]) {
    const oaPath = this.apiSpec.paths![path as string];
    const operation = oaPath[method as keyof PathItemObject] as OperationObject;
    const description = `${method} ${path} - ${operation.summary}`;

    const entryFile = `./src/lambda/rest.${operation.operationId}.ts`;
    if (!fs.existsSync(entryFile)) {
      this.createEntryFile(entryFile, method as string, operation);
    }

    const fn = new LambdaFunction(this, `Fn${operation.operationId}`, {
      stageName: this.props.stageName,
      additionalEnv: {
        ...this.props.domainName && {
          DOMAIN_NAME: this.props.domainName,
        },
        ...this.props.additionalEnv,
      },
      entry: entryFile,
      description: `[${this.props.stageName}] ${description}`,
      ...this.authentication && {
        userPool: this.authentication?.userpool,
      },
      ...this.singleTableDatastore && {
        table: this.singleTableDatastore.table,
        tableWrites: this.tableWriteAccessForMethod(method as string),
      },
      ...this.assetCdn && {
        assetDomainName: this.assetCdn.assetDomainName,
        assetBucket: this.assetCdn.assetBucket,
      },
      lambdaOptions: this.props.lambdaOptions,
    });
    this._functions[operation.operationId as string] = fn;
    cdk.Tags.of(fn).add('OpenAPI', description.replace(/[^\w\s\d_.:/=+\-@]/g, ''));

    if (this.monitoring) {
      this.monitoring.lambdaDurationsWidget.addLeftMetric(fn.metricDuration());
      this.monitoring.lambdaInvokesWidget.addLeftMetric(fn.metricInvocations());
      this.monitoring.lambdaErrorsWidget.addLeftMetric(fn.metricErrors());
      this.monitoring.lambdaErrorsWidget.addLeftMetric(fn.metricThrottles());
    }

    this.addRoute(path, method, fn);

    return fn;
  }

  private createEntryFile(entryFile: string, method: string, operation: OperationObject) {
    let factoryCall;
    let logs;
    switch (method.toLowerCase()) {
      case 'post':
      case 'put':
      case 'patch':
        factoryCall = `http.createOpenApiHandlerWithRequestBody<operations['${operation.operationId}']>(async (ctx, data) => {`;
        logs = 'ctx.logger.info(JSON.stringify(data));';
        break;
      case 'options':
      case 'delete':
      case 'get':
      case 'head':
      default:
        factoryCall = `http.createOpenApiHandler<operations['${operation.operationId}']>(async (ctx) => {`;
        logs = '';
        break;
    }

    fs.writeFileSync(entryFile, `import { http, errors } from '@taimos/lambda-toolbox';
import { operations } from './types.generated';

export const handler = ${factoryCall}
  ctx.logger.info(JSON.stringify(ctx.event));
  ${logs}
  throw new errors.HttpError(500, 'Not yet implemented');
});`, {
      encoding: 'utf-8',
    });
  }

  private tableWriteAccessForMethod(method: string): boolean {
    switch (method.toLowerCase()) {
      case 'delete':
      case 'post':
      case 'put':
      case 'patch':
        return true;
      case 'options':
      case 'get':
      case 'head':
      default:
        return false;
    }
  }

  private methodTransform(method: string) {
    switch (method.toLowerCase()) {
      case 'get':
        return apiGW.HttpMethod.GET;
      case 'delete':
        return apiGW.HttpMethod.DELETE;
      case 'post':
        return apiGW.HttpMethod.POST;
      case 'put':
        return apiGW.HttpMethod.PUT;
      case 'head':
        return apiGW.HttpMethod.HEAD;
      case 'options':
        return apiGW.HttpMethod.OPTIONS;
      case 'patch':
        return apiGW.HttpMethod.PATCH;
      default:
        return apiGW.HttpMethod.ANY;
    }
  }
}