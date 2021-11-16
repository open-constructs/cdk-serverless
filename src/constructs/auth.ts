import * as fs from 'fs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { LambdaFunction } from './func';

export interface IAuthentication {
  readonly userpool: cognito.IUserPool;
}

export interface AuthenticationProps {

  /**
   * Configure Cognito Lambda triggers
   */
  triggers?: {
    /**
     * Attaches a lambda function to the custom message trigger
     *
     * Code has to reside in './src/lambda/cognito.custom-message.ts' with a method 'handler'
     *
     * @default false
     */
    customMessages?: boolean;

    /**
     * Attaches a lambda function to the pre token generation trigger
     *
     * Code has to reside in './src/lambda/cognito.pre-token-generation.ts' with a method 'handler'
     *
     * @default false
     */
    preTokenGeneration?: boolean;
  };

  /**
   * Properties of the Cognito user pool
   */
  userPoolProps?: cognito.UserPoolProps;

  /**
   * Configure SES mail sending
   */
  sesEmailSender?: {
    /**
     * AWS region to use for SES
     */
    region: string;
    /**
     * Sender name
     */
    name: string;
    /**
     * Sender email. Needs to be verified in SES
     */
    email: string;
  };

  /**
   * Groups to create in Cognito user pool
   * Key: group name
   * Value: group description
   */
  groups?: {
    [name: string]: string;
  };
}

export class Authentication extends Construct implements IAuthentication {

  public readonly userpool: cognito.UserPool;
  public readonly customMessageFunction?: LambdaFunction;
  public readonly preTokenGenerationFunction?: LambdaFunction;

  constructor(scope: Construct, id: string, props: AuthenticationProps) {
    super(scope, id);

    this.userpool = new cognito.UserPool(this, 'UserPool', {
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
          timeout: cdk.Duration.seconds(5),
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
          timeout: cdk.Duration.seconds(5),
        },
        entry: entryFile,
      });
      this.userpool.addTrigger(cognito.UserPoolOperation.PRE_TOKEN_GENERATION, this.preTokenGenerationFunction);
    }

    if (props.sesEmailSender) {
      (this.userpool.node.defaultChild as cognito.CfnUserPool).emailConfiguration = {
        emailSendingAccount: 'DEVELOPER',
        from: `${props.sesEmailSender.name} <${props.sesEmailSender.email}>`,
        sourceArn: `arn:aws:ses:${props.sesEmailSender.region}:${cdk.Stack.of(this).account}:identity/${props.sesEmailSender.email}`,
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

    new cdk.CfnOutput(this, 'UserPoolId', { value: this.userpool.userPoolId });
  }
}