/* eslint-disable max-len */
import * as fs from 'fs';
import { Tags, aws_appsync, aws_certificatemanager, aws_iam, aws_logs, aws_route53 } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CognitoAuthentication } from './authentication';
import { BaseApi, BaseApiProps } from './base-api';
import { LambdaFunction } from './func';

export interface GraphQlApiProps extends BaseApiProps {
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

  definitionFileName: string;
}

export interface VtlResolverOptions {
  /**
   * The datasource the VTL resolver targets
   */
  dataSource: aws_appsync.BaseDataSource;

  /**
   * string replacements to process on the VTL
   *
   * @default no variable expansions
   */
  variables?: { [name: string]: string };
}

export class GraphQlApi<RESOLVERS> extends BaseApi {

  public readonly api: aws_appsync.GraphqlApi;
  public readonly tableDataSource?: aws_appsync.DynamoDbDataSource;

  private _functions: { [operationId: string]: LambdaFunction } = {};
  private cognitoAuth: CognitoAuthentication;

  constructor(scope: Construct, id: string, private props: GraphQlApiProps) {
    super(scope, id, props);

    this.cognitoAuth = props.authentication as CognitoAuthentication;

    let customDomainName: aws_appsync.DomainOptions | undefined;
    let hostedZone: aws_route53.IHostedZone | undefined;
    if (props.domainName) {
      hostedZone = aws_route53.HostedZone.fromLookup(this, 'Zone', { domainName: props.domainName });
      const apiDomainName = `${props.apiHostname ?? 'api'}.${props.domainName}`;
      customDomainName = {
        domainName: apiDomainName,
        certificate: new aws_certificatemanager.DnsValidatedCertificate(this, 'Cert', {
          hostedZone,
          region: 'us-east-1',
          domainName: apiDomainName,
          validation: aws_certificatemanager.CertificateValidation.fromDns(hostedZone),
        }),
      };
    }

    this.api = new aws_appsync.GraphqlApi(this, 'Resource', {
      name: `${props.apiName} [${props.stageName}]`,
      logConfig: {
        fieldLogLevel: aws_appsync.FieldLogLevel.ALL,
        retention: aws_logs.RetentionDays.TWO_MONTHS,
      },
      schema: aws_appsync.SchemaFile.fromAsset(props.definitionFileName),
      domainName: customDomainName,
      ...this.cognitoAuth && {
        authorizationConfig: {
          additionalAuthorizationModes: [
            {
              authorizationType: aws_appsync.AuthorizationType.USER_POOL,
              userPoolConfig: {
                userPool: this.cognitoAuth.userpool,
                defaultAction: aws_appsync.UserPoolDefaultAction.DENY,
              },
            },
            ...this.cognitoAuth.identityPool ? [{ authorizationType: aws_appsync.AuthorizationType.IAM }] : [],
          ],
        },
      },
    });
    if (customDomainName && this.api.appSyncDomainName) {
      new aws_route53.CnameRecord(this, 'DnsRecord', {
        zone: hostedZone!,
        recordName: customDomainName.domainName,
        domainName: this.api.appSyncDomainName,
      });
    }

    // if ((props.monitoring ?? true) && this.monitoring) {
    //   this.monitoring.apiErrorsWidget.addLeftMetric(new cloudwatch.Metric({
    //     namespace: 'AWS/AppSync',
    //     metricName: '5XXError',
    //     dimensionsMap: {
    //       GraphQLAPIId: this.api.apiId,
    //     },
    //     statistic: 'sum',
    //   }));
    //   this.monitoring.apiErrorsWidget.addLeftMetric(new cloudwatch.Metric({
    //     namespace: 'AWS/AppSync',
    //     metricName: '4XXError',
    //     dimensionsMap: {
    //       GraphQLAPIId: this.api.apiId,
    //     },
    //     statistic: 'sum',
    //   }));
    //   this.monitoring.apiLatencyWidget.addLeftMetric(new cloudwatch.Metric({
    //     namespace: 'AWS/AppSync',
    //     metricName: 'Latency',
    //     dimensionsMap: {
    //       GraphQLAPIId: this.api.apiId,
    //     },
    //     statistic: 'Average',
    //   }));
    //   this.monitoring.apiLatencyWidget.addLeftMetric(new cloudwatch.Metric({
    //     namespace: 'AWS/AppSync',
    //     metricName: 'Latency',
    //     dimensionsMap: {
    //       GraphQLAPIId: this.api.apiId,
    //     },
    //     statistic: 'p90',
    //   }));
    //   this.monitoring.apiLatencyTailWidget.addLeftMetric(new cloudwatch.Metric({
    //     namespace: 'AWS/AppSync',
    //     metricName: 'Latency',
    //     dimensionsMap: {
    //       GraphQLAPIId: this.api.apiId,
    //     },
    //     statistic: 'p95',
    //   }));
    //   this.monitoring.apiLatencyTailWidget.addLeftMetric(new cloudwatch.Metric({
    //     namespace: 'AWS/AppSync',
    //     metricName: 'Latency',
    //     dimensionsMap: {
    //       GraphQLAPIId: this.api.apiId,
    //     },
    //     statistic: 'p99',
    //   }));
    // }

    if (props.singleTableDatastore) {
      this.tableDataSource = new aws_appsync.DynamoDbDataSource(this, 'SingleTableSource', {
        api: this.api,
        table: props.singleTableDatastore?.table,
      });
    }
  }

