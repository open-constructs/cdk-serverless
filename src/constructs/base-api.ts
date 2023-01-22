import { Construct } from 'constructs';
// import { AssetCdn, AssetCdnProps } from './asset-cdn';
// import { Authentication, AuthenticationProps, IAuthentication } from './auth';
import { LambdaOptions, LambdaTracingOptions } from './func';
// import { Monitoring } from './monitoring';
// import { SingleTableDatastore, SingleTableDatastoreProps } from './table';

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

  // /**
  //  * Create a DynamoDB Table to store data using the single table design
  //  *
  //  * @default none
  //  */
  // singleTableDatastore?: SingleTableDatastoreProps;

  // /**
  //  * Configure a Cognito user pool and use it for authorization
  //  *
  //  * @default none
  //  */
  // authentication?: AuthenticationProps;

  // /**
  //  * Use an existing Cognito user pool and use it for authorization
  //  *
  //  * @default none
  //  */
  // existingAuthentication?: IAuthentication;

  // /**
  //  * Configure a content delivery network for static assets
  //  *
  //  * @default none
  //  */
  // assetCdn?: AssetCdnProps;

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

  // public readonly singleTableDatastore?: SingleTableDatastore;
  // public readonly authentication?: IAuthentication;
  // public readonly assetCdn?: AssetCdn;
  // public readonly monitoring?: Monitoring;

  constructor(scope: Construct, id: string, _props: BaseApiProps) {
    super(scope, id);

    // if (props.singleTableDatastore) {
    //   this.singleTableDatastore = new SingleTableDatastore(this, 'SingleTableDS', props.singleTableDatastore);
    // }
    // if (props.existingAuthentication && props.authentication) {
    //   throw new Error('Cannot specify new and existing authentication at the same time');
    // }
    // if (props.existingAuthentication) {
    //   this.authentication = props.existingAuthentication;
    // }
    // if (props.authentication) {
    //   const newAuth = new Authentication(this, 'Authentication', props.authentication);
    //   if (this.singleTableDatastore) {
    //     if (newAuth.customMessageFunction) {
    //       newAuth.customMessageFunction.setTable(this.singleTableDatastore.table, false);
    //     }
    //     if (newAuth.preTokenGenerationFunction) {
    //       newAuth.preTokenGenerationFunction.setTable(this.singleTableDatastore.table, false);
    //     }
    //   }
    //   this.authentication = newAuth;
    // }
    // if (props.assetCdn) {
    //   this.assetCdn = new AssetCdn(this, 'AssetCdn', props.assetCdn);
    // }

    // if (props.monitoring ?? true) {
    //   this.monitoring = new Monitoring(this, 'Monitoring', {
    //     apiName: props.apiName,
    //     stageName: props.stageName,
    //   });
    // }
  }

}
