/* eslint-disable max-len */
import { SpawnSyncOptions, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import { AssetHashType, BundlingOptions, BundlingOutput, DockerImage, Tags, aws_appsync, aws_certificatemanager, aws_iam, aws_logs, aws_route53 } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CognitoAuthentication } from './authentication';
import { BaseApi, BaseApiProps } from './base-api';
import { LambdaFunction } from './func';

export interface GraphQlApiProps extends BaseApiProps {
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

export interface JsResolverOptions {
  /**
   * Variables that will be put into the "stash" of the resolver pipeline
   *
   * @default none
   */
  readonly stashValues?: { [key: string]: string };

  /**
   * name of the pipeline steps to create
   *
   * @default - only a default step will be created
   */
  readonly pipelineStepNames?: string[];
}

interface JsResolverConfig {
  name: string;
  index: number;
  stepCount: number;
  entryFile: string;
  functionId: string;
}

/**
 * The GraphQlApi construct sets up an AWS AppSync GraphQL API integrated with Cognito for authentication and DynamoDB for data storage.
 * This construct facilitates the creation of a GraphQL API with various configurations, including custom domain, logging, schema definition,
 * and authorization using Cognito User Pool and Identity Pool. It also provides methods to dynamically add resolvers and grant access to specific fields.
 *
 * @template RESOLVERS - The type definition for the GraphQL resolvers.
 *
 * @example
 * const api = new GraphQlApi(this, 'MyGraphQlApi', {
 *   apiName: 'MyAPI',
 *   stageName: 'dev',
 *   definitionFileName: 'schema.graphql',
 *   authentication: myCognitoAuth,
 *   singleTableDatastore: myDynamoDBTable,
 * });
 *
 * // Add a Lambda resolver
 * api.addLambdaResolver('Query', 'getItem');
 *
 * // Grant access to unauthenticated users for a specific query
 * api.grantAccessUnAuth('Query', 'getItem');
 */
export class GraphQlApi<RESOLVERS> extends BaseApi {

  /**
   * The AWS AppSync GraphQL API instance.
   */
  public readonly api: aws_appsync.GraphqlApi;

  /**
   * The optional DynamoDB data source for the GraphQL API.
   */
  public readonly tableDataSource?: aws_appsync.DynamoDbDataSource;

  /**
   * A collection of Lambda functions used as resolvers for the GraphQL API.
   */
  private _functions: { [operationId: string]: LambdaFunction } = {};

  /**
   * The Cognito authentication configuration.
   */
  private cognitoAuth: CognitoAuthentication;