  /**
   *
   */
  public grantAccess<TYPE extends keyof RESOLVERS, FIELDTYPE extends NonNullable<RESOLVERS[TYPE]>>(grantee: aws_iam.IGrantable, typeName: TYPE, ...fieldNames: (keyof FIELDTYPE)[]): void {
    this.api.grant(grantee, aws_appsync.IamResource.ofType(typeName as string, ...fieldNames as string[]), 'appsync:GraphQL');
  }

  /**
   *
   */
  public grantAccessUnAuth<TYPE extends keyof RESOLVERS, FIELDTYPE extends NonNullable<RESOLVERS[TYPE]>>(typeName: TYPE, ...fieldNames: (keyof FIELDTYPE)[]): void {
    if (!this.cognitoAuth.identityPool) {
      throw new Error('Cannot grant to Cognito identity pool as none is provided');
    }
    this.grantAccess(this.cognitoAuth.identityPool.unauthenticatedRole, typeName, ...fieldNames);
  }

  /**
   *
   */
  public grantAccessAuth<TYPE extends keyof RESOLVERS, FIELDTYPE extends NonNullable<RESOLVERS[TYPE]>>(typeName: TYPE, ...fieldNames: (keyof FIELDTYPE)[]): void {
    if (!this.cognitoAuth.identityPool) {
      throw new Error('Cannot grant to Cognito identity pool as none is provided');
    }
    this.grantAccess(this.cognitoAuth.identityPool.authenticatedRole, typeName, ...fieldNames);
  }


  /**
   * getFunctionForOperation
   */
  public getFunctionForOperation<TYPE extends keyof RESOLVERS, FIELDTYPE extends NonNullable<RESOLVERS[TYPE]>>(typeName: TYPE, fieldName: keyof FIELDTYPE): LambdaFunction {
    return this._functions[`${typeName as string}.${fieldName as String}`];
  }

  public addLambdaResolver<TYPE extends keyof RESOLVERS, FIELDTYPE extends NonNullable<RESOLVERS[TYPE]>>(typeName: TYPE, fieldName: keyof FIELDTYPE): LambdaFunction {
    const operationId = `${typeName as string}.${fieldName as String}`;
    const description = `Type ${typeName as string} Field ${fieldName as String} Resolver`;

    const entryFile = `./src/lambda/${operationId}.ts`;
    if (!fs.existsSync(entryFile)) {
      fs.mkdirSync('./src/lambda/', { recursive: true });
      this.createEntryFile(entryFile, typeName as string, fieldName as string);
    }

    const fn = new LambdaFunction(this, `Fn${operationId}`, {
      stageName: this.props.stageName,
      additionalEnv: this.props.additionalEnv,
      entry: entryFile,
      description: `[${this.props.stageName}] ${description}`,
      ...this.props.authentication && {
        userPool: (this.props.authentication as CognitoAuthentication).userpool,
      },
      ...this.props.singleTableDatastore && {
        table: this.props.singleTableDatastore.table,
        tableWrites: typeName === 'Mutation',
      },
      ...this.props.assetCdn && {
        assetDomainName: this.props.assetCdn.assetDomainName,
        assetBucket: this.props.assetCdn.assetBucket,
      },
      lambdaOptions: this.props.lambdaOptions,
      lambdaTracing: this.props.lambdaTracing,
    });
    this._functions[operationId] = fn;
    Tags.of(fn).add('GraphQL', description);

    // if (this.monitoring) {
    //   this.monitoring.lambdaDurationsWidget.addLeftMetric(fn.metricDuration());
    //   this.monitoring.lambdaInvokesWidget.addLeftMetric(fn.metricInvocations());
    //   this.monitoring.lambdaErrorsWidget.addLeftMetric(fn.metricErrors());
    //   this.monitoring.lambdaErrorsWidget.addLeftMetric(fn.metricThrottles());
    // }

    const dataSource = new aws_appsync.LambdaDataSource(this, `LambdaDS${operationId}`, {
      api: this.api,
      name: `Lambda_${typeName as string}_${fieldName as String}`,
      lambdaFunction: fn,
    });

    new aws_appsync.Resolver(this, `Resolver${operationId}`, {
      api: this.api,
      typeName: typeName as string,
      fieldName: fieldName as string,
      dataSource,
    });
    return fn;
  }

  public addDynamoDbVtlResolver<TYPE extends keyof RESOLVERS, FIELDTYPE extends NonNullable<RESOLVERS[TYPE]>>(typeName: TYPE, fieldName: keyof FIELDTYPE, options?: Omit<VtlResolverOptions, 'dataSource'>): void {
    if (!this.tableDataSource) {
      throw new Error('DynamoDB is not initialized');
    }
    this.addVtlResolver(typeName, fieldName, {
      dataSource: this.tableDataSource,
      ...options,
    });
  }

