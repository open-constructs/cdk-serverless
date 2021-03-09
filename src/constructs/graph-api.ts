import * as appsync from '@aws-cdk/aws-appsync';
import * as cloudwatch from '@aws-cdk/aws-cloudwatch';
import * as lambdaNodejs from '@aws-cdk/aws-lambda-nodejs';
import * as cdk from '@aws-cdk/core';
import { AssetCdn, AssetCdnProps } from './asset-cdn';
import { Authentication, AuthenticationProps } from './auth';
import { LambdaFunction } from './func';
import { Monitoring } from './monitoring';
import { SingleTableDatastore, SingleTableDatastoreProps } from './table';

export interface GraphApiProps {
  apiName: string;
  stageName: string;

  monitoring?: boolean;
  singleTableDatastore?: SingleTableDatastoreProps;
  authentication?: AuthenticationProps;
  assetCdn?: AssetCdnProps;

  additionalEnv?: {
    [key: string]: string;
  };

}

export class GraphApi extends cdk.Construct {

  public readonly api: appsync.GraphqlApi;
  public readonly integrationStack: cdk.Stack;

  public readonly singleTableDatastore?: SingleTableDatastore;
  public readonly authentication?: Authentication;
  public readonly assetCdn?: AssetCdn;
  public readonly tableDataSource?: appsync.DynamoDbDataSource;
  public readonly monitoring?: Monitoring;

  private _functions: { [operationId: string]: LambdaFunction } = {};

  constructor(scope: cdk.Construct, id: string, private props: GraphApiProps) {
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

    this.integrationStack = new cdk.Stack(this, 'Integrations');

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

  protected addLambdaResolver<TYPE extends { __typename?: any }>(typeName: TYPE['__typename'], fieldName: keyof Omit<TYPE, '__typename'>): lambdaNodejs.NodejsFunction {
    const operationId = `${typeName}.${fieldName}`;
    const description = `Type ${typeName} Field ${fieldName} Resolver`;

    const fn = new LambdaFunction(this, `Fn${operationId}`, {
      stageName: this.props.stageName,
      additionalEnv: this.props.additionalEnv,
      file: operationId,
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
    });
    this._functions[operationId] = fn;
    cdk.Tags.of(fn).add('OpenAPI', description);

    if (this.monitoring) {
      this.monitoring.lambdaDurationsWidget.addLeftMetric(fn.metricDuration());
      this.monitoring.lambdaInvokesWidget.addLeftMetric(fn.metricInvocations());
      this.monitoring.lambdaErrorsWidget.addLeftMetric(fn.metricErrors());
      this.monitoring.lambdaErrorsWidget.addLeftMetric(fn.metricThrottles());
    }

    const dataSource = new appsync.LambdaDataSource(this, `LambdaDS${operationId}`, {
      api: this.api,
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

  protected addDynamoDbVtlResolver<TYPE extends { __typename?: any }>(typeName: TYPE['__typename'], fieldName: keyof Omit<TYPE, '__typename'>): void {
    const operationId = `${typeName}.${fieldName}`;

    new appsync.Resolver(this, `Resolver${operationId}`, {
      api: this.api,
      typeName,
      fieldName: fieldName as string,
      dataSource: this.tableDataSource,
      requestMappingTemplate: appsync.MappingTemplate.fromFile(`./src/vtl/${operationId}.req.vm`),
      responseMappingTemplate: appsync.MappingTemplate.fromFile(`./src/vtl/${operationId}.res.vm`),
    });
  }
}