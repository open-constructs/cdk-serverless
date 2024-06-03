import * as fs from 'fs';
import * as identitypool from '@aws-cdk/aws-cognito-identitypool-alpha';
import {
  aws_cognito as cognito, CfnOutput, Duration, Stack,

} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { LambdaFunction } from './func';

export interface ICognitoAuthentication {
  /** The Cognito user pool that holds user information */
  readonly userpool: cognito.IUserPool;
}

export interface IJwtAuthentication {
  /**
   * The JWT issuer endpoint URL
   */
  readonly issuerUrl: string;
  /**
   * The endpoint's audience. Will only be checked if present.
   */
  readonly audience?: string[];
  /**
   * The JWT endpoints JWKS store. Unless this is provided, OIDC discovery will be used to find this.
   */
  readonly jwksUrl?: string;
}

export interface CognitoAuthenticationProps {

  /** Name for the Cognito user pool */
  readonly userPoolName: string;

  /**
   * Configure Cognito Lambda triggers
   */
  readonly triggers?: {
    /**
     * Attaches a lambda function to the custom message trigger
     *
     * Code has to reside in './src/lambda/cognito.custom-message.ts' with a method 'handler'
     *
     * @default false
     */
    readonly customMessages?: boolean;

    /**
     * Attaches a lambda function to the pre token generation trigger
     *
     * Code has to reside in './src/lambda/cognito.pre-token-generation.ts' with a method 'handler'
     *
     * @default false
     */
    readonly preTokenGeneration?: boolean;
    /**
     * Attaches a lambda function to the pre sign-up trigger
     *
     * Code has to reside in './src/lambda/cognito.pre-signup.ts' with a method 'handler'
     *
     * @default false
     */
    readonly preSignUp?: boolean;
  };

  /**
   * Properties of the Cognito user pool
   */
  readonly userPoolProps?: cognito.UserPoolProps;

  /**
   * Configure SES mail sending
   */
  readonly sesEmailSender?: {
    /**
     * AWS region to use for SES
     */
    readonly region: string;
    /**
     * Sender name
     */
    readonly name: string;
    /**
     * Sender email. Needs to be already verified in SES
     */
    readonly email: string;
  };

  /**
   * Groups to create in Cognito user pool
   * Key: group name
   * Value: group description
   */
  readonly groups?: {
    readonly [name: string]: string;
  };

  /** Create a new Cognito Identity Pool for the User pool */
  readonly identityPool?: {
    /** configuration of the identity pool */
    readonly poolConfig?: identitypool.IdentityPoolProps;
  };
}

/**
 * The CognitoAuthentication construct sets up a Cognito User Pool with optional triggers and an optional Cognito Identity Pool.
 * It also configures various Lambda triggers for custom message, pre-sign up, and pre-token generation events.
 */
export class CognitoAuthentication extends Construct implements ICognitoAuthentication {

  /**
   * The Cognito User Pool for user authentication.
   */
  public readonly userpool: cognito.UserPool;

  /**
   * The optional Cognito Identity Pool for federated identities.
   */
  public readonly identityPool?: identitypool.IdentityPool;

  /**
   * The optional Lambda function for custom message trigger.
   */
  public readonly customMessageFunction?: LambdaFunction;

  /**
   * The optional Lambda function for pre-sign up trigger.
   */
  public readonly preSignUpFunction?: LambdaFunction;

  /**
   * The optional Lambda function for pre-token generation trigger.
   */
  public readonly preTokenGenerationFunction?: LambdaFunction;

