import * as fs from 'fs';
import {
  aws_certificatemanager,
  aws_lambda,
  aws_route53,
  aws_route53_targets,
  aws_apigateway,
} from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as yaml from 'js-yaml';
import { OpenAPI3, OperationObject, PathItemObject } from 'openapi-typescript';
import { BaseApi, BaseApiProps } from './base-api';
import { LambdaFunction, LambdaOptions } from './func';
import { SingleTableDatastore } from './table';

export interface RestApiProps<OPS> extends BaseApiProps {

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
  restApiProps?: aws_apigateway.RestApiProps;

  /**
   * additional options for the underlying Lambda function construct per operationId
   *
   * @default -
   */
  lambdaOptionsByOperation?: { [operationId in keyof OPS]?: LambdaOptions };

  singleTableDatastore?: SingleTableDatastore;

  definitionFileName: string;
}

export class RestApi<PATHS, OPS> extends BaseApi {

  public readonly api: aws_apigateway.RestApi;
  public readonly apiSpec: OpenAPI3;

  private _functions: { [operationId: string]: LambdaFunction } = {};

  constructor(scope: Construct, id: string, private props: RestApiProps<OPS>) {
    super(scope, id, props);

    this.apiSpec = yaml.load(fs.readFileSync(props.definitionFileName).toString()) as OpenAPI3;

    let customDomainName;
    if (props.domainName) {
      const hostedZone = aws_route53.HostedZone.fromLookup(this, 'Zone', { domainName: props.domainName });
      const apiDomainName = `${props.apiHostname ?? 'api'}.${props.domainName}`;
      customDomainName = new aws_apigateway.DomainName(this, 'DomainName', {
        domainName: apiDomainName,
        certificate: new aws_certificatemanager.Certificate(this, 'Cert', {
          domainName: apiDomainName,
          validation: aws_certificatemanager.CertificateValidation.fromDns(hostedZone),
        }),
      });
      new aws_route53.ARecord(this, 'DnsRecord', {
        zone: hostedZone,
        recordName: apiDomainName,
        target: aws_route53.RecordTarget.fromAlias(
          new aws_route53_targets.ApiGatewayDomain(customDomainName),
        ),
      });
    }

    this.api = new aws_apigateway.RestApi(this, 'Resource', {
      restApiName: `${props.apiName} [${props.stageName}]`,
      ...customDomainName && {
        defaultDomainMapping: {
          domainName: customDomainName,
        },
      },
      ...props.restApiProps,
    });

    // if ((props.monitoring ?? true) && this.monitoring) {
    //   this.monitoring.apiErrorsWidget.addLeftMetric(this.api.metricServerError({
    //     statistic: 'sum',
    //   }));
    //   this.monitoring.apiErrorsWidget.addLeftMetric(this.api.metricClientError({
    //     statistic: 'sum',
    //   }));

    //   this.monitoring.apiLatencyWidget.addLeftMetric(this.api.metricLatency({
    //     statistic: 'Average',
    //   }));
    //   this.monitoring.apiLatencyWidget.addLeftMetric(this.api.metricLatency({
    //     statistic: 'p90',
    //   }));
    //   this.monitoring.apiLatencyTailWidget.addLeftMetric(this.api.metricLatency({
    //     statistic: 'p95',
    //   }));
    //   this.monitoring.apiLatencyTailWidget.addLeftMetric(this.api.metricLatency({
    //     statistic: 'p99',
    //   }));
    // }

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

  public addRoute<P extends keyof PATHS>(path: P, method: keyof PATHS[P], operationName: string | undefined, handler: aws_lambda.IFunction) {
    this.addCustomRoute(path as string, method as string, operationName, handler);
  }

  public addCustomRoute(path: string, method: string, operationName: string | undefined, handler: aws_lambda.IFunction) {
    const apiMethod = method.toUpperCase();
    new aws_apigateway.Method(this, `${apiMethod}${path}`, {
      httpMethod: apiMethod,
      resource: this.api.root.resourceForPath(path),
      integration: new aws_apigateway.LambdaIntegration(handler),
      options: {
        operationName,
      },
    });
  }

  public addRestResource<P extends keyof PATHS>(path: P, method: keyof PATHS[P]) {
    const oaPath = this.apiSpec.paths![path as string];
    const operation = oaPath[method as keyof PathItemObject] as OperationObject;
    const operationId = operation.operationId!;
    const description = `${method as string} ${path as string} - ${operation.summary}`;

    const customLambdaOptions = this.props.lambdaOptionsByOperation ? this.props.lambdaOptionsByOperation[operationId as keyof OPS] : undefined;
    return this.addCustomRestResource(path as string, method as string, operationId, description, customLambdaOptions);
  }

  public addCustomRestResource(path: string, method: string, operationId: string, description: string, additionalLambdaOptions: LambdaOptions = {}) {

    const entryFile = `./src/lambda/rest.${this.props.apiName.toLowerCase()}.${operationId}.ts`;

    const lambdaOptions = {
      ...this.props.lambdaOptions && {
        ...this.props.lambdaOptions,
      },
      ...additionalLambdaOptions,
    };

    const fn = new LambdaFunction(this, `Fn${operationId}`, {
      stageName: this.props.stageName,
      additionalEnv: {
        ...this.props.domainName && {
          DOMAIN_NAME: this.props.domainName,
        },
        ...this.props.additionalEnv,
      },
      entry: entryFile,
      description: `[${this.props.stageName}] ${description}`,
      // ...this.authentication && {
      //   userPool: this.authentication?.userpool,
      // },
      ...this.props.singleTableDatastore && {
        table: this.props.singleTableDatastore.table,
        tableWrites: this.tableWriteAccessForMethod(method),
      },
      // ...this.assetCdn && {
      //   assetDomainName: this.assetCdn.assetDomainName,
      //   assetBucket: this.assetCdn.assetBucket,
      // },
      lambdaOptions,
      lambdaTracing: this.props.lambdaTracing,
    });
    this._functions[operationId] = fn;
    cdk.Tags.of(fn).add('OpenAPI', description.replace(/[^\w\s\d_.:/=+\-@]/g, ''));

    // if (this.monitoring) {
    //   this.monitoring.lambdaDurationsWidget.addLeftMetric(fn.metricDuration());
    //   this.monitoring.lambdaInvokesWidget.addLeftMetric(fn.metricInvocations());
    //   this.monitoring.lambdaErrorsWidget.addLeftMetric(fn.metricErrors());
    //   this.monitoring.lambdaErrorsWidget.addLeftMetric(fn.metricThrottles());
    // }

    const hasVersionConfig = lambdaOptions.currentVersionOptions != undefined;
    this.addCustomRoute(path, method, operationId, hasVersionConfig ? fn.currentVersion : fn);

    return fn;
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

}