  public addDynamoDbJSResolver<TYPE extends keyof RESOLVERS, FIELDTYPE extends NonNullable<RESOLVERS[TYPE]>>(typeName: TYPE, fieldName: keyof FIELDTYPE): void {
    if (!this.tableDataSource) {
      throw new Error('DynamoDB is not initialized');
    }
    this.addJSResolver(typeName, fieldName, this.tableDataSource);
  }

  public addJSResolver<TYPE extends keyof RESOLVERS, FIELDTYPE extends NonNullable<RESOLVERS[TYPE]>>(typeName: TYPE, fieldName: keyof FIELDTYPE, dataSource: aws_appsync.BaseDataSource): void {
    const operationId = `${typeName as string}.${fieldName as String}`;
    const description = `Type ${typeName as string} Field ${fieldName as String} Resolver`;

    const entryFile = `./src/js-resolver/${operationId}.js`;
    if (!fs.existsSync(entryFile)) {
      fs.mkdirSync('./src/js-resolver/', { recursive: true });
      this.createJSResolverFile(entryFile, typeName as string, fieldName as string);
    }

    const jsFunction = new aws_appsync.AppsyncFunction(this, `JSFunction${operationId}`, {
      api: this.api,
      name: operationId.replace(/\./g, ''),
      description,
      dataSource,
      code: aws_appsync.Code.fromAsset(entryFile),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    new aws_appsync.Resolver(this, `Resolver${operationId}`, {
      api: this.api,
      typeName: typeName as string,
      fieldName: fieldName as string,
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
      pipelineConfig: [jsFunction],
      code: aws_appsync.Code.fromInline(`
    // The before step
    export function request(...args) {
      console.log(args);
      return {}
    }

    // The after step
    export function response(ctx) {
      return ctx.prev.result
    }
  `),
    });
  }

  public addVtlResolver<TYPE extends keyof RESOLVERS, FIELDTYPE extends NonNullable<RESOLVERS[TYPE]>>(typeName: TYPE, fieldName: keyof FIELDTYPE, options: VtlResolverOptions): void {
    const operationId = `${typeName as string}.${fieldName as String}`;

    const mappingReqFile = `./src/vtl/${operationId}.req.vtl`;
    if (!fs.existsSync(mappingReqFile)) {
      fs.mkdirSync('./src/vtl/', { recursive: true });
      fs.writeFileSync(mappingReqFile, '## Request mapping', { encoding: 'utf-8' });
    }
    const mappingResFile = `./src/vtl/${operationId}.res.vtl`;
    if (!fs.existsSync(mappingResFile)) {
      fs.mkdirSync('./src/vtl/', { recursive: true });
      fs.writeFileSync(mappingResFile, '$util.toJson($ctx.result)', { encoding: 'utf-8' });
    }

    new aws_appsync.Resolver(this, `Resolver${operationId}`, {
      api: this.api,
      typeName: typeName as string,
      fieldName: fieldName as string,
      dataSource: options.dataSource,
      requestMappingTemplate: aws_appsync.MappingTemplate.fromString(this.substVariables(fs.readFileSync(mappingReqFile).toString('utf-8'), options.variables)),
      responseMappingTemplate: aws_appsync.MappingTemplate.fromString(this.substVariables(fs.readFileSync(mappingResFile).toString('utf-8'), options.variables)),

    });
  }

  private substVariables(data: string, vars: { [name: string]: string } = {}): string {
    let res = data;
    for (const name in vars) {
      if (Object.prototype.hasOwnProperty.call(vars, name)) {
        const value = vars[name];
        res = res.replace(new RegExp(`\\$\{${name}\}`, 'g'), value);
      }
    }
    return res;
  }

  private createEntryFile(entryFile: string, typeName: string, fieldName: string) {
    fs.writeFileSync(entryFile, `import { api } from 'cdk-serverless/lib/lambda';

// TODO: Replace QUERYTYPE with the input type of the field ${typeName}.${fieldName}
// TODO: Replace RETURNTYPE with the return type of the field ${typeName}.${fieldName}

export const handler = api.createAppSyncHandler<QUERYTYPE, RETURNTYPE>(async (ctx) => {
  ctx.logger.info(JSON.stringify(ctx.event));
  throw new Error('Not yet implemented');
});`, {
      encoding: 'utf-8',
    });
  }

  private createJSResolverFile(entryFile: string, typeName: string, fieldName: string) {
    fs.writeFileSync(entryFile, `import { util } from '@aws-appsync/utils';

/**
 * Request for ${typeName}.${fieldName}
 */
export function request(ctx) {
  console.log(ctx);
  return {};
}

/**
 * Response for ${typeName}.${fieldName}
 */
export function response(ctx) {
  console.log(ctx);
  return ctx.result.items;
}`, {
      encoding: 'utf-8',
    });
  }
}