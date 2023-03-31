import * as fs from 'fs';
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
   * The endpoints audience. Will only be checked if present.
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
}

export class CognitoAuthentication extends Construct implements ICognitoAuthentication {

  public readonly userpool: cognito.UserPool;
  public readonly customMessageFunction?: LambdaFunction;
  public readonly preTokenGenerationFunction?: LambdaFunction;

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
  }

}