  /**
   * Creates an instance of GraphQlApi.
   *
   * @param scope - The scope in which this construct is defined.
   * @param id - The scoped construct ID.
   * @param props - The properties of the GraphQlApi construct.
   */
  constructor(scope: Construct, id: string, private props: GraphQlApiProps) {
    super(scope, id, props);

    this.cognitoAuth = props.authentication as CognitoAuthentication;

    let customDomainName: aws_appsync.DomainOptions | undefined;
    if (this.apiFQDN) {
      customDomainName = {
        domainName: this.apiFQDN,
        certificate: new aws_certificatemanager.DnsValidatedCertificate(this, 'Cert', {
          hostedZone: this.hostedZone!,
          region: 'us-east-1',
          domainName: this.apiFQDN,
          validation: aws_certificatemanager.CertificateValidation.fromDns(this.hostedZone),
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
        zone: this.hostedZone!,
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

  public addDynamoDbJSResolver<TYPE extends keyof RESOLVERS, FIELDTYPE extends NonNullable<RESOLVERS[TYPE]>>(typeName: TYPE, fieldName: keyof FIELDTYPE, options?: JsResolverOptions): void {
    if (!this.tableDataSource) {
      throw new Error('DynamoDB is not initialized');
    }
    this.addJSResolver(typeName, fieldName, this.tableDataSource, {
      ...options,
      stashValues: {
        ...options?.stashValues ?? {},
        table: this.props.singleTableDatastore!.table.tableName,
      },
    });
  }

  public addJSResolver<TYPE extends keyof RESOLVERS, FIELDTYPE extends NonNullable<RESOLVERS[TYPE]>>(typeName: TYPE, fieldName: keyof FIELDTYPE, dataSource: aws_appsync.BaseDataSource, options?: JsResolverOptions): void {
    const operationId = `${typeName as string}.${fieldName as String}`;
    const description = `Type ${typeName as string} Field ${fieldName as String} Resolver`;

    const resolverDir = './src/js-resolver/';
    const functions: JsResolverConfig[] = [];

    if (!options || !options.pipelineStepNames || options.pipelineStepNames.length == 0) {
      functions.push({
        name: 'default',
        index: 0,
        stepCount: 1,
        entryFile: `${resolverDir}/${operationId}.ts`,
        functionId: `JSFunction${operationId}`,
      });
    } else {
      functions.push(...options.pipelineStepNames.map((name, index) => ({
        name,
        index,
        stepCount: options.pipelineStepNames!.length,
        entryFile: `${resolverDir}/${operationId}.${name}.ts`,
        functionId: `JSFunction${operationId}${name}`,
      })));
    }

    const pipelineConfig = [];

    for (const fn of functions) {
      if (!fs.existsSync(fn.entryFile)) {
        fs.mkdirSync(resolverDir, { recursive: true });
        this.createJSResolverFile(fn, typeName as string, fieldName as string);
      }

      const jsFunction = new aws_appsync.AppsyncFunction(this, fn.functionId, {
        api: this.api,
        name: operationId.replace(/\./g, ''),
        description,
        dataSource,
        code: aws_appsync.Code.fromAsset('.', {
          assetHashType: AssetHashType.OUTPUT,
          deployTime: true,
          bundling: {
            image: DockerImage.fromRegistry('dummy'), // Will never be used due to local bundling
            outputType: BundlingOutput.SINGLE_FILE,
            functionId: fn.functionId,
            local: {
              tryBundle(outputDir) {
                const osPlatform = os.platform();
                exec(
                  osPlatform === 'win32' ? 'cmd' : 'bash',
                  [
                    osPlatform === 'win32' ? '/c' : '-c',
                    `esbuild --bundle --sourcemap=inline --sources-content=false --target=esnext --platform=node --format=esm --external:@aws-appsync/utils --outdir=${outputDir} ${fn.entryFile}`,
                  ],
                  {
                    env: { ...process.env },
                    stdio: [ // show output
                      'ignore', // ignore stdio
                      process.stderr, // redirect stdout to stderr
                      'inherit', // inherit stderr
                    ],
                    windowsVerbatimArguments: osPlatform === 'win32',
                  });

                return true;
              },
            },
          } as BundlingOptions,
        }),
        runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
      });
      pipelineConfig.push(jsFunction);
    }

    new aws_appsync.Resolver(this, `Resolver${operationId}`, {
      api: this.api,
      typeName: typeName as string,
      fieldName: fieldName as string,
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
      pipelineConfig,
      code: aws_appsync.Code.fromInline(`
    // The before step
    export function request(ctx) {
      console.log(ctx);
${Object.entries(options?.stashValues ?? []).map(val => `      ctx.stash.${val[0]} = '${val[1]}'`).join('\n')}
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
    const argType = `${typeName}${uppercaseFirst(fieldName)}Args`;
    fs.writeFileSync(entryFile, `import { api } from 'cdk-serverless/lib/lambda';
import { ${typeName}, ${argType} } from '../generated/graphql.${this.props.apiName.toLowerCase()}-model.generated';

export const handler = api.createAppSyncHandler<${argType}, ${typeName}['${fieldName}']>(async (ctx) => {
  ctx.logger.info(JSON.stringify(ctx.event));
  throw new Error('Not yet implemented');
});`, {
      encoding: 'utf-8',
    });
  }

  private createJSResolverFile(fn: JsResolverConfig, typeName: string, fieldName: string) {
    const argType = `${typeName}${uppercaseFirst(fieldName)}Args`;
    const returnType = (fn.index == (fn.stepCount - 1)) ? `${typeName}['${fieldName}']` : 'any';

    fs.writeFileSync(fn.entryFile, `import { Context, util } from '@aws-appsync/utils';
import { ${typeName}, ${argType} } from '../generated/graphql.${this.props.apiName.toLowerCase()}-model.generated';

/**
 * Request for ${typeName}.${fieldName} (Step: ${fn.name} ${fn.index + 1}/${fn.stepCount})
 */
export function request(ctx: Context<${argType}>): any {
  console.log(ctx);
  return {};
}

/**
 * Response for ${typeName}.${fieldName} (Step: ${fn.name} ${fn.index + 1}/${fn.stepCount})
 */
export function response(ctx: Context<${argType}>): ${returnType} {
  console.log(ctx);
  return ctx.result.items;
}`, {
      encoding: 'utf-8',
    });
  }

}

function uppercaseFirst(value: string): string {
  return value.substring(0, 1).toUpperCase() + value.substring(1);
}

/**
 * Copied from https://github.com/aws/aws-cdk/blob/main/packages/aws-cdk-lib/aws-lambda-nodejs/lib/util.ts
 * as it is not exported by aws-cdk-lib
 */
function exec(cmd: string, args: string[], options?: SpawnSyncOptions) {
  const proc = spawnSync(cmd, args, options);

  if (proc.error) {
    throw proc.error;
  }

  if (proc.status !== 0) {
    if (proc.stdout || proc.stderr) {
      throw new Error(`[Status ${proc.status}] stdout: ${proc.stdout?.toString().trim()}\n\n\nstderr: ${proc.stderr?.toString().trim()}`);
    }
    throw new Error(`${cmd} ${args.join(' ')} ${options?.cwd ? `run in directory ${options.cwd}` : ''} exited with status ${proc.status}`);
  }

  return proc;
}

