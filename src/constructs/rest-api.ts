import * as fs from 'node:fs';
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
import { CFN_OUTPUT_SUFFIX_RESTAPI_DOMAINNAME, CFN_OUTPUT_SUFFIX_RESTAPI_URL } from '../shared/outputs';

export interface RestApiProps<OPS> extends BaseApiProps {

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

  cors: boolean;

  /**
   * A list of operation IDs that should skip the authorizer entirely.
   * These operations will have `security: []` in the OpenAPI spec, meaning
   * they are publicly accessible without authentication.
   *
   * @default - no anonymous operations
   */
  anonymousOperations?: (keyof OPS)[];

  /**
   * Controls whether the JWT Lambda authorizer uses the TOKEN or REQUEST type.
   *
   * **token (default):** The API Gateway validates that the Authorization header is present
   * before invoking the Lambda authorizer. If the header is missing, API Gateway immediately
   * returns 401 without invoking the Lambda. This is cheaper for unauthenticated requests
   * because no Lambda invocation occurs, but it does not support optional authentication
   * (every request must carry a token or be rejected).
   *
   * **request:** The API Gateway always invokes the Lambda authorizer regardless of whether
   * the Authorization header is present. This enables optional authentication: the Lambda
   * can inspect the request, return Allow with an anonymous principal when no token is
   * provided, and return Allow with user claims when a valid token is present. The trade-off
   * is that you pay for a Lambda invocation on every request, including unauthenticated ones.
   *
   * Use 'request' when you need endpoints that behave differently for authenticated vs
   * anonymous users (e.g., personalized responses for logged-in users, generic responses
   * for guests) without splitting them into separate operations.
   *
   * @default 'token'
   */
  jwtAuthorizerType?: 'token' | 'request';
}

/**
 * The RestApi construct sets up an AWS API Gateway REST API using OpenAPI specification.
 * This construct facilitates the creation of a REST API with various configurations, including custom domain, CORS support, and integration with Lambda functions.
 * It allows auto-generating routes based on the provided OpenAPI definition and provides methods to dynamically add custom routes and manage Lambda function integrations.
 *
 * @template PATHS - The type definition for the API paths.
 * @template OPS - The type definition for the API operations.
 *
 * @example
 * const api = new RestApi(this, 'MyRestApi', {
 *   apiName: 'MyAPI',
 *   stageName: 'dev',
 *   definitionFileName: 'openapi.yaml',
 *   authentication: myCognitoAuth,
 *   singleTableDatastore: myDynamoDBTable,
 *   autoGenerateRoutes: true,
 * });
 *
 * // Add a custom REST resource
 * api.addRestResource('/items', 'get');
 *
 * // Get the Lambda function for a specific operation
 * const lambdaFunction = api.getFunctionForOperation('getItems');
 */
export class RestApi<PATHS, OPS> extends BaseApi {

  /**
   * The AWS API Gateway REST API instance.
   */
  public readonly api: aws_apigateway.SpecRestApi;

  /**
   * The OpenAPI specification for the REST API.
   */
  public readonly apiSpec: OpenAPI3;

  /**
   * A collection of Lambda functions used as integrations for the API operations.
   * @private
   */
  private _functions: { [operationId: string]: LambdaFunction } = {};

