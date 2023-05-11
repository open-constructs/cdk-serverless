import * as fs from 'fs';
import {
  aws_certificatemanager,
  aws_iam,
  aws_route53,
  aws_route53_targets,
  aws_apigateway,
} from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as yaml from 'js-yaml';
import { OpenAPI3, OperationObject, PathItemObject } from 'openapi-typescript';
import { ICognitoAuthentication, IJwtAuthentication } from './authentication';
import { BaseApi, BaseApiProps } from './base-api';
import { LambdaFunction, LambdaOptions } from './func';

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
  restApiProps?: aws_apigateway.RestApiBaseProps;

  /**
   * additional options for the underlying Lambda function construct per operationId
   *
   * @default -
   */
  lambdaOptionsByOperation?: { [operationId in keyof OPS]?: LambdaOptions };

  definitionFileName: string;
}

export class RestApi<PATHS, OPS> extends BaseApi {

  public readonly api: aws_apigateway.SpecRestApi;
  public readonly apiSpec: OpenAPI3;

  private _functions: { [operationId: string]: LambdaFunction } = {};

  constructor(scope: Construct, id: string, private props: RestApiProps<OPS>) {
    super(scope, id, props);

    this.apiSpec = yaml.load(fs.readFileSync(props.definitionFileName).toString()) as OpenAPI3;

    let customDomainName: aws_apigateway.DomainNameOptions | undefined;
    let hostedZone: aws_route53.IHostedZone | undefined;
    if (props.domainName) {
      hostedZone = aws_route53.HostedZone.fromLookup(this, 'Zone', { domainName: props.domainName });
      const apiDomainName = `${props.apiHostname ?? 'api'}.${props.domainName}`;
      customDomainName = {
        domainName: apiDomainName,
        certificate: new aws_certificatemanager.Certificate(this, 'Cert', {
          domainName: apiDomainName,
          validation: aws_certificatemanager.CertificateValidation.fromDns(hostedZone),
        }),
      };
    }

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

    // Add _spec Endpoint
    this.apiSpec.paths!['/openapi.json'] = {
      get: {
        'summary': 'Returns the raw OpenAPI spec of this API',
        'description': 'Returns the raw OpenAPI spec of this API',
        'operationId': '_spec',
        'responses': {
          200: {
            description: 'OpenAPI spec of this API',
            content: {
              'application/openapi+json': {},
            },
          },
        },
        // @ts-ignore Custom property for AWS
        'x-amazon-apigateway-integration': {
          type: 'mock',
          httpMethod: 'GET',
          payloadFormatVersion: '1.0',
          requestTemplates: {
            'application/json': '{\'statusCode\': 200}',
          },
          responses: {
            200: {
              statusCode: 200,
              responseTemplates: {
                'application/openapi+json': JSON.stringify(this.cleanupSpec(JSON.parse(JSON.stringify((this.apiSpec))))),
              },
            },
          },
        },
      },
    };

    this.patchSecurity(this.apiSpec);

    // TODO patch spec for Cognito user pool

    this.api = new aws_apigateway.SpecRestApi(this, 'Resource', {
      restApiName: `${props.apiName} [${props.stageName}]`,
      domainName: customDomainName,
      apiDefinition: aws_apigateway.ApiDefinition.fromInline(this.apiSpec),
      ...props.restApiProps,
    });

    // add invoke permissions to Lambda functions
    for (const fn of Object.values(this._functions)) {
      fn.addPermission('RestApiInvoke', {
        principal: new aws_iam.ServicePrincipal('apigateway.amazonaws.com'),
        action: 'lambda:InvokeFunction',
        sourceArn: this.api.arnForExecuteApi(),
      });
    }

    if (customDomainName && this.api.domainName) {
      new aws_route53.ARecord(this, 'DnsRecord', {
        zone: hostedZone!,
        recordName: customDomainName.domainName,
        target: aws_route53.RecordTarget.fromAlias(
          new aws_route53_targets.ApiGatewayDomain(this.api.domainName),
        ),
      });
    }

  }

  protected cleanupSpec(spec: { [key: string]: any }): { [key: string]: any } {
    Object.entries(spec).forEach(([prop, value]: [string, any]) => {
      if (prop.startsWith('x-')) {
        delete spec[prop];
      } else if (typeof value === 'object') {
        this.cleanupSpec(spec[prop]);
      }
    });

    return spec;
  }

  /**
   * return the generated Lambda function for the specified API operation
   */
  public getFunctionForOperation(operationId: keyof OPS): LambdaFunction {
    return this._functions[operationId as string];
  }

  /**
   * return a list of all generated Lambda functions
   */
  public getFunctions(): LambdaFunction[] {
    return Object.values(this._functions);
  }

