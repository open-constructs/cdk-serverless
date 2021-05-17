import * as fs from 'fs';
import * as appsync from '@aws-cdk/aws-appsync';
import * as cloudwatch from '@aws-cdk/aws-cloudwatch';
import * as cdk from '@aws-cdk/core';
import { AssetCdn, AssetCdnProps } from './asset-cdn';
import { Authentication, AuthenticationProps } from './auth';
import { LambdaFunction, LambdaOptions } from './func';
import { Monitoring } from './monitoring';
import { SingleTableDatastore, SingleTableDatastoreProps } from './table';

export interface GraphQlApiProps {

  /**
   * Name of the GraphQL API
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
   * Create a DynamoDB Table to store data using the single table design
   *
   * @default none
   */
  singleTableDatastore?: SingleTableDatastoreProps;

  /**
   * Configure a Cognito user pool and use it for authorization
   *
   * @default none
   */
  authentication?: AuthenticationProps;

  /**
   * Configure a content delivery network for static assets
   *
   * @default none
   */
  assetCdn?: AssetCdnProps;

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

}

export interface VtlResolverOptions {
  /**
   * The datasource the VTL resolver targets
   */
  dataSource: appsync.BaseDataSource;

  /**
   * string replacements to process on the VTL
   *
   * @default no variable expansions
   */
  variables?: { [name: string]: string };
}

export class GraphQlApi extends cdk.Construct {

  public readonly api: appsync.GraphqlApi;

  public readonly singleTableDatastore?: SingleTableDatastore;
  public readonly authentication?: Authentication;
  public readonly assetCdn?: AssetCdn;
  public readonly tableDataSource?: appsync.DynamoDbDataSource;
  public readonly monitoring?: Monitoring;

  private _functions: { [operationId: string]: LambdaFunction } = {};

  constructor(scope: cdk.Construct, id: string, private props: GraphQlApiProps) {
    super(scope, id);

    if (props.singleTableDatastore) {
      this.singleTableDatastore = new SingleTableDatastore(this, 'SingleTableDS', props.singleTableDatastore);
    }
    if (props.authentication) {
      this.authentication = new Authentication(this, 'Authentication', props.authentication);
    }
    if (props.assetCdn) {
      this.assetCdn = new AssetCdn(this, 'AssetCdn', props.assetCdn);
    }

    this.api = new appsync.GraphqlApi(this, 'Resource', {
      name: `${props.apiName} [${props.stageName}]`,
      logConfig: {
        fieldLogLevel: appsync.FieldLogLevel.ALL,
      },
      schema: appsync.Schema.fromAsset('schema.graphql'),
      ...this.authentication && {
        authorizationConfig: {
          additionalAuthorizationModes: [{
            authorizationType: appsync.AuthorizationType.USER_POOL,
            userPoolConfig: {
              userPool: this.authentication.userpool,
              defaultAction: appsync.UserPoolDefaultAction.DENY,
            },
          }],
        },
      },
    });

    if (props.monitoring ?? true) {
      this.monitoring = new Monitoring(this, 'Monitoring', {
        apiName: this.props.apiName,
        stageName: this.props.stageName,
      });

      this.monitoring.apiErrorsWidget.addLeftMetric(new cloudwatch.Metric({
        namespace: 'AWS/AppSync',
        metricName: '5XXError',
        dimensions: {
          GraphQLAPIId: this.api.apiId,
        },
        statistic: 'sum',
      }));
      this.monitoring.apiErrorsWidget.addLeftMetric(new cloudwatch.Metric({
        namespace: 'AWS/AppSync',
        metricName: '4XXError',
        dimensions: {
          GraphQLAPIId: this.api.apiId,
        },
        statistic: 'sum',
      }));
      this.monitoring.apiLatencyWidget.addLeftMetric(new cloudwatch.Metric({
        namespace: 'AWS/AppSync',
        metricName: 'Latency',
        dimensions: {
          GraphQLAPIId: this.api.apiId,
        },
        statistic: 'Average',
      }));
      this.monitoring.apiLatencyWidget.addLeftMetric(new cloudwatch.Metric({
        namespace: 'AWS/AppSync',
        metricName: 'Latency',
        dimensions: {
          GraphQLAPIId: this.api.apiId,
        },
        statistic: 'p90',
      }));
      this.monitoring.apiLatencyTailWidget.addLeftMetric(new cloudwatch.Metric({
        namespace: 'AWS/AppSync',
        metricName: 'Latency',
        dimensions: {
          GraphQLAPIId: this.api.apiId,
        },
        statistic: 'p95',
      }));
      this.monitoring.apiLatencyTailWidget.addLeftMetric(new cloudwatch.Metric({
        namespace: 'AWS/AppSync',
        metricName: 'Latency',
        dimensions: {
          GraphQLAPIId: this.api.apiId,
        },
        statistic: 'p99',
      }));
    }

    if (this.singleTableDatastore) {
      this.tableDataSource = new appsync.DynamoDbDataSource(this, 'SingleTableSource', {
        api: this.api,
        table: this.singleTableDatastore?.table,
      });
    }
  }