  /**
   * Creates an instance of CognitoAuthentication.
   *
   * @param scope - The scope in which this construct is defined.
   * @param id - The scoped construct ID.
   * @param props - The properties of the CognitoAuthentication construct.
   */
  constructor(scope: Construct, id: string, props: CognitoAuthenticationProps) {
    super(scope, id);

    this.userpool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: props.userPoolName,
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 12,
        requireDigits: false,
        requireLowercase: false,
        requireSymbols: false,
        requireUppercase: false,
      },
      standardAttributes: {
        fullname: {
          mutable: true,
          required: true,
        },
        email: {
          mutable: false,
          required: true,
        },
      },
      selfSignUpEnabled: false,
      signInAliases: {
        email: true,
      },
      signInCaseSensitive: false,
      ...props.userPoolProps,
    });

    if (props.triggers?.customMessages) {
      const entryFile = './src/lambda/cognito.custom-message.ts';

      if (!fs.existsSync(entryFile)) {
        fs.writeFileSync(entryFile, `export async function handler(event: AWSLambda.CustomMessageTriggerEvent): Promise<AWSLambda.CustomMessageTriggerEvent> {
  console.log(event);

  if (event.triggerSource === 'CustomMessage_AdminCreateUser') {
    // event.response.emailSubject = '';
    // event.response.emailMessage = '';
  } else if (event.triggerSource === 'CustomMessage_ForgotPassword') {
    // event.response.emailSubject = '';
    // event.response.emailMessage = '';
  } // ...

  return event;
}`, {
          encoding: 'utf-8',
        });
      }

      this.customMessageFunction = new LambdaFunction(this, 'CustomMessageFunction', {
        entry: entryFile,
        lambdaOptions: {
          bundling: {
            loader: {
              '.html': 'text',
            },
          },
          timeout: Duration.seconds(5),
        },
      });
      this.userpool.addTrigger(cognito.UserPoolOperation.CUSTOM_MESSAGE, this.customMessageFunction);
    }

    if (props.triggers?.preTokenGeneration) {
      const entryFile = './src/lambda/cognito.pre-token-generation.ts';

      if (!fs.existsSync(entryFile)) {
        fs.writeFileSync(entryFile, `export async function handler(event: AWSLambda.PreTokenGenerationTriggerEvent): Promise<AWSLambda.PreTokenGenerationTriggerEvent> {
  console.log(JSON.stringify(event));

  // modify event.response here ...

  return event;
}`, {
          encoding: 'utf-8',
        });
      }

      this.preTokenGenerationFunction = new LambdaFunction(this, 'PreTokenGenerationFunction', {
        lambdaOptions: {
          timeout: Duration.seconds(5),
        },
        entry: entryFile,
      });
      this.userpool.addTrigger(cognito.UserPoolOperation.PRE_TOKEN_GENERATION, this.preTokenGenerationFunction);
    }

    if (props.triggers?.preSignUp) {
      const entryFile = './src/lambda/cognito.pre-signup.ts';

      if (!fs.existsSync(entryFile)) {
        fs.writeFileSync(entryFile, `export async function handler(event: AWSLambda.PreSignUpTriggerEvent): Promise<AWSLambda.PreSignUpTriggerEvent> {
  console.log(JSON.stringify(event));

  // Confirm the user
  // event.response.autoConfirmUser = true;

  // Set the email as verified if it is in the request
  // if (event.request.userAttributes.hasOwnProperty('email')) {
  //   event.response.autoVerifyEmail = true;
  // }

  // Set the phone number as verified if it is in the request
  // if (event.request.userAttributes.hasOwnProperty('phone_number')) {
  //   event.response.autoVerifyPhone = true;
  // }

  return event;
}`, {
          encoding: 'utf-8',
        });
      }

      this.preSignUpFunction = new LambdaFunction(this, 'PreSignUpFunction', {
        lambdaOptions: {
          timeout: Duration.seconds(5),
        },
        entry: entryFile,
      });
      this.userpool.addTrigger(cognito.UserPoolOperation.PRE_SIGN_UP, this.preSignUpFunction);
    }

    if (props.sesEmailSender) {
      (this.userpool.node.defaultChild as cognito.CfnUserPool).emailConfiguration = {
        emailSendingAccount: 'DEVELOPER',
        from: `${props.sesEmailSender.name} <${props.sesEmailSender.email}>`,
        sourceArn: `arn:aws:ses:${props.sesEmailSender.region ?? Stack.of(this).region}:${Stack.of(this).account}:identity/${props.sesEmailSender.email}`,
      };
    }

    for (const groupName in props.groups) {
      if (Object.prototype.hasOwnProperty.call(props.groups, groupName)) {
        const groupDescription = props.groups[groupName];
        new cognito.CfnUserPoolGroup(this, `Group${groupName}`, {
          userPoolId: this.userpool.userPoolId,
          groupName,
          description: groupDescription,
        });
      }
    }

    new CfnOutput(this, 'UserPoolId', { value: this.userpool.userPoolId });

    if (props.identityPool) {
      this.identityPool = new identitypool.IdentityPool(this, 'IdentityPool', {
        allowUnauthenticatedIdentities: true,
        identityPoolName: props.userPoolName + '-identity',
        ...props.identityPool.poolConfig,
        authenticationProviders: {
          userPools: [new identitypool.UserPoolAuthenticationProvider({ userPool: this.userpool })],
          ...props.identityPool.poolConfig?.authenticationProviders,
        },
      });
      new CfnOutput(this, 'IdentityPoolId', { value: this.identityPool.identityPoolId });
      new CfnOutput(this, 'IdentityPoolAuthRoleArn', { value: this.identityPool.authenticatedRole.roleArn });
      new CfnOutput(this, 'IdentityPoolUnAuthRoleArn', { value: this.identityPool.unauthenticatedRole.roleArn });
    }
  }

}