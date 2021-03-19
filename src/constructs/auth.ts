import * as fs from 'fs';
import * as cognito from '@aws-cdk/aws-cognito';
import * as cdk from '@aws-cdk/core';
import { WatchableNodejsFunction } from 'cdk-watch';

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

export class Authentication extends cdk.Construct {

  public readonly userpool: cognito.UserPool;
  public readonly customMessageFunction?: WatchableNodejsFunction;

  constructor(scope: cdk.Construct, id: string, props: AuthenticationProps) {
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
        fs.writeFileSync(entryFile, `import { CustomMessageTriggerEvent } from 'aws-lambda';
      
export async function handler(event: CustomMessageTriggerEvent): Promise<CustomMessageTriggerEvent> {
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

      this.customMessageFunction = new WatchableNodejsFunction(this, 'CustomMessageFunction', {
        entry: entryFile,
        bundling: {
          loader: {
            '.html': 'text',
          },
        },
        handler: 'handler',
        timeout: cdk.Duration.seconds(5),
      });
      this.userpool.addTrigger(cognito.UserPoolOperation.CUSTOM_MESSAGE, this.customMessageFunction);
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