import { Construct } from 'constructs';
import { AssetCdn } from './asset-cdn';
import { ICognitoAuthentication, IJwtAuthentication } from './authentication';
import { LambdaOptions, LambdaTracingOptions } from './func';
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

}

export abstract class BaseApi extends Construct {

  constructor(scope: Construct, id: string, _props: BaseApiProps) {
    super(scope, id);

  }

}