  /**
   * getFunctionForOperation
   */
  public getFunctionForOperation<TYPE extends { __typename?: any }>(typeName: TYPE['__typename'], fieldName: keyof Omit<TYPE, '__typename'>): LambdaFunction {
    return this._functions[`${typeName}.${fieldName}`];
  }

  public addLambdaResolver<TYPE extends { __typename?: any }>(typeName: TYPE['__typename'], fieldName: keyof Omit<TYPE, '__typename'>): LambdaFunction {
    const operationId = `${typeName}.${fieldName}`;
    const description = `Type ${typeName} Field ${fieldName} Resolver`;

    const entryFile = `./src/lambda/${operationId}.ts`;
    if (!fs.existsSync(entryFile)) {
      this.createEntryFile(entryFile, typeName, fieldName as string);
    }

    const fn = new LambdaFunction(this, `Fn${operationId}`, {
      stageName: this.props.stageName,
      additionalEnv: this.props.additionalEnv,
      entry: entryFile,
      description: `[${this.props.stageName}] ${description}`,
      ...this.authentication && {
        userPool: this.authentication?.userpool,
      },
      ...this.singleTableDatastore && {
        table: this.singleTableDatastore.table,
        tableWrites: typeName === 'Mutation',
      },
      ...this.assetCdn && {
        assetDomainName: this.assetCdn.assetDomainName,
        assetBucket: this.assetCdn.assetBucket,
      },
      lambdaOptions: this.props.lambdaOptions,
    });
    this._functions[operationId] = fn;
    cdk.Tags.of(fn).add('GraphQL', description);

    if (this.monitoring) {
      this.monitoring.lambdaDurationsWidget.addLeftMetric(fn.metricDuration());
      this.monitoring.lambdaInvokesWidget.addLeftMetric(fn.metricInvocations());
      this.monitoring.lambdaErrorsWidget.addLeftMetric(fn.metricErrors());
      this.monitoring.lambdaErrorsWidget.addLeftMetric(fn.metricThrottles());
    }

    const dataSource = new appsync.LambdaDataSource(this, `LambdaDS${operationId}`, {
      api: this.api,
      name: `Lambda_${typeName}_${fieldName}`,
      lambdaFunction: fn,
    });

    new appsync.Resolver(this, `Resolver${operationId}`, {
      api: this.api,
      typeName,
      fieldName: fieldName as string,
      dataSource,
    });
    return fn;
  }

  public addDynamoDbVtlResolver<TYPE extends { __typename?: any }>(typeName: TYPE['__typename'], fieldName: keyof Omit<TYPE, '__typename'>, options?: Omit<VtlResolverOptions, 'dataSource'>): void {
    if (!this.tableDataSource) {
      throw new Error('DynamoDB is not initialized');
    }
    this.addVtlResolver(typeName, fieldName, {
      dataSource: this.tableDataSource,
      ...options,
    });
  }

  public addVtlResolver<TYPE extends { __typename?: any }>(typeName: TYPE['__typename'], fieldName: keyof Omit<TYPE, '__typename'>, options: VtlResolverOptions): void {
    const operationId = `${typeName}.${fieldName}`;

    const mappingReqFile = `./src/vtl/${operationId}.req.vtl`;
    if (!fs.existsSync(mappingReqFile)) {
      fs.writeFileSync(mappingReqFile, '## Request mapping', { encoding: 'utf-8' });
    }
    const mappingResFile = `./src/vtl/${operationId}.res.vtl`;
    if (!fs.existsSync(mappingResFile)) {
      fs.writeFileSync(mappingResFile, '$util.toJson($ctx.result)', { encoding: 'utf-8' });
    }

    new appsync.Resolver(this, `Resolver${operationId}`, {
      api: this.api,
      typeName,
      fieldName: fieldName as string,
      dataSource: options.dataSource,
      requestMappingTemplate: appsync.MappingTemplate.fromString(this.substVariables(fs.readFileSync(mappingReqFile).toString('utf-8'), options.variables)),
      responseMappingTemplate: appsync.MappingTemplate.fromString(this.substVariables(fs.readFileSync(mappingResFile).toString('utf-8'), options.variables)),
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
    fs.writeFileSync(entryFile, `import { http } from '@taimos/lambda-toolbox';

// TODO: Replace QUERYTYPE with the input type of the field ${typeName}.${fieldName}
// TODO: Replace RETURNTYPE with the return type of the field ${typeName}.${fieldName}

export const handler = http.createAppSyncHandler<QUERYTYPE, RETURNTYPE>(async (ctx) => {
  ctx.logger.info(ctx.event);
  throw new Error('Not yet implemented');
});`, {
      encoding: 'utf-8',
    });
  }
}