  private readonly apiMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];

  /**
   * The JWT authorizer Lambda function, if JWT authentication is configured.
   * Stored so the invoke permission can be granted after the SpecRestApi is created.
   * @private
   */
  private _authorizerFn?: LambdaFunction;

  /**
   * Set of operationIds that should have security disabled (security: []).
   * @private
   */
  private _anonymousOperations: Set<string> = new Set();

  /**
   * Stores the original per-operation security arrays as assigned by patchSecurity,
   * keyed by operationId. Used by setAnonymousOperations to restore security on
   * operations removed from the anonymous set.
   * @private
   */
  private _originalOperationSecurity: Map<string, any[]> = new Map();

  /**
   * Creates an instance of RestApi.
   *
   * @param scope - The scope in which this construct is defined.
   * @param id - The scoped construct ID.
   * @param props - The properties of the RestApi construct.
   */
  constructor(scope: Construct, id: string, private props: RestApiProps<OPS>) {
    super(scope, id, props);

    this.apiSpec = yaml.load(fs.readFileSync(props.definitionFileName).toString()) as OpenAPI3;

    let customDomainName: aws_apigateway.DomainNameOptions | undefined;
    if (this.apiFQDN) {
      customDomainName = {
        domainName: this.apiFQDN,
        certificate: new aws_certificatemanager.Certificate(this, 'Cert', {
          domainName: this.apiFQDN,
          validation: aws_certificatemanager.CertificateValidation.fromDns(this.hostedZone),
        }),
      };
      new cdk.CfnOutput(this, 'RestApiDomainName', {
        key: `${this.props.apiName}${CFN_OUTPUT_SUFFIX_RESTAPI_DOMAINNAME}`,
        value: this.apiFQDN,
      });
      new cdk.CfnOutput(this, 'RestApiUrlOutput', {
        key: `${this.props.apiName}${CFN_OUTPUT_SUFFIX_RESTAPI_URL}`,
        value: 'https://' + this.apiFQDN,
      });
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

    if (props.cors) {
      this.apiSpec.paths!['/{proxy+}'] = {
        options: {
          'summary': 'CORS support',
          'description': 'Enable CORS by returning correct headers',
          'tags': ['CORS'],
          'responses': {
            200: {
              description: 'Default response for CORS method',
              headers: {
                'Access-Control-Allow-Origin': { schema: { type: 'string' } },
                'Access-Control-Allow-Methods': { schema: { type: 'string' } },
                'Access-Control-Allow-Credentials': { schema: { type: 'string' } },
                'Access-Control-Allow-Headers': { schema: { type: 'string' } },
              },
              content: {},
            },
          },
          'x-amazon-apigateway-integration': {
            type: 'mock',
            requestTemplates: {
              'application/json': '#set($context.requestOverride.header.origin = $method.request.header.origin)\n{\n  "statusCode" : 200\n}\n',
            },
            responses: {
              default: {
                statusCode: '200',
                responseParameters: {
                  'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key'",
                  'method.response.header.Access-Control-Allow-Credentials': "'true'",
                  'method.response.header.Access-Control-Allow-Methods': "'PUT,GET,POST,DELETE,PATCH,HEAD,OPTIONS'",
                  'method.response.header.Access-Control-Allow-Origin': 'context.requestOverride.header.origin',
                },
                responseTemplates: {
                  'application/json': '{}',
                },
              },
            },
          },
        },
      };
    }

    this.patchSecuritySchemes(this.apiSpec);

    // Initialize anonymous operations from props before patchSecurity distributes security
    if (props.anonymousOperations) {
      for (const opId of props.anonymousOperations) {
        this._anonymousOperations.add(opId as string);
      }
    }

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

    // Grant API Gateway permission to invoke the JWT authorizer Lambda
    if (this._authorizerFn) {
      this._authorizerFn.addPermission('ApiGatewayAuthorizerInvoke', {
        principal: new aws_iam.ServicePrincipal('apigateway.amazonaws.com'),
        action: 'lambda:InvokeFunction',
        sourceArn: this.api.arnForExecuteApi(),
      });
    }

    if (customDomainName && this.api.domainName) {
      new aws_route53.ARecord(this, 'DnsRecord', {
        zone: this.hostedZone!,
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

  /**
   * Replace the full set of anonymous operations.
   * Anonymous operations will have `security: []` applied in the OpenAPI spec,
   * making them publicly accessible without authentication.
   *
   * Since CDK serializes the OpenAPI spec at synth time (fromInline stores the
   * object reference), mutations after SpecRestApi construction still take effect.
   *
   * @param operationIds - The operation IDs to mark as anonymous. Replaces any previously set anonymous operations.
   */
  public setAnonymousOperations(operationIds: (keyof OPS)[]) {
    this._anonymousOperations.clear();
    for (const opId of operationIds) {
      this._anonymousOperations.add(opId as string);
    }
    this.applyAnonymousSecurity();
  }

  /**
   * Add additional operations to the set of anonymous operations.
   * Newly added operations will have `security: []` applied in the OpenAPI spec.
   *
   * Since CDK serializes the OpenAPI spec at synth time (fromInline stores the
   * object reference), mutations after SpecRestApi construction still take effect.
   *
   * @param operationIds - The operation IDs to add to the anonymous set.
   */
  public addAnonymousOperations(operationIds: (keyof OPS)[]) {
    for (const opId of operationIds) {
      this._anonymousOperations.add(opId as string);
    }
    this.applyAnonymousSecurityForOps(operationIds.map(op => op as string));
  }

  /**
   * Re-applies security settings to all operations based on the current anonymous set.
   * Operations in the anonymous set get `security: []`; operations removed from the set
   * have their original security restored.
   * @private
   */
  private applyAnonymousSecurity() {
    for (const specPath of Object.values(this.apiSpec.paths || [])) {
      for (const key in specPath) {
        if (!this.apiMethods.includes(key)) {
          continue;
        }
        const specMethod = (specPath as PathItemObject)[key as keyof PathItemObject]! as OperationObject;
        if (specMethod.operationId && this._anonymousOperations.has(specMethod.operationId)) {
          specMethod.security = [];
        } else if (specMethod.operationId && this._originalOperationSecurity.has(specMethod.operationId)) {
          // Restore original security for operations removed from the anonymous set
          specMethod.security = this._originalOperationSecurity.get(specMethod.operationId);
        }
      }
    }
  }

  /**
   * Applies `security: []` only to the specified operations.
   * @private
   */
  private applyAnonymousSecurityForOps(operationIds: string[]) {
    const opsSet = new Set(operationIds);
    for (const specPath of Object.values(this.apiSpec.paths || [])) {
      for (const key in specPath) {
        if (!this.apiMethods.includes(key)) {
          continue;
        }
        const specMethod = (specPath as PathItemObject)[key as keyof PathItemObject]! as OperationObject;
        if (specMethod.operationId && opsSet.has(specMethod.operationId)) {
          specMethod.security = [];
        }
      }
    }
  }

  public addRestResource<P extends keyof PATHS>(path: P, method: keyof PATHS[P]) {
    const oaPath = this.apiSpec.paths![path as string] as PathItemObject;
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
   * Injects the authorizer security scheme into the OpenAPI spec based on the
   * authentication type, placing it where API Gateway expects it for the spec
   * version: `components.securitySchemes` for OpenAPI 3.x, or the root
   * `securityDefinitions` for Swagger 2.0. An authorizer written to the wrong
   * location is silently ignored on import, deploying an unauthenticated API.
   *
   * For Cognito: adds a cognito_user_pools authorizer referencing the user pool ARN.
   * For JWT: creates a Lambda authorizer function and adds a token authorizer referencing its ARN.
   */
  protected patchSecuritySchemes(spec: OpenAPI3) {
    if (!this.props.authentication) {
      return;
    }

    const schemes = this.securitySchemeContainer(spec);

    if (this.props.authentication.hasOwnProperty('userpool')) {
      // Cognito User Pool authorizer
      const cognitoAuth = this.props.authentication as ICognitoAuthentication;
      const authorizerName = 'CognitoAuthorizer';

      schemes[authorizerName] = {
        'type': 'apiKey',
        'name': 'Authorization',
        'in': 'header',
        'x-amazon-apigateway-authtype': 'cognito_user_pools',
        'x-amazon-apigateway-authorizer': {
          type: 'cognito_user_pools',
          providerARNs: [cognitoAuth.userpool.userPoolArn],
        },
      };

      // Ensure global security references the authorizer so patchSecurity distributes it
      if (!spec.security) {
        spec.security = [{ [authorizerName]: [] }];
      }
    } else {
      // JWT (Lambda) authorizer
      const jwtAuth = this.props.authentication as IJwtAuthentication;
      const authorizerName = 'JwtAuthorizer';

      const authorizerFn = new LambdaFunction(this, 'JwtAuthorizerFn', {
        stageName: this.props.stageName,
        entry: 'src/lambda/rest-api.jwt-authorizer.ts',
        description: `[${this.props.stageName}] JWT Authorizer for ${this.props.apiName}`,
        jwt: jwtAuth,
        lambdaOptions: this.props.lambdaOptions,
        lambdaTracing: this.props.lambdaTracing,
      });

      const authorizerUri = cdk.Stack.of(this).formatArn({
        resource: 'path',
        service: 'apigateway',
        account: 'lambda',
        arnFormat: cdk.ArnFormat.SLASH_RESOURCE_NAME,
        resourceName: `2015-03-31/functions/${authorizerFn.functionArn}/invocations`,
      });

      schemes[authorizerName] = {
        'type': 'apiKey',
        'name': 'Authorization',
        'in': 'header',
        'x-amazon-apigateway-authtype': 'custom',
        'x-amazon-apigateway-authorizer': {
          type: this.props.jwtAuthorizerType === 'request' ? 'request' : 'token',
          authorizerUri: authorizerUri,
          authorizerResultTtlInSeconds: this.props.jwtAuthorizerType === 'request' ? 0 : 300,
          ...(this.props.jwtAuthorizerType !== 'request' && {
            identitySource: 'method.request.header.Authorization',
          }),
        },
      };

      // Store the authorizer function so we can grant permission after the SpecRestApi is created
      this._authorizerFn = authorizerFn;

      // Ensure global security references the authorizer so patchSecurity distributes it
      if (!spec.security) {
        spec.security = [{ [authorizerName]: [] }];
      }
    }
  }

  /**
   * Returns the security-scheme container for the spec, creating it if needed.
   * OpenAPI 3.x stores schemes under `components.securitySchemes`; Swagger 2.0
   * uses the root `securityDefinitions`. API Gateway reads only the location that
   * matches the document's declared version, so the authorizer must go there.
   */
  private securitySchemeContainer(spec: OpenAPI3): { [name: string]: any } {
    const specAny = spec as any;
    const isOpenApiV3 = typeof specAny.openapi === 'string' && specAny.openapi.startsWith('3');
    if (isOpenApiV3) {
      specAny.components = specAny.components ?? {};
      specAny.components.securitySchemes = specAny.components.securitySchemes ?? {};
      return specAny.components.securitySchemes;
    }
    specAny.securityDefinitions = specAny.securityDefinitions ?? {};
    return specAny.securityDefinitions;
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
          if (!this.apiMethods.includes(key)) {
            continue; // Skip if not http method definition
          }

          const specMethod = (specPath as PathItemObject)[key as keyof PathItemObject]!;
          if (!('security' in specMethod)) {
            const operationId = (specMethod as OperationObject).operationId;
            if (operationId && this._anonymousOperations.has(operationId)) {
              // Store what security would have been applied so we can restore later
              this._originalOperationSecurity.set(operationId, spec.security as any[]);
              specMethod.security = [];
            } else {
              specMethod.security = spec.security;
              if (operationId) {
                this._originalOperationSecurity.set(operationId, spec.security as any[]);
              }
            }
          } else {
            // Operation already has explicit security defined in the spec
            const operationId = (specMethod as OperationObject).operationId;
            if (operationId) {
              this._originalOperationSecurity.set(operationId, specMethod.security as any[]);
            }
          }
        }
      }
      delete spec.security;
    }
  }

}