  /**
   * Visitor method to modify the given functions
   *
   * @param operationIds the list of functions to visit
   * @param op the function to call for every function
   */
  public modifyOperationFunctions(operationIds: (keyof OPS)[], op: (fn: LambdaFunction) => void) {
    for (const operationId of operationIds) {
      op(this.getFunctionForOperation(operationId));
    }
  }

  public addRestResource<P extends keyof PATHS>(path: P, method: keyof PATHS[P]) {
    const oaPath = this.apiSpec.paths![path as string];
    const operation = oaPath[method as keyof PathItemObject] as OperationObject;
    const operationId = operation.operationId!;
    const description = `${method as string} ${path as string} - ${operation.summary}`;

    const customLambdaOptions = this.props.lambdaOptionsByOperation ? this.props.lambdaOptionsByOperation[operationId as keyof OPS] : undefined;
    return this.addCustomRestResource(operation, method as string, description, customLambdaOptions);
  }

  public addCustomRestResource(operation: OperationObject, method: string, description: string, additionalLambdaOptions: LambdaOptions = {}) {
    if ('x-amazon-apigateway-integration' in operation) {
      return; // Skip if operation was declared in spec file already!
    }

    const entryFile = `./src/lambda/rest.${this.props.apiName.toLowerCase()}.${operation.operationId}.ts`;

    const lambdaOptions = {
      ...this.props.lambdaOptions && {
        ...this.props.lambdaOptions,
      },
      ...additionalLambdaOptions,
    };

    const authentication = this.props.authentication && (this.props.authentication.hasOwnProperty('userpool')
      ? { userPool: (this.props.authentication as ICognitoAuthentication).userpool }
      : { jwt: this.props.authentication as IJwtAuthentication });

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
      ...authentication,
      ...this.props.singleTableDatastore && {
        table: this.props.singleTableDatastore.table,
        tableWrites: this.tableWriteAccessForMethod(method),
      },
      ...this.props.assetCdn && {
        assetDomainName: this.props.assetCdn.assetDomainName,
        assetBucket: this.props.assetCdn.assetBucket,
      },
      lambdaOptions,
      lambdaTracing: this.props.lambdaTracing,
    });
    this._functions[operation.operationId!] = fn;
    cdk.Tags.of(fn).add('OpenAPI', description.replace(/[^\w\s\d_.:/=+\-@]/g, ''));

    // if (this.monitoring) {
    //   this.monitoring.lambdaDurationsWidget.addLeftMetric(fn.metricDuration());
    //   this.monitoring.lambdaInvokesWidget.addLeftMetric(fn.metricInvocations());
    //   this.monitoring.lambdaErrorsWidget.addLeftMetric(fn.metricErrors());
    //   this.monitoring.lambdaErrorsWidget.addLeftMetric(fn.metricThrottles());
    // }

    const hasVersionConfig = lambdaOptions.currentVersionOptions != undefined;

    operation['x-amazon-apigateway-integration'] = {
      type: 'aws_proxy',
      httpMethod: 'POST',
      uri: cdk.Stack.of(this).formatArn({
        resource: 'path',
        service: 'apigateway',
        account: 'lambda',
        arnFormat: cdk.ArnFormat.SLASH_RESOURCE_NAME,
        resourceName: `2015-03-31/functions/${(hasVersionConfig ? fn.currentVersion : fn).functionArn}/invocations`,
        //             ^^^^^^^^^^ - THIS NEEDS TO BE THIS DATE. EXACTLY!
      }),
      passthroughBehavior: 'when_no_templates',
      payloadFormatVersion: '1.0',
    };

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

  /**
   * AWS does not properly apply the 'security' option to every single path-method.
   * According to documentation, global security gets applied, if there is no security
   * set for the particular path-method. If there is any, even empty, it will get precedence.
   * THIS DOES NOT HAPPEN ON AWS. IT JUST ALWAYS USES THE GLOBAL SETTING!
   *
   * 'security applies [...] schemes globally to all API operations, unless overridden on the operation level'
   * @see https://swagger.io/docs/specification/authentication/
   */
  protected patchSecurity(spec: OpenAPI3) {
    if ('security' in spec) {
      for (const specPath of Object.values(spec.paths || [])) {
        for (const key in specPath) {
          // @ts-expect-error -> There is a wrong definition for method includes! It allows any value to be given!
          if (!this.apiMethods.includes(key)) {
            continue; // Skip if not http method definition
          }

          const specMethod = specPath[key as keyof PathItemObject]!;
          if (!('security' in specMethod)) {
            specMethod.security = spec.security;
          }
        }
      }
      delete spec.security;
    }
  